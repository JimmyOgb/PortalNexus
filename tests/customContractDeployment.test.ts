import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encodeConstructorArgs,
  encodeSingleValue,
  isDynamicType,
  ConstructorParam
} from '../src/lib/abiEncoder';
import {
  DeploymentService
} from '../src/services/deploymentService';
import { EvmRpcClient } from '../src/services/evmRpc';
import { EvmWalletService, PORTALDOT_CHAIN_ID_DEC } from '../src/services/evmWallet';
import { validateSourceFile, parseStandardOutput } from '../src/services/compilerService';

describe('Custom Contract Deployment Interface (Stage 3C)', () => {
  describe('File Upload & Source Validation', () => {
    it('accepts valid .sol file under 500 KB limit', () => {
      const res = validateSourceFile('MyToken.sol', 2048, 'contract MyToken {}');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects unsupported file formats (.js, .txt, .rs)', () => {
      expect(validateSourceFile('Contract.js', 100).valid).toBe(false);
      expect(validateSourceFile('Readme.txt', 100).valid).toBe(false);
      expect(validateSourceFile('lib.rs', 100).valid).toBe(false);
    });

    it('rejects oversized files exceeding 500 KB', () => {
      const res = validateSourceFile('Huge.sol', 500 * 1024 + 1);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds the maximum allowed limit of 500 KB');
    });

    it('rejects empty files', () => {
      const res = validateSourceFile('Empty.sol', 0, '   ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Solidity source file is empty');
    });
  });

  describe('Dynamic Constructor ABI Encoding', () => {
    it('correctly identifies dynamic types', () => {
      expect(isDynamicType('string')).toBe(true);
      expect(isDynamicType('bytes')).toBe(true);
      expect(isDynamicType('uint256[]')).toBe(true);
      expect(isDynamicType('address[]')).toBe(true);
      expect(isDynamicType('uint256')).toBe(false);
      expect(isDynamicType('address')).toBe(false);
      expect(isDynamicType('bool')).toBe(false);
      expect(isDynamicType('bytes32')).toBe(false);
    });

    it('encodes primitive static types correctly', () => {
      // Bool
      expect(encodeSingleValue('bool', true).head).toBe(
        '0000000000000000000000000000000000000000000000000000000000000001'
      );
      expect(encodeSingleValue('bool', 'false').head).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      );

      // Address
      const addrHex = '0x1111111111111111111111111111111111111111';
      expect(encodeSingleValue('address', addrHex).head).toBe(
        '0000000000000000000000001111111111111111111111111111111111111111'
      );

      // Uint256
      expect(encodeSingleValue('uint256', '42').head).toBe(
        '000000000000000000000000000000000000000000000000000000000000002a'
      );
    });

    it('encodes contracts without constructor parameters into empty hex', () => {
      const res = encodeConstructorArgs([], {});
      expect(res.success).toBe(true);
      expect(res.encodedHex).toBe('');
    });

    it('encodes mixed static and dynamic constructor arguments compliant with ABI specs', () => {
      const params: ConstructorParam[] = [
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'initialSupply', type: 'uint256' },
        { name: 'owner', type: 'address' },
        { name: 'active', type: 'bool' }
      ];

      const values = {
        name: 'Portal Token',
        symbol: 'POT',
        initialSupply: '1000',
        owner: '0x2222222222222222222222222222222222222222',
        active: 'true'
      };

      const res = encodeConstructorArgs(params, values);
      expect(res.success).toBe(true);
      expect(res.encodedHex).toBeDefined();
      expect(res.encodedHex?.startsWith('0x')).toBe(true);

      // Check head length: 5 parameters * 32 bytes * 2 hex chars = 320 hex characters (+2 for 0x)
      const clean = res.encodedHex!.slice(2);
      expect(clean.length).toBeGreaterThan(320);

      // First dynamic offset points to 5 * 32 = 160 bytes = 0xa0
      const firstOffset = clean.slice(0, 64);
      expect(BigInt('0x' + firstOffset)).toBe(160n);
    });

    it('detects and flags invalid constructor arguments', () => {
      const params: ConstructorParam[] = [
        { name: 'owner', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ];

      // Missing required field
      const missingRes = encodeConstructorArgs(params, { owner: '0x1111111111111111111111111111111111111111' });
      expect(missingRes.success).toBe(false);
      expect(missingRes.fieldErrors?.amount).toContain('is required');

      // Invalid address format
      const badAddrRes = encodeConstructorArgs(params, {
        owner: '0xnotanaddress',
        amount: '100'
      });
      expect(badAddrRes.success).toBe(false);
      expect(badAddrRes.fieldErrors?.owner).toContain('Invalid address format');

      // Negative unsigned int
      const negUintRes = encodeConstructorArgs(params, {
        owner: '0x1111111111111111111111111111111111111111',
        amount: '-50'
      });
      expect(negUintRes.success).toBe(false);
      expect(negUintRes.fieldErrors?.amount).toContain('cannot be negative');
    });
  });

  describe('Multiple Contract Selection from Compiler Output', () => {
    it('parses compiler output with multiple contracts and allows selecting target', () => {
      const mockOutput = {
        contracts: {
          'Multi.sol': {
            Token: {
              abi: [{ type: 'constructor', inputs: [{ name: 'supply', type: 'uint256' }] }],
              evm: { bytecode: { object: '6080604052' }, deployedBytecode: { object: '6080' } }
            },
            TokenSale: {
              abi: [{ type: 'constructor', inputs: [{ name: 'tokenAddr', type: 'address' }] }],
              evm: { bytecode: { object: '608060405234' }, deployedBytecode: { object: '608052' } }
            }
          }
        }
      };

      const parsed = parseStandardOutput(mockOutput, 'Multi.sol');
      const names = Object.keys(parsed);
      expect(names).toEqual(['Token', 'TokenSale']);

      expect(parsed.Token.name).toBe('Token');
      expect(parsed.Token.constructorParams).toHaveLength(1);
      expect(parsed.Token.constructorParams[0].name).toBe('supply');

      expect(parsed.TokenSale.name).toBe('TokenSale');
      expect(parsed.TokenSale.constructorParams[0].type).toBe('address');
    });
  });

  describe('Deployment Plan Preparation & Preflight Verification', () => {
    let mockRpc: any;
    let mockWallet: any;
    let deploymentService: DeploymentService;

    beforeEach(() => {
      mockRpc = {
        query: vi.fn(async (method: string) => {
          if (method === 'eth_estimateGas') {
            return { result: '0x39a73e7b802b3' };
          }
          if (method === 'eth_gasPrice') {
            return { result: '0x675c' }; // 26,460 wei
          }
          if (method === 'eth_chainId') {
            return { result: '0x190f1ca9' }; // 420420777
          }
          return { result: null };
        })
      };

      mockWallet = {
        getState: vi.fn(() => ({
          isConnected: true,
          address: '0x1234567890123456789012345678901234567890',
          chainId: PORTALDOT_CHAIN_ID_DEC,
          isCorrectNetwork: true,
          balancePot: '50.0'
        }))
      };

      deploymentService = new DeploymentService(
        mockRpc as unknown as EvmRpcClient,
        mockWallet as unknown as EvmWalletService
      );
    });

    it('rejects deployment preparation when EVM wallet is disconnected', async () => {
      mockWallet.getState.mockReturnValue({
        isConnected: false,
        address: null,
        chainId: null,
        isCorrectNetwork: false,
        balancePot: null
      });

      const plan = await deploymentService.prepareCustomDeployment({
        contractName: 'TestToken',
        fileName: 'TestToken.sol',
        bytecode: '0x60806040',
        abi: [],
        constructorParams: [],
        paramValues: {}
      });

      expect(plan.isValid).toBe(false);
      expect(plan.validationError).toContain('EVM wallet is not connected');
    });

    it('rejects deployment preparation when connected to wrong network', async () => {
      mockWallet.getState.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1, // Mainnet
        isCorrectNetwork: false,
        balancePot: '10.0'
      });

      const plan = await deploymentService.prepareCustomDeployment({
        contractName: 'TestToken',
        fileName: 'TestToken.sol',
        bytecode: '0x60806040',
        abi: [],
        constructorParams: [],
        paramValues: {}
      });

      expect(plan.isValid).toBe(false);
      expect(plan.validationError).toContain('switch your wallet to Portaldot V3 Testnet');
    });

    it('rejects deployment preparation when account balance is insufficient for gas', async () => {
      mockWallet.getState.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890',
        chainId: PORTALDOT_CHAIN_ID_DEC,
        isCorrectNetwork: true,
        balancePot: '0.00000001' // extremely small balance
      });

      // Mock high gas estimate
      mockRpc.query.mockImplementation(async (method: string) => {
        if (method === 'eth_estimateGas') return { result: '0x55d4a80' }; // 90M gas
        if (method === 'eth_gasPrice') return { result: '0x3b9aca00' }; // 1 Gwei
        return { result: null };
      });

      const plan = await deploymentService.prepareCustomDeployment({
        contractName: 'HeavyContract',
        fileName: 'Heavy.sol',
        bytecode: '0x60806040',
        abi: [],
        constructorParams: [],
        paramValues: {}
      });

      expect(plan.isSufficientBalance).toBe(false);
      expect(plan.isValid).toBe(false);
      expect(plan.validationError).toContain('is less than the estimated gas fee');
    });

    it('successfully prepares a valid custom deployment plan with live gas estimates', async () => {
      const plan = await deploymentService.prepareCustomDeployment({
        contractName: 'SimpleToken',
        fileName: 'SimpleToken.sol',
        bytecode: '0x6080604052348015',
        abi: [
          {
            type: 'constructor',
            inputs: [{ name: 'initialSupply', type: 'uint256' }]
          }
        ],
        constructorParams: [{ name: 'initialSupply', type: 'uint256' }],
        paramValues: { initialSupply: '500000' }
      });

      expect(plan.isValid).toBe(true);
      expect(plan.contractName).toBe('SimpleToken');
      expect(plan.deployerAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(plan.chainId).toBe(PORTALDOT_CHAIN_ID_DEC);
      expect(plan.isCorrectNetwork).toBe(true);
      expect(plan.encodedConstructorArgs).toBe(
        '0x000000000000000000000000000000000000000000000000000000000007a120'
      );
      expect(plan.creationBytecode).toBe(
        '0x6080604052348015000000000000000000000000000000000000000000000000000000000007a120'
      );
      expect(plan.isSufficientBalance).toBe(true);
      expect(parseFloat(plan.estimatedGasFeePot)).toBeGreaterThan(0);
      expect(plan.warnings.length).toBeGreaterThan(0);
      expect(plan.warnings.some(w => w.includes('Pallet-revive'))).toBe(true);
    });
  });

  describe('Deployment Verification Logic & Duplicate Prevention', () => {
    let mockRpc: any;
    let mockWallet: any;
    let deploymentService: DeploymentService;

    beforeEach(() => {
      mockRpc = {
        query: vi.fn()
      };
      mockWallet = {
        getState: vi.fn(() => ({ isConnected: true, address: '0xDeployer' }))
      };
      deploymentService = new DeploymentService(
        mockRpc as unknown as EvmRpcClient,
        mockWallet as unknown as EvmWalletService
      );
    });

    it('verifies deployed contract on-chain when receipt is confirmed and bytecode exists', async () => {
      const txHash = '0xabc1237890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const contractAddress = '0xContractAddress123456789012345678901234';

      mockRpc.query.mockImplementation(async (method: string) => {
        if (method === 'eth_getTransactionReceipt') {
          return {
            result: {
              blockNumber: '0x3e120',
              status: '0x1',
              contractAddress,
              gasUsed: '0x12c0'
            }
          };
        }
        if (method === 'eth_getCode') {
          return { result: '0x6080604052348015' }; // non-empty deployed bytecode
        }
        return { result: null };
      });

      const res = await deploymentService.verifyCustomDeployment(txHash);
      expect(res.success).toBe(true);
      expect(res.contractAddress).toBe(contractAddress);
      expect(res.blockNumber).toBe(254240);
      expect(res.explorerUrl).toContain(contractAddress);
    });

    it('fails verification if deployment transaction reverted on-chain', async () => {
      const txHash = '0xrevertedtx';
      mockRpc.query.mockImplementation(async (method: string) => {
        if (method === 'eth_getTransactionReceipt') {
          return {
            result: {
              blockNumber: '0x3e120',
              status: '0x0', // Reverted
              contractAddress: null
            }
          };
        }
        return { result: null };
      });

      const res = await deploymentService.verifyCustomDeployment(txHash);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Deployment transaction reverted on-chain');
    });

    it('fails verification if deployed address contains empty bytecode on-chain', async () => {
      const txHash = '0xemptybytecode';
      mockRpc.query.mockImplementation(async (method: string) => {
        if (method === 'eth_getTransactionReceipt') {
          return {
            result: {
              blockNumber: '0x3e120',
              status: '0x1',
              contractAddress: '0x0000000000000000000000000000000000001234'
            }
          };
        }
        if (method === 'eth_getCode') {
          return { result: '0x' }; // empty bytecode
        }
        return { result: null };
      });

      const res = await deploymentService.verifyCustomDeployment(txHash);
      expect(res.success).toBe(false);
      expect(res.error).toContain('contains empty bytecode on-chain');
    });
  });
});
