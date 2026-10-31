/**
 * PortalNexus V3.0 — Telemetry & Lifecycle Resiliency Remediation Tests
 *
 * Verifies:
 * 1. React 19 StrictMode mount -> unmount -> remount lifecycle resiliency for both Substrate and EVM clients.
 * 2. System.Account storage key generation (twox128("System") + twox128("Account") + blake2_128Concat(pubkey)).
 * 3. Accurate SCALE decoding of AccountInfo (nonce, consumers, providers, free, reserved, frozen).
 * 4. Genuine queryAccountBalance formatting and fallback handling.
 * 5. Block hash and finalized head tracking via chain_getBlockHash and chain_getFinalizedHead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeSystemAccountStorageKey,
  decodeSystemAccount,
  formatSubstrateNativeUnits
} from '../src/lib/substrateUtils';
import { SubstrateRpcClient } from '../src/services/substrateRpc';
import { EvmRpcClient } from '../src/services/evmRpc';

const testSenderSS58 = '5GmZebxRusZB3XpVfqmvZBRphbnv9EQkVLjctSZ57nzgof83';
const aliceSS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

// Live on-chain System.Account storage hex for 5GmZeb...of83
const liveSenderStorageHex =
  '0x02000000000000000100000000000000ffb1f410c2537f010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080';

describe('System.Account Storage Key & SCALE Decoding', () => {
  it('computes exact on-chain storage key for connected account 5GmZe...of83', () => {
    const key = computeSystemAccountStorageKey(testSenderSS58);
    // Prefix (32 bytes) = 0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9
    // Blake2-128(pubkey) = b698cd47bbd7ed987221066f2200a1ee
    // Pubkey (32 bytes) = d01a5d5ec1d8b1b1639b3a084d97f92bd16b7627589d71317c40a80a43cf287b
    expect(key).toBe(
      '0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9b698cd47bbd7ed987221066f2200a1eed01a5d5ec1d8b1b1639b3a084d97f92bd16b7627589d71317c40a80a43cf287b'
    );
    expect(key.length).toBe(2 + 64 + 32 + 64); // 0x + 64 hex chars prefix + 32 chars hash + 64 chars pubkey = 162
  });

  it('computes exact on-chain storage key for recipient Alice (5Grwva...)', () => {
    const key = computeSystemAccountStorageKey(aliceSS58);
    expect(key).toBe(
      '0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9de1e86a9a8c739864cf3cc5ec2bea59fd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
    );
  });

  it('correctly decodes genuine live System.Account storage value into AccountInfo', () => {
    const decoded = decodeSystemAccount(liveSenderStorageHex);

    expect(decoded.nonce).toBe(2);
    expect(decoded.consumers).toBe(0);
    expect(decoded.providers).toBe(1);
    expect(decoded.suffragents).toBe(0);
    expect(decoded.free).toBe(107897009053413887n);
    expect(decoded.reserved).toBe(0n);
    expect(decoded.frozen).toBe(0n);

    const formatted = formatSubstrateNativeUnits(decoded.free, 14, 4);
    expect(formatted).toBe('1078.9700 tPOT');
  });

  it('safely handles null, uninitialized, or empty storage values without throwing', () => {
    const fromNull = decodeSystemAccount(null);
    expect(fromNull.nonce).toBe(0);
    expect(fromNull.free).toBe(0n);

    const fromEmpty = decodeSystemAccount('0x');
    expect(fromEmpty.nonce).toBe(0);
    expect(fromEmpty.free).toBe(0n);

    const fromShort = decodeSystemAccount('0x0102');
    expect(fromShort.nonce).toBe(0);
    expect(fromShort.free).toBe(0n);
  });
});

describe('SubstrateRpcClient Lifecycle & Remount Resiliency', () => {
  let client: SubstrateRpcClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new SubstrateRpcClient('wss://test-node-v3.portaldot.dev');
  });

  afterEach(() => {
    client.destroy();
    vi.useRealTimers();
  });

  it('recovers cleanly from destroy() upon React StrictMode remount', () => {
    // 1. Initial connect (mount)
    client.connect();
    expect(client.getState().status).toBe('CONNECTING');

    // 2. Component unmounts (StrictMode cleanup)
    client.destroy();
    expect(client.getState().status).toBe('DISCONNECTED');
    expect(client.getState().freshness).toBe('UNAVAILABLE');

    // 3. Component remounts (StrictMode remount)
    client.connect();
    // Verify client is NOT stuck in isDestroyed state; status transitions to CONNECTING
    expect(client.getState().status).toBe('CONNECTING');
  });

  it('queryAccountBalance queries storage key and returns formatted balance', async () => {
    vi.spyOn(client, 'query').mockImplementation(async (method: string, _params: any[] = []) => {
      if (method === 'state_getStorage') {
        return { result: liveSenderStorageHex, latency: 50 };
      }
      return { result: null, latency: 10 };
    });

    const balance = await client.queryAccountBalance(testSenderSS58);
    expect(balance).not.toBeNull();
    expect(balance?.free).toBe('107897009053413887');
    expect(balance?.nonce).toBe(2);
    expect(balance?.formatted).toBe('1078.9700 tPOT');
  });

  it('pollBlockHeaders queries block hash and finalized head', async () => {
    vi.spyOn(client, 'query').mockImplementation(async (method: string, params: any[] = []) => {
      if (method === 'chain_getBlockHash') {
        return { result: '0xheadhash123', latency: 20 };
      }
      if (method === 'chain_getHeader' && params.length === 0) {
        return { result: { number: '0x3d200' }, latency: 20 };
      }
      if (method === 'chain_getFinalizedHead') {
        return { result: '0xfinhash456', latency: 20 };
      }
      if (method === 'chain_getHeader' && params[0] === '0xfinhash456') {
        return { result: { number: '0x3d1f0' }, latency: 20 };
      }
      return { result: null, latency: 10 };
    });

    // Mock WebSocket as open
    (client as any).ws = { readyState: 1, close: vi.fn() }; // WebSocket.OPEN = 1

    await client.pollBlockHeaders();

    const state = client.getState();
    expect(state.blockHeight).toBe(250368); // 0x3d200 = 250368
    expect(state.blockHash).toBe('0xheadhash123');
    expect(state.finalizedBlockHeight).toBe(250352); // 0x3d1f0 = 250352
    expect(state.finalizedBlockHash).toBe('0xfinhash456');
    expect(state.freshness).toBe('LIVE');
  });
});

describe('EvmRpcClient Lifecycle & Remount Resiliency', () => {
  let evmClient: EvmRpcClient;

  beforeEach(() => {
    vi.useFakeTimers();
    evmClient = new EvmRpcClient('https://test-evm-rpc-v3.portaldot.dev');
  });

  afterEach(() => {
    evmClient.destroy();
    vi.useRealTimers();
  });

  it('recovers cleanly from destroy() upon React StrictMode remount', async () => {
    vi.spyOn(evmClient, 'query').mockImplementation(async (method: string) => {
      if (method === 'eth_chainId') return { result: '0x190f1ca9', latency: 30 };
      if (method === 'eth_blockNumber') return { result: '0x3d200', latency: 30 };
      if (method === 'eth_getBlockByNumber') {
        return {
          result: { number: '0x3d200', hash: '0xevmblock1', timestamp: '0x68000000' },
          latency: 30
        };
      }
      return { result: null, latency: 10 };
    });

    // 1. Initial start (mount)
    await evmClient.start();
    expect(evmClient.getState().status).toBe('CONNECTED');

    // 2. Component unmounts (StrictMode cleanup)
    evmClient.destroy();
    expect(evmClient.getState().status).toBe('DISCONNECTED');

    // 3. Component remounts (StrictMode remount)
    await evmClient.start();
    expect(evmClient.getState().status).toBe('CONNECTED');
    expect(evmClient.getState().blockHeight).toBe(250368);
  });
});
