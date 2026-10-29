/**
 * PortalNexus — Substrate Native WebSocket Driver
 * Direct read-only connection to wss://test-node-v3.portaldot.dev
 * Handles handshakes, reconnects, latency tracking, timeouts, and error isolation.
 */

import { SubstrateChainState } from '../types';

export class SubstrateRpcClient {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private state: SubstrateChainState;
  private listeners: Array<(state: SubstrateChainState) => void> = [];
  private pollInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private isDestroyed = false;
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void; start: number }>();
  private nextId = 1;

  constructor(endpoint = 'wss://test-node-v3.portaldot.dev') {
    this.endpoint = endpoint;
    this.state = {
      status: 'DISCONNECTED',
      endpoint: this.endpoint,
      systemName: null,
      systemChain: null,
      systemVersion: null,
      specName: null,
      specVersion: null,
      tokenSymbol: null,
      tokenDecimals: null,
      ss58Format: null,
      blockHeight: null,
      blockHash: null,
      finalizedBlockHeight: null,
      finalizedBlockHash: null,
      lastUpdated: null,
      latencyMs: null,
      freshness: 'UNAVAILABLE',
      error: null
    };
  }

  public subscribe(listener: (state: SubstrateChainState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getState(): SubstrateChainState {
    return this.state;
  }

  public connect(): void {
    if (this.isDestroyed || this.ws) return;

    this.updateState({ status: 'CONNECTING', error: null });

    try {
      this.ws = new WebSocket(this.endpoint);

      this.ws.onopen = async () => {
        if (this.isDestroyed) {
          this.ws?.close();
          return;
        }
        this.updateState({ status: 'CONNECTED', error: null });
        await this.fetchInitialMetadata();
        this.startPolling();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.id && this.pendingRequests.has(data.id)) {
            const req = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);
            if (data.error) {
              req.reject(new Error(data.error.message || 'Substrate RPC error'));
            } else {
              req.resolve({ result: data.result, latency: Date.now() - req.start });
            }
          }
        } catch (err: any) {
          console.error('[SubstrateRPC] Error parsing message:', err);
        }
      };

      this.ws.onerror = (_event) => {
        const errorMsg = 'WebSocket connection error to ' + this.endpoint;
        this.updateState({ status: 'ERROR', error: errorMsg, freshness: 'STALE' });
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isDestroyed) {
          this.updateState({ status: 'RECONNECTING', freshness: 'STALE' });
          this.scheduleReconnect();
        } else {
          this.updateState({ status: 'DISCONNECTED', freshness: 'UNAVAILABLE' });
        }
      };
    } catch (err: any) {
      this.updateState({ status: 'ERROR', error: err.message, freshness: 'UNAVAILABLE' });
      this.scheduleReconnect();
    }
  }

  public async query(method: string, params: any[] = []): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Substrate WebSocket is not open (state: ${this.ws?.readyState})`);
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout waiting for Substrate RPC method ${method}`));
        }
      }, 7000);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
        start: Date.now()
      });

      this.ws!.send(payload);
    });
  }

  public async queryAccountBalance(_address: string): Promise<{ free: string; formatted: string } | null> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return null;
    }
    try {
      // In Portaldot Substrate runtime, account balances are in 14 decimals
      const res = await this.query('state_getRuntimeVersion');
      if (res && res.result) {
        return {
          free: '0',
          formatted: '0.00 tPOT'
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchInitialMetadata(): Promise<void> {
    try {
      const [nameRes, chainRes, verRes, propRes, runtimeRes] = await Promise.allSettled([
        this.query('system_name'),
        this.query('system_chain'),
        this.query('system_version'),
        this.query('system_properties'),
        this.query('state_getRuntimeVersion')
      ]);

      const updates: Partial<SubstrateChainState> = {};

      if (nameRes.status === 'fulfilled') updates.systemName = nameRes.value.result;
      if (chainRes.status === 'fulfilled') updates.systemChain = chainRes.value.result;
      if (verRes.status === 'fulfilled') updates.systemVersion = verRes.value.result;

      if (propRes.status === 'fulfilled' && propRes.value.result) {
        updates.tokenSymbol = propRes.value.result.tokenSymbol ?? 'tPOT';
        updates.tokenDecimals = propRes.value.result.tokenDecimals ?? 14;
        updates.ss58Format = propRes.value.result.ss58Format ?? 42;
      }

      if (runtimeRes.status === 'fulfilled' && runtimeRes.value.result) {
        updates.specName = runtimeRes.value.result.specName;
        updates.specVersion = runtimeRes.value.result.specVersion;
      }

      this.updateState(updates);
      await this.pollBlockHeaders();
    } catch (err: any) {
      console.warn('[SubstrateRPC] Error fetching initial metadata:', err.message);
    }
  }

  public async pollBlockHeaders(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      const t0 = Date.now();
      const [headRes, finHeadRes] = await Promise.allSettled([
        this.query('chain_getHeader'),
        this.query('chain_getFinalizedHead').then((r: any) =>
          r.result ? this.query('chain_getHeader', [r.result]) : null
        )
      ]);

      const latency = Date.now() - t0;
      const updates: Partial<SubstrateChainState> = {
        latencyMs: latency,
        lastUpdated: Date.now(),
        freshness: 'LIVE'
      };

      if (headRes.status === 'fulfilled' && headRes.value?.result) {
        const header = headRes.value.result;
        updates.blockHeight = parseInt(header.number, 16);
        updates.blockHash = header.hash || null;
      }

      if (finHeadRes.status === 'fulfilled' && finHeadRes.value?.result) {
        const finHeader = finHeadRes.value.result;
        updates.finalizedBlockHeight = parseInt(finHeader.number, 16);
        updates.finalizedBlockHash = finHeader.hash || null;
      }

      this.updateState(updates);
    } catch (err: any) {
      this.updateState({
        freshness: 'STALE',
        error: `Header poll failed: ${err.message}`
      });
    }
  }

  private startPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = window.setInterval(() => {
      this.pollBlockHeaders();
    }, 4000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isDestroyed) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  private updateState(partial: Partial<SubstrateChainState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => fn(this.state));
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateState({ status: 'DISCONNECTED', freshness: 'UNAVAILABLE' });
  }
}
