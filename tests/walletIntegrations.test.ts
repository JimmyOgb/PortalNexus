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

  it('restores EVM connection passively using eth_accounts without prompting popup', async () => {
    const mockAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const mockProvider = {
      request: vi.fn().mockImplementation(({ method }) => {
        if (method === 'eth_accounts') return Promise.resolve([mockAddress]);
        if (method === 'eth_chainId') return Promise.resolve(PORTALDOT_CHAIN_ID_HEX);
        if (method === 'eth_getBalance') return Promise.resolve('0x1bc16d674ec80000'); // 2.0 POT in wei
        return Promise.resolve(null);
      })
    };

    const service = new EvmWalletService(mockProvider);
    const restored = await service.checkExistingConnection();

    expect(restored).toBe(true);
    expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    expect(mockProvider.request).not.toHaveBeenCalledWith({ method: 'eth_requestAccounts' });

    const state = service.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(mockAddress);
    expect(state.chainId).toBe(PORTALDOT_CHAIN_ID_DEC);
    expect(state.isCorrectNetwork).toBe(true);
    expect(state.balancePot).toBe('2.0000');
  });

  it('returns false during passive EVM check when no accounts are authorized', async () => {
    const mockProvider = {
      request: vi.fn().mockImplementation(({ method }) => {
        if (method === 'eth_accounts') return Promise.resolve([]);
        return Promise.resolve(null);
      })
    };

    const service = new EvmWalletService(mockProvider);
    const restored = await service.checkExistingConnection();

    expect(restored).toBe(false);
    expect(service.getState().isConnected).toBe(false);
    expect(service.getState().address).toBeNull();
  });

  it('handles EVM account switching and network changes via event listeners without duplicating', async () => {
    const eventHandlers: Record<string, Function> = {};
    const mockProvider = {
      request: vi.fn().mockImplementation(({ method }) => {
        if (method === 'eth_accounts') return Promise.resolve(['0x1111111111111111111111111111111111111111']);
        if (method === 'eth_chainId') return Promise.resolve(PORTALDOT_CHAIN_ID_HEX);
        if (method === 'eth_getBalance') return Promise.resolve('0xde0b6b3a7640000');
        return Promise.resolve(null);
      }),
      on: vi.fn().mockImplementation((event, handler) => {
        eventHandlers[event] = handler;
      })
    };

    const service = new EvmWalletService(mockProvider);
    await service.checkExistingConnection();

    // Verify listeners registered once
    expect(mockProvider.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
    expect(mockProvider.on).toHaveBeenCalledWith('chainChanged', expect.any(Function));

    // Calling initListeners again (e.g. on React StrictMode remount) does NOT register duplicate listeners
    service.initListeners();
    expect(mockProvider.on).toHaveBeenCalledTimes(2);

    // Simulate account switch
    const newAddress = '0x2222222222222222222222222222222222222222';
    eventHandlers['accountsChanged']([newAddress]);
    expect(service.getState().address).toBe(newAddress);

    // Simulate disconnect from wallet extension
    eventHandlers['accountsChanged']([]);
    expect(service.getState().isConnected).toBe(false);
    expect(service.getState().address).toBeNull();
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

  it('safely attempts autoReconnect and restores previously authorized account from localStorage', async () => {
    const mockAccounts = [
      { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', name: 'Alice' },
      { address: '5GmZebxRusZB3XpVfqmvZBRphbnv9EQkVLjctSZ57nzgof83', name: 'Sender' }
    ];

    const mockInjectedInstance = {
      signer: { signPayload: vi.fn() },
      accounts: {
        get: vi.fn().mockResolvedValue(mockAccounts),
        subscribe: vi.fn()
      }
    };

    const mockInjectedWeb3 = {
      talisman: {
        enable: vi.fn().mockResolvedValue(mockInjectedInstance)
      }
    };

    const mockStorage: Record<string, string> = {
      portalnexus_preferred_sub_ext: 'talisman',
      portalnexus_preferred_sub_addr: '5GmZebxRusZB3XpVfqmvZBRphbnv9EQkVLjctSZ57nzgof83'
    };

    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      injectedWeb3: mockInjectedWeb3,
      localStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; }
      } as unknown as Storage
    };

    const mockRpc = {
      queryAccountBalance: vi.fn().mockResolvedValue({
        free: '107897009053413887',
        formatted: '1078.9700 tPOT'
      })
    };

    const service = new SubstrateWalletService(mockRpc as any);
    const success = await service.autoReconnect();

    expect(success).toBe(true);
    expect(mockInjectedWeb3.talisman.enable).toHaveBeenCalledWith('PortalNexus');
    expect(service.getState().isConnected).toBe(true);
    // Selected account should match preferred address
    expect(service.getState().selectedAccount?.address).toBe('5GmZebxRusZB3XpVfqmvZBRphbnv9EQkVLjctSZ57nzgof83');
    expect(service.getState().selectedAccount?.name).toBe('Sender');
    expect(service.getState().balanceFormatted).toBe('1078.9700 tPOT');

    globalThis.window = originalWindow;
  });

  it('fails safely during autoReconnect when user revoked permission in wallet', async () => {
    const mockInjectedWeb3 = {
      polkadotJs: {
        enable: vi.fn().mockRejectedValue(new Error('User rejected authorization request'))
      }
    };

    const mockStorage: Record<string, string> = {
      portalnexus_preferred_sub_ext: 'polkadotJs',
      portalnexus_preferred_sub_addr: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    };

    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      injectedWeb3: mockInjectedWeb3,
      localStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; }
      } as unknown as Storage
    };

    const service = new SubstrateWalletService();
    const success = await service.autoReconnect();

    expect(success).toBe(false);
    expect(service.getState().isConnected).toBe(false);
    expect(service.getState().selectedAccount).toBeNull();
    // Preferences should be cleared so it does not retry endlessly
    expect(mockStorage['portalnexus_preferred_sub_ext']).toBeUndefined();

    globalThis.window = originalWindow;
  });

  it('clears localStorage preferences when user explicitly disconnects Substrate wallet', () => {
    const mockStorage: Record<string, string> = {
      portalnexus_preferred_sub_ext: 'talisman',
      portalnexus_preferred_sub_addr: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    };

    const originalWindow = globalThis.window;
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; }
      } as unknown as Storage
    };

    const service = new SubstrateWalletService();
    service.disconnect();

    expect(mockStorage['portalnexus_preferred_sub_ext']).toBeUndefined();
    expect(mockStorage['portalnexus_preferred_sub_addr']).toBeUndefined();
    expect(service.getState().isConnected).toBe(false);

    globalThis.window = originalWindow;
  });
});
