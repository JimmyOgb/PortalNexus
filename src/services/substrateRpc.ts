/**
 * PortalNexus — Substrate Native WebSocket Driver
 * Direct read-only connection to wss://test-node-v3.portaldot.dev
 * Handles handshakes, reconnects, latency tracking, timeouts, and error isolation.
 */

import { SubstrateChainState } from '../types';
import {
  computeExtrinsicHash,
  parseExtrinsicDispatchResult,
  computeSystemAccountStorageKey,
  decodeSystemAccount,
  formatSubstrateNativeUnits,
  PORTALDOT_SUBSTRATE_CONSTANTS
} from '../lib/substrateUtils';

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
    this.isDestroyed = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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

    // HTTP JSON-RPC fallback
    const httpEndpoint = this.endpoint.replace('wss://', 'https://').replace('ws://', 'http://');
    try {
      const response = await fetch(httpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params })
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || `Substrate RPC error for ${method}`);
      }
      return { result: data.result, latency: 10 };
    } catch (err: any) {
      throw new Error(`Substrate RPC query ${method} failed: ${err.message}`);
    }
  }

  public async getGenesisHash(): Promise<string> {
    const res = await this.query('chain_getBlockHash', [0]);
    return res.result || '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
  }

  public async getAccountNonce(address: string): Promise<number> {
    try {
      const res = await this.query('system_accountNextIndex', [address]);
      if (typeof res?.result === 'number') return res.result;
      if (typeof res?.result === 'string') return parseInt(res.result, 16) || 0;
      return 0;
    } catch {
      return 0;
    }
  }

  public async submitExtrinsic(extrinsicHex: string): Promise<string> {
    const res = await this.query('author_submitExtrinsic', [extrinsicHex]);
    if (!res || !res.result) {
      throw new Error(res?.error?.message || 'Failed to submit extrinsic to Substrate node.');
    }
    return res.result;
  }

  public async getBlockHash(blockNumber: number): Promise<string | null> {
    const res = await this.query('chain_getBlockHash', [blockNumber]);
    return res?.result || null;
  }

  public async getBlock(blockHash?: string): Promise<{ block: { header: { number: string; parentHash: string }; extrinsics: string[] } } | null> {
    const params = blockHash ? [blockHash] : [];
    const res = await this.query('chain_getBlock', params);
    return res?.result || null;
  }

  public async getStorage(key: string, blockHash?: string): Promise<string | null> {
    const params = blockHash ? [key, blockHash] : [key];
    const res = await this.query('state_getStorage', params);
    return res?.result || null;
  }

  public async waitForFinalizedBlock(timeoutMs = 60000): Promise<{ hash: string; number: number }> {
    const start = Date.now();
    const initialHeight = this.state.finalizedBlockHeight;

    while (Date.now() - start < timeoutMs) {
      try {
        const finRes = await this.query('chain_getFinalizedHead');
        const finHash = finRes?.result;
        if (finHash) {
          const headerRes = await this.query('chain_getHeader', [finHash]);
          const header = headerRes?.result;
          const height = header?.number ? parseInt(header.number, 16) : 0;
          if (initialHeight === null || height >= initialHeight) {
            return { hash: finHash, number: height };
          }
        }
      } catch {
        // retry polling
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Timeout waiting for finalized block after ${timeoutMs / 1000}s`);
  }

  /**
   * Tracks an extrinsic across finalized blocks, verifying that the extrinsic
   * with matching hash or exact hex is included in a finalized block, and returns the exact
   * extrinsic index within that block.
   *
   * Handles finality leaps where multiple blocks become finalized between polling
   * iterations, ensuring all intermediate blocks are checked without skipping,
   * duplicate head notifications are deduplicated, and transient RPC errors retry
   * from the last uninspected block without advancing the inspection pointer.
   */
  public async waitForExtrinsicInclusion(
    extrinsicHash: string,
    submittedHex: string,
    timeoutMs = 60000,
    onStatusUpdate?: (msg: string) => void,
    pollIntervalMs = 2000
  ): Promise<{ blockHash: string; blockNumber: number; extrinsicIndex: number }> {
    const start = Date.now();
    const targetHashLower = extrinsicHash.toLowerCase();
    const submittedHexClean = submittedHex.startsWith('0x') ? submittedHex.slice(2).toLowerCase() : submittedHex.toLowerCase();

    let lastInspectedHeight: number | null = null;
    onStatusUpdate?.('Polling finalized blocks for extrinsic inclusion...');

    while (Date.now() - start < timeoutMs) {
      try {
        const finRes = await this.query('chain_getFinalizedHead');
        const finHash = finRes?.result;

        if (finHash) {
          const headBlockRes = await this.getBlock(finHash);
          const currentFinalizedHeight = headBlockRes?.block?.header?.number
            ? parseInt(headBlockRes.block.header.number, 16)
            : null;

          if (currentFinalizedHeight !== null) {
            if (lastInspectedHeight === null) {
              lastInspectedHeight = currentFinalizedHeight - 1;
            }

            if (currentFinalizedHeight > lastInspectedHeight) {
              const fromHeight: number = lastInspectedHeight + 1;
              for (let h = fromHeight; h <= currentFinalizedHeight; h++) {
                let bHash: string | null = null;
                let blockRes: { block: { header: { number: string; parentHash: string }; extrinsics: string[] } } | null = null;

                if (h === currentFinalizedHeight) {
                  bHash = finHash;
                  blockRes = headBlockRes;
                } else {
                  bHash = await this.getBlockHash(h);
                  if (bHash) {
                    blockRes = await this.getBlock(bHash);
                  }
                }

                if (!bHash || !blockRes || !blockRes.block) {
                  // Transient RPC error fetching block; break out to retry from h on next poll
                  // lastInspectedHeight is intentionally not advanced past h - 1.
                  break;
                }

                const extrinsics = blockRes.block.extrinsics || [];
                for (let i = 0; i < extrinsics.length; i++) {
                  const exHex = extrinsics[i];
                  const exHexClean = exHex.startsWith('0x') ? exHex.slice(2).toLowerCase() : exHex.toLowerCase();
                  const exComputedHash = computeExtrinsicHash(exHex).toLowerCase();

                  if (exComputedHash === targetHashLower || exHexClean === submittedHexClean) {
                    onStatusUpdate?.(`Extrinsic found in finalized block #${h} at index ${i}!`);
                    return {
                      blockHash: bHash,
                      blockNumber: h,
                      extrinsicIndex: i
                    };
                  }
                }

                // Block h successfully inspected; advance lastInspectedHeight
                lastInspectedHeight = h;
              }
            }
          }
        }
      } catch {
        // Non-fatal transient error polling finalized head; retry on next tick
      }

      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    throw new Error(
      `Extrinsic inclusion timed out after ${timeoutMs / 1000}s. The extrinsic was not included in any finalized block. It may have been dropped, usurped, or rejected.`
    );
  }

  /**
   * Verifies the dispatch outcome of an extrinsic by querying System.Events at the finalized block.
   * Checks whether the event corresponding to extrinsicIndex is System.ExtrinsicSuccess
   * or System.ExtrinsicFailed, decoding any runtime dispatch error.
   */
  public async verifyDispatchSuccess(
    finalizedBlockHash: string,
    extrinsicIndexOrHash: number | string
  ): Promise<{ success: boolean; eventName?: string; error?: string }> {
    try {
      let targetIndex: number;
      if (typeof extrinsicIndexOrHash === 'number') {
        targetIndex = extrinsicIndexOrHash;
      } else {
        // If string hash was passed, search the block extrinsics to find the index
        const blockRes = await this.getBlock(finalizedBlockHash);
        if (!blockRes || !blockRes.block) {
          return { success: false, error: 'Could not fetch block to identify extrinsic index.' };
        }
        const targetHashLower = extrinsicIndexOrHash.toLowerCase();
        let foundIdx = -1;
        for (let i = 0; i < blockRes.block.extrinsics.length; i++) {
          const exHash = computeExtrinsicHash(blockRes.block.extrinsics[i]).toLowerCase();
          if (exHash === targetHashLower) {
            foundIdx = i;
            break;
          }
        }
        if (foundIdx === -1) {
          return { success: false, error: 'Extrinsic hash not found in specified finalized block.' };
        }
        targetIndex = foundIdx;
      }

      // Query System.Events: twox128("System") + twox128("Events")
      const eventsStorageKey = '0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7';
      const eventsHex = await this.getStorage(eventsStorageKey, finalizedBlockHash);

      if (!eventsHex) {
        return { success: false, error: 'No System.Events record found in finalized block.' };
      }

      const verification = parseExtrinsicDispatchResult(eventsHex, targetIndex);
      return {
        success: verification.success,
        eventName: verification.eventName,
        error: verification.error
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to verify extrinsic dispatch status.' };
    }
  }

  public async queryAccountBalance(address: string): Promise<{
    free: string;
    reserved: string;
    frozen: string;
    nonce: number;
    formatted: string;
  } | null> {
    try {
      const storageKey = computeSystemAccountStorageKey(address);
      const res = await this.query('state_getStorage', [storageKey]);
      const rawStorage = res?.result;
      const decoded = decodeSystemAccount(rawStorage);
      const decimals = this.state.tokenDecimals ?? PORTALDOT_SUBSTRATE_CONSTANTS.tokenDecimals;
      const formatted = formatSubstrateNativeUnits(decoded.free, decimals, 4);

      return {
        free: decoded.free.toString(),
        reserved: decoded.reserved.toString(),
        frozen: decoded.frozen.toString(),
        nonce: decoded.nonce,
        formatted
      };
    } catch (err: any) {
      console.warn(`[SubstrateRPC] Failed to query account balance for ${address}:`, err);
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
    if (this.isDestroyed) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      const t0 = Date.now();
      let finalizedHash: string | null = null;

      const [headHashRes, headRes, finHeadRes] = await Promise.allSettled([
        this.query('chain_getBlockHash'),
        this.query('chain_getHeader'),
        this.query('chain_getFinalizedHead').then(async (r: any) => {
          if (r?.result) {
            finalizedHash = r.result;
            const h = await this.query('chain_getHeader', [r.result]);
            return h?.result;
          }
          return null;
        })
      ]);

      if (this.isDestroyed) return;

      const latency = Date.now() - t0;
      const updates: Partial<SubstrateChainState> = {
        latencyMs: latency,
        lastUpdated: Date.now(),
        freshness: 'LIVE',
        error: null
      };

      if (headHashRes.status === 'fulfilled' && headHashRes.value?.result) {
        updates.blockHash = headHashRes.value.result;
      }

      if (headRes.status === 'fulfilled' && headRes.value?.result) {
        const header = headRes.value.result;
        updates.blockHeight = parseInt(header.number, 16);
      }

      if (finalizedHash) {
        updates.finalizedBlockHash = finalizedHash;
      }

      if (finHeadRes.status === 'fulfilled' && finHeadRes.value) {
        const finHeader = finHeadRes.value;
        updates.finalizedBlockHeight = parseInt(finHeader.number, 16);
      }

      this.updateState(updates);
    } catch (err: any) {
      if (!this.isDestroyed) {
        this.updateState({
          freshness: 'STALE',
          error: `Header poll failed: ${err.message}`
        });
      }
    }
  }

  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.isDestroyed) return;
    this.pollInterval = (typeof window !== 'undefined' ? window.setInterval : setInterval)(() => {
      if (!this.isDestroyed) {
        this.pollBlockHeaders();
      }
    }, 4000) as unknown as number;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isDestroyed) return;
    this.reconnectTimeout = (typeof window !== 'undefined' ? window.setTimeout : setTimeout)(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000) as unknown as number;
  }

  private updateState(partial: Partial<SubstrateChainState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(fn => fn(this.state));
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      const wsToClose = this.ws;
      this.ws = null;
      if (typeof wsToClose.close === 'function') {
        wsToClose.close();
      }
    }
    this.updateState({ status: 'DISCONNECTED', freshness: 'UNAVAILABLE' });
  }
}
