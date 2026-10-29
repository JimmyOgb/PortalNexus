import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DeploymentService,
  encodeAmmConstructorArgs,
  decodeAbiString,
  decodeAbiAddress,
  SELECTORS
} from '../src/services/deploymentService';
import { PORTALDOT_CHAIN_ID_DEC } from '../src/services/evmWallet';
import { CONTRACT_REGISTRY } from '../src/contracts/config';

describe('DeploymentService & Option A Wallet Flow', () => {
  let mockRpc: any;
  let mockWallet: any;
  let mockProvider: any;
  let service: DeploymentService;

  beforeEach(() => {
    mockRpc = {
      getState: vi.fn().mockReturnValue({
        gasPriceWei: '28015',
        gasPriceGwei: '0.000028',
        blockHeight: 231580
      }),
      query: vi.fn()
    };

    mockProvider = {
      request: vi.fn()
    };

    mockWallet = {
      getState: vi.fn().mockReturnValue({
        isConnected: true,
        address: '0x1111111111111111111111111111111111111111',
        chainId: PORTALDOT_CHAIN_ID_DEC,
        isCorrectNetwork: true,
        balanceWei: '1000000000000000000', // 1 POT
        balancePot: '1.0000',
        error: null
      }),
      refreshBalance: vi.fn().mockResolvedValue(undefined),
      provider: mockProvider
    };

    service = new DeploymentService(mockRpc, mockWallet);
  });

  describe('ABI & Constructor Argument Encoding', () => {
    it('correctly encodes two 20-byte addresses into two 32-byte ABI words', () => {
      const tokenA = '0x1234567890123456789012345678901234567890';
      const tokenB = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      const encoded = encodeAmmConstructorArgs(tokenA, tokenB);

      expect(encoded.length).toBe(128); // 2 words * 64 hex characters
      expect(encoded.startsWith('0000000000000000000000001234567890123456789012345678901234567890')).toBe(true);
      expect(encoded.endsWith('000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBe(true);
    });

    it('correctly decodes ABI string results', () => {
      // "Wrapped POT" in ABI encoding: offset 32, len 11, ASCII
      const hex = '0x' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '000000000000000000000000000000000000000000000000000000000000000b' +
        Buffer.from('Wrapped POT').toString('hex').padEnd(64, '0');

      const decoded = decodeAbiString(hex);
      expect(decoded).toBe('Wrapped POT');
    });

    it('correctly decodes ABI address results', () => {
      const hex = '0x0000000000000000000000001234567890123456789012345678901234567890';
      const decoded = decodeAbiAddress(hex);
      expect(decoded).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('Preflight & Network Safety Checks', () => {
    it('fails preflight if wallet is disconnected', async () => {
      mockWallet.getState.mockReturnValue({
        isConnected: false,
        address: null,
        chainId: null,
        isCorrectNetwork: false,
        balancePot: null
      });

      const pf = await service.runPreflight('wpot');
      expect(pf.passed).toBe(false);
      expect(pf.error).toContain('Wallet not connected');
    });

    it('fails preflight if wallet is on wrong chain ID (e.g. Chain 1 Ethereum)', async () => {
      mockWallet.getState.mockReturnValue({
        isConnected: true,
        address: '0x1111111111111111111111111111111111111111',
        chainId: 1,
        isCorrectNetwork: false,
        balancePot: '5.0000'
      });

      const pf = await service.runPreflight('wpot');
      expect(pf.passed).toBe(false);
      expect(pf.error).toContain('Connected to Chain ID 1');
      expect(pf.error).toContain('420420777');
    });

    it('passes preflight when connected to Chain 420420777 with sufficient POT balance', async () => {
      const pf = await service.runPreflight('wpot');
      expect(pf.passed).toBe(true);
      expect(pf.chainId).toBe(PORTALDOT_CHAIN_ID_DEC);
      expect(pf.isCorrectNetwork).toBe(true);
      expect(pf.error).toBeNull();
    });
  });

  describe('Step Enforcement & Sequencing', () => {
    it('refuses to deploy TestUSDC before WPotToken is verified', async () => {
      const success = await service.deployTestUSDC();
      expect(success).toBe(false);
      expect(service.getState().lastError).toContain('Cannot deploy TestUSDC before WPotToken is verified');
    });

    it('refuses to deploy NexusAMM before both WPotToken and TestUSDC are verified', async () => {
      const success = await service.deployNexusAMM();
      expect(success).toBe(false);
      expect(service.getState().lastError).toContain('Both WPotToken and TestUSDC must be verified');
    });

    it('handles user cancellation (error code 4001) in MetaMask cleanly without crashing', async () => {
      mockProvider.request.mockRejectedValue({ code: 4001, message: 'User rejected the request.' });

      const success = await service.deployWPot();
      expect(success).toBe(false);
      expect(service.getState().step).toBe('ERROR');
      expect(service.getState().lastError).toContain('rejected by user');
    });
  });

  describe('Full Step-by-Step Flow with Verification', () => {
    it('executes WPotToken, TestUSDC, and NexusAMM sequentially with on-chain checks', async () => {
      const mockWpotAddr = '0x1000000000000000000000000000000000000001';
      const mockUsdcAddr = '0x2000000000000000000000000000000000000002';
      const mockAmmAddr = '0x3000000000000000000000000000000000000003';
      const mockReceiptAddr = '0x4000000000000000000000000000000000000004';

      // 1. Deploy WPot
      mockProvider.request.mockResolvedValueOnce('0xhash_wpot');
      mockRpc.query.mockImplementation(async (method: string, params: any[]) => {
        if (method === 'eth_getTransactionReceipt') {
          return { result: { blockNumber: '0x10', gasUsed: '0x80000', status: '0x1', contractAddress: mockWpotAddr } };
        }
        if (method === 'eth_getCode') {
          return { result: '0x60806040...' };
        }
        if (method === 'eth_call' && params[0].data === SELECTORS.name) {
          // returns "Wrapped POT"
          return {
            result: '0x' +
              '0000000000000000000000000000000000000000000000000000000000000020' +
              '000000000000000000000000000000000000000000000000000000000000000b' +
              Buffer.from('Wrapped POT').toString('hex').padEnd(64, '0')
          };
        }
        return { result: '0x0' };
      });

      const wpotSuccess = await service.deployWPot();
      expect(wpotSuccess).toBe(true);
      expect(service.getState().wpot.verified).toBe(true);
      expect(service.getState().wpot.deployedAddress).toBe(mockWpotAddr);

      // 2. Deploy TestUSDC
      mockProvider.request.mockResolvedValueOnce('0xhash_usdc');
      mockRpc.query.mockImplementation(async (method: string, params: any[]) => {
        if (method === 'eth_getTransactionReceipt') {
          return { result: { blockNumber: '0x11', gasUsed: '0x70000', status: '0x1', contractAddress: mockUsdcAddr } };
        }
        if (method === 'eth_getCode') {
          return { result: '0x60806040...' };
        }
        if (method === 'eth_call' && params[0].data === SELECTORS.name) {
          return {
            result: '0x' +
              '0000000000000000000000000000000000000000000000000000000000000020' +
              '000000000000000000000000000000000000000000000000000000000000000f' +
              Buffer.from('Portal Test USD').toString('hex').padEnd(64, '0')
          };
        }
        return { result: '0x0' };
      });

      const usdcSuccess = await service.deployTestUSDC();
      expect(usdcSuccess).toBe(true);
      expect(service.getState().testUSDC.verified).toBe(true);

      // 3. Deploy NexusAMM
      mockProvider.request.mockResolvedValueOnce('0xhash_amm');
      mockRpc.query.mockImplementation(async (method: string, params: any[]) => {
        if (method === 'eth_getTransactionReceipt') {
          return { result: { blockNumber: '0x12', gasUsed: '0x200000', status: '0x1', contractAddress: mockAmmAddr } };
        }
        if (method === 'eth_getCode') {
          return { result: '0x60806040...' };
        }
        if (method === 'eth_call') {
          const to = params[0].to.toLowerCase();
          const data = params[0].data;

          if (to === mockAmmAddr.toLowerCase()) {
            if (data === SELECTORS.token0) {
              return { result: '0x' + mockWpotAddr.slice(2).padStart(64, '0') };
            }
            if (data === SELECTORS.token1) {
              return { result: '0x' + mockUsdcAddr.slice(2).padStart(64, '0') };
            }
            if (data === SELECTORS.receiptContract) {
              return { result: '0x' + mockReceiptAddr.slice(2).padStart(64, '0') };
            }
          }

          if (to === mockReceiptAddr.toLowerCase()) {
            if (data === SELECTORS.amm) {
              return { result: '0x' + mockAmmAddr.slice(2).padStart(64, '0') };
            }
          }
        }
        return { result: '0x0' };
      });

      const ammSuccess = await service.deployNexusAMM();
      expect(ammSuccess).toBe(true);
      expect(service.getState().nexusAMM.verified).toBe(true);
      expect(service.getState().nexusReceipt.verified).toBe(true);
      expect(service.getState().nexusReceipt.deployedAddress).toBe(mockReceiptAddr);
      expect(service.getState().step).toBe('ALL_VERIFIED');

      // 4. Commit to configuration
      const committed = service.commitToConfig();
      expect(committed).toBe(true);
      expect(CONTRACT_REGISTRY.wpot.deployedAddress).toBe(mockWpotAddr);
      expect(CONTRACT_REGISTRY.wpot.isDeployed).toBe(true);
      expect(CONTRACT_REGISTRY.nexusAMM.deployedAddress).toBe(mockAmmAddr);
      expect(CONTRACT_REGISTRY.nexusReceipt.deployedAddress).toBe(mockReceiptAddr);
    });
  });
});
