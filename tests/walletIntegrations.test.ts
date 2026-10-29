import { describe, it, expect, vi } from 'vitest';
import { EvmWalletService, PORTALDOT_CHAIN_ID_DEC, PORTALDOT_CHAIN_ID_HEX } from '../src/services/evmWallet';
import { SubstrateWalletService } from '../src/services/substrateWallet';

describe('EvmWalletService', () => {
  it('initializes in disconnected state with null values', () => {
    const service = new EvmWalletService();
    const state = service.getState();

    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.chainId).toBeNull();
    expect(state.isCorrectNetwork).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fails safely when no EVM provider is detected', async () => {
    const service = new EvmWalletService();
    service.setProvider(null);

    const success = await service.connect();
    expect(success).toBe(false);

    const state = service.getState();
    expect(state.isConnected).toBe(false);
    expect(state.error).toContain('No EVM wallet detected');
  });

  it('handles user rejection (error code 4001) without crashing', async () => {
    const mockProvider = {
      request: vi.fn().mockRejectedValue({ code: 4001, message: 'User rejected the request.' })
    };

    const service = new EvmWalletService(mockProvider);
    const success = await service.connect();

    expect(success).toBe(false);
    const state = service.getState();
    expect(state.isConnected).toBe(false);
    expect(state.error).toContain('User rejected');
  });

  it('connects successfully to Portaldot V3 Testnet (420420777)', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const mockProvider = {
      request: vi.fn().mockImplementation(({ method }) => {
        if (method === 'eth_requestAccounts') return Promise.resolve([mockAddress]);
        if (method === 'eth_chainId') return Promise.resolve(PORTALDOT_CHAIN_ID_HEX);
        if (method === 'eth_getBalance') return Promise.resolve('0xde0b6b3a7640000'); // 1.0 ETH in wei
        return Promise.resolve(null);
      })
    };

    const service = new EvmWalletService(mockProvider);
    const success = await service.connect();

    expect(success).toBe(true);
    const state = service.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(mockAddress);
    expect(state.chainId).toBe(PORTALDOT_CHAIN_ID_DEC);
    expect(state.isCorrectNetwork).toBe(true);
    expect(state.balancePot).toBe('1.0000');
    expect(state.error).toBeNull();
  });

  it('detects wrong network and warns user', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const mockProvider = {
      request: vi.fn().mockImplementation(({ method }) => {
        if (method === 'eth_requestAccounts') return Promise.resolve([mockAddress]);
        if (method === 'eth_chainId') return Promise.resolve('0x1'); // Mainnet Ethereum
        if (method === 'eth_getBalance') return Promise.resolve('0x0');
        return Promise.resolve(null);
      })
    };

    const service = new EvmWalletService(mockProvider);
    const success = await service.connect();

    expect(success).toBe(true);
    const state = service.getState();
    expect(state.isConnected).toBe(true);
    expect(state.chainId).toBe(1);
    expect(state.isCorrectNetwork).toBe(false);
    expect(state.balancePot).toBeNull();
    expect(state.error).toContain('Connected to Chain ID 1. Switch to Portaldot V3');
  });

  it('disconnects and resets all fields cleanly', () => {
    const service = new EvmWalletService();
    service.disconnect();

    const state = service.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.balanceWei).toBeNull();
    expect(state.balancePot).toBeNull();
  });
});

describe('SubstrateWalletService', () => {
  it('initializes in disconnected state with empty accounts', () => {
    const service = new SubstrateWalletService();
    const state = service.getState();

    expect(state.isConnected).toBe(false);
    expect(state.selectedAccount).toBeNull();
    expect(state.accounts).toHaveLength(0);
    expect(state.balanceRaw).toBeNull();
    expect(state.error).toBeNull();
  });

  it('fails safely when window.injectedWeb3 is undefined', async () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete globalThis.window;

    const service = new SubstrateWalletService();
    const success = await service.connect();

    expect(success).toBe(false);
    globalThis.window = originalWindow;
  });

  it('selects account and resets balance on disconnect', () => {
    const service = new SubstrateWalletService();
    service.selectAccount({
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      name: 'Alice',
      source: 'polkadot-js'
    });

    expect(service.getState().selectedAccount?.name).toBe('Alice');

    service.disconnect();
    expect(service.getState().selectedAccount).toBeNull();
    expect(service.getState().isConnected).toBe(false);
  });
});
