/**
 * PortalNexus — Portaldot V3 EVM JSON-RPC Driver
 * Direct read-only connection to https://test-evm-rpc-v3.portaldot.dev
 * Handles HTTP JSON-RPC 2.0 calls, AbortController timeouts, latency tracking, and error isolation.
 */

import { EvmChainState } from '../types';

export class EvmRpcClient {
  private endpoint: string;
  private state: EvmChainState;
  private listeners: Array<(state: EvmChainState) => void> = [];
  private pollInterval: number | null = null;
  private isDestroyed = false;
  private nextId = 1;

  constructor(endpoint = 'https://test-evm-rpc-v3.portaldot.dev') {
    this.endpoint = endpoint;
    this.state = {
      status: 'DISCONNECTED',
      endpoint: this.endpoint,
      chainId: null,
      netVersion: null,
      clientVersion: null,
      blockHeight: null,
      blockHash: null,
      blockTimestamp: null,
      gasPriceGwei: null,
      isSyncing: null,
      lastUpdated: null,
      latencyMs: null,
      freshness: 'UNAVAILABLE',
      error: null
    };
  }

  public subscribe(listener: (state: EvmChainState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getState(): EvmChainState {
    return this.state;
  }

  public async query(method: string, params: any[] = []): Promise<any> {
    const id = this.nextId++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const t0 = Date.now();
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - t0;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message || `EVM RPC error for ${method}`);
      }

      return { result: json.result, latency };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      throw new Error(isAbort ? `Timeout connecting to ${this.endpoint}` : err.message);
    }
  }

  public async start(): Promise<void> {
    if (this.isDestroyed) return;

    this.updateState({ status: 'CONNECTING', error: null });

    try {
      await this.fetchInitialIdentity();
      await this.pollBlock();
      this.updateState({ status: 'CONNECTED', error: null, freshness: 'LIVE' });
      this.startPolling();
    } catch (err: any) {
      this.updateState({
        status: 'ERROR',
        error: `Failed to initialize EVM RPC: ${err.message}`,
        freshness: 'UNAVAILABLE'
      });
      // Start polling anyway to attempt recovery
      this.startPolling();
    }
  }

  private async fetchInitialIdentity(): Promise<void> {
    try {
      const [chainRes, clientRes, netRes] = await Promise.allSettled([
        this.query('eth_chainId'),
        this.query('web3_clientVersion'),
        this.query('net_version')
      ]);

      const updates: Partial<EvmChainState> = {};

      if (chainRes.status === 'fulfilled' && chainRes.value.result) {
        updates.chainId = parseInt(chainRes.value.result, 16);
      }
      if (clientRes.status === 'fulfilled') {
        updates.clientVersion = clientRes.value.result;
      }
      if (netRes.status === 'fulfilled') {
        updates.netVersion = String(netRes.value.result);
      }

      this.updateState(updates);
    } catch (err: any) {
      console.warn('[EvmRPC] Error fetching initial EVM identity:', err.message);
    }
  }

  public async pollBlock(): Promise<void> {
    if (this.isDestroyed) return;

    const t0 = Date.now();
    try {
      const [blockRes, syncRes, gasRes] = await Promise.allSettled([
        this.query('eth_getBlockByNumber', ['latest', false]),
        this.query('eth_syncing'),
        this.query('eth_gasPrice')
      ]);

      const latency = Date.now() - t0;
      const updates: Partial<EvmChainState> = {
        lastUpdated: Date.now(),
        latencyMs: latency,
        freshness: 'LIVE',
        status: 'CONNECTED',
        error: null
      };

      if (blockRes.status === 'fulfilled' && blockRes.value?.result) {
        const b = blockRes.value.result;
        updates.blockHeight = parseInt(b.number, 16);
        updates.blockHash = b.hash;
        updates.blockTimestamp = parseInt(b.timestamp, 16) * 1000;
      }

      if (syncRes.status === 'fulfilled') {
        updates.isSyncing = syncRes.value.result === true;
      }

      if (gasRes.status === 'fulfilled' && gasRes.value?.result) {
        const wei = BigInt(gasRes.value.result);
        const gwei = Number(wei) / 1e9;
        updates.gasPriceGwei = gwei.toFixed(4);
      }

      this.updateState(updates);
    } catch (err: any) {
      this.updateState({
        status: 'ERROR',
        freshness: 'STALE',
        error: `EVM poll failed: ${err.message}`
      });
    }
  }

  private startPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = window.setInterval(() => {
      this.pollBlock();
    }, 4000);
  }

  private updateState(partial: Partial<EvmChainState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => fn(this.state));
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.updateState({ status: 'DISCONNECTED', freshness: 'UNAVAILABLE' });
  }
}
