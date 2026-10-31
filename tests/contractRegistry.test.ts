import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ContractInspectionService,
  contractInspectionService
} from '../src/services/contractInspectionService';
import {
  CONTRACT_REGISTRY,
  PORTAL_TEST_STORAGE_DEPLOYMENT
} from '../src/contracts/config';
import { SELECTORS } from '../src/contracts/abi';

describe('Stage 4.1: Contract Registry & Inspection Service', () => {
  const verifiedAddress = '0x5065125265638A4b354FDDfe1f9339F65cC9f6F8';
  const deployerAddress = '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A';

  describe('Registry Configuration & Metadata Integrity', () => {
    it('has PortalTestStorage registered in CONTRACT_REGISTRY with verified status', () => {
      const entry = CONTRACT_REGISTRY.portalTestStorage;
      expect(entry).toBeDefined();
      expect(entry.name).toBe('PortalTestStorage');
      expect(entry.deployedAddress).toBe(verifiedAddress);
      expect(entry.isDeployed).toBe(true);
      expect(entry.chainId).toBe(420420777);
      expect(entry.network).toBe('Portaldot V3.0 Testnet');
      expect(entry.deployerAddress).toBe(deployerAddress);
      expect(entry.blockNumber).toBe(261857);
      expect(entry.deploymentTxHash).toBe('0x3ff04400eab1b83d221444f5cd2ff829a39154c54c7562dea7dbc06ae304722e');
      expect(entry.abi).toBeDefined();
      expect(entry.abi?.length).toBeGreaterThan(0);
    });

    it('exposes canonical PORTAL_TEST_STORAGE_DEPLOYMENT constants matching on-chain receipt', () => {
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.id).toBe('portalTestStorage');
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.address).toBe(verifiedAddress);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.chainId).toBe(420420777);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verified).toBe(true);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata.verifiedOnChain).toBe(true);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata.verifiedRuntimeBytecodeSize).toBe(275);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata.verifiedGetters['getValue()']).toBe('42');
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata.verifiedGetters['creator()']).toBe(deployerAddress);
      expect(PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata.explorerUrl).toContain(verifiedAddress);
    });

    it('includes all 5 expected selectors in SELECTORS (including PortalTestStorage)', () => {
      expect(SELECTORS.getValue).toBe('0x20965255');
      expect(SELECTORS.creator).toBe('0x02d05d3f');
      expect(SELECTORS.value).toBe('0x3fa4f245');
      expect(SELECTORS.setValue).toBe('0x55241077');
    });
  });

  describe('Contract Inspection Service Lookups', () => {
    it('validates correct EVM addresses and rejects invalid formats', () => {
      expect(contractInspectionService.isValidAddress(verifiedAddress)).toBe(true);
      expect(contractInspectionService.isValidAddress(deployerAddress)).toBe(true);
      expect(contractInspectionService.isValidAddress('0x123')).toBe(false);
      expect(contractInspectionService.isValidAddress('not-an-address')).toBe(false);
      expect(contractInspectionService.isValidAddress('')).toBe(false);
      expect(contractInspectionService.isValidAddress('5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu')).toBe(false);
    });

    it('looks up contract by registry key', () => {
      const contract = contractInspectionService.getContractByKey('portalTestStorage');
      expect(contract).not.toBeNull();
      expect(contract?.name).toBe('PortalTestStorage');
      expect(contract?.deployedAddress).toBe(verifiedAddress);
    });

    it('looks up contract by address (case-insensitive)', () => {
      const matchUpper = contractInspectionService.getContractByAddress(verifiedAddress);
      const matchLower = contractInspectionService.getContractByAddress(verifiedAddress.toLowerCase());
      expect(matchUpper).not.toBeNull();
      expect(matchLower).not.toBeNull();
      expect(matchUpper?.id).toBe('portalTestStorage');
      expect(matchLower?.id).toBe('portalTestStorage');
    });

    it('returns null for unregistered addresses', () => {
      const unknown = contractInspectionService.getContractByAddress('0x0000000000000000000000000000000000000001');
      expect(unknown).toBeNull();
    });

    it('lists all registered contracts including PortalTestStorage and Architecture A', () => {
      const list = contractInspectionService.listRegisteredContracts();
      expect(list.length).toBe(5);
      const ids = list.map((c) => c.id);
      expect(ids).toContain('portalTestStorage');
      expect(ids).toContain('testUSDC');
      expect(ids).toContain('nexusAMM');
      expect(ids).toContain('nexusReceipt');
      expect(ids).toContain('wpot');
    });
  });

  describe('Fail-Closed On-Chain Verification Logic (Mocked RPC)', () => {
    let service: ContractInspectionService;
    let mockFetch: any;
    const originalFetch = global.fetch;

    beforeEach(() => {
      service = new ContractInspectionService('http://mock-rpc');
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('marks isVerified: true when runtime bytecode and getters strictly match expected invariants', async () => {
      mockFetch.mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        if (body.method === 'eth_chainId') return { ok: true, json: async () => ({ result: '0x190f1ca9' }) };
        if (body.method === 'eth_getCode') return { ok: true, json: async () => ({ result: '0x608080604052' + '00'.repeat(270) }) };
        if (body.method === 'eth_call') {
          const callData = body.params[0].data;
          if (callData === SELECTORS.getValue) {
            return {
              ok: true,
              json: async () => ({
                result: '0x000000000000000000000000000000000000000000000000000000000000002a' // 42
              })
            };
          }
          if (callData === SELECTORS.creator) {
            return {
              ok: true,
              json: async () => ({
                result: '0x000000000000000000000000dc7f5c7813a5f0e3f51c2fe569de6c5577768a2a'
              })
            };
          }
        }
        return { ok: true, json: async () => ({ result: '0x0' }) };
      });

      const res = await service.inspectPortalTestStorage();
      expect(res.isVerified).toBe(true);
      expect(res.getValue).toBe(42n);
      expect(res.creator).toBe(deployerAddress.toLowerCase());
      expect(res.runtimeBytecodeSize).toBe(276);
      expect(res.verificationError).toBeUndefined();
    });

    it('fails closed on network mismatch (does NOT mark verified if chain ID != 420420777)', async () => {
      mockFetch.mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        if (body.method === 'eth_chainId') return { ok: true, json: async () => ({ result: '0x1' }) }; // Mainnet
        return { ok: true, json: async () => ({ result: '0x0' }) };
      });

      const res = await service.inspectPortalTestStorage();
      expect(res.isVerified).toBe(false);
      expect(res.verificationError).toContain('Network mismatch');
    });

    it('fails closed when contract bytecode is missing (0x)', async () => {
      mockFetch.mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        if (body.method === 'eth_chainId') return { ok: true, json: async () => ({ result: '0x190f1ca9' }) };
        if (body.method === 'eth_getCode') return { ok: true, json: async () => ({ result: '0x' }) }; // empty code
        return { ok: true, json: async () => ({ result: '0x0' }) };
      });

      const res = await service.inspectPortalTestStorage();
      expect(res.isVerified).toBe(false);
      expect(res.verificationError).toContain('bytecode missing');
    });

    it('fails closed when getValue() returns value other than 42', async () => {
      mockFetch.mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        if (body.method === 'eth_chainId') return { ok: true, json: async () => ({ result: '0x190f1ca9' }) };
        if (body.method === 'eth_getCode') return { ok: true, json: async () => ({ result: '0x1234' }) };
        if (body.method === 'eth_call') {
          const callData = body.params[0].data;
          if (callData === SELECTORS.getValue) {
            return {
              ok: true,
              json: async () => ({
                result: '0x0000000000000000000000000000000000000000000000000000000000000063' // 99 != 42
              })
            };
          }
          if (callData === SELECTORS.creator) {
            return {
              ok: true,
              json: async () => ({
                result: '0x000000000000000000000000dc7f5c7813a5f0e3f51c2fe569de6c5577768a2a'
              })
            };
          }
        }
        return { ok: true, json: async () => ({ result: '0x0' }) };
      });

      const res = await service.inspectPortalTestStorage();
      expect(res.isVerified).toBe(false);
      expect(res.verificationError).toContain('getValue() mismatch');
    });

    it('fails closed when creator() returns a different address', async () => {
      mockFetch.mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);
        if (body.method === 'eth_chainId') return { ok: true, json: async () => ({ result: '0x190f1ca9' }) };
        if (body.method === 'eth_getCode') return { ok: true, json: async () => ({ result: '0x1234' }) };
        if (body.method === 'eth_call') {
          const callData = body.params[0].data;
          if (callData === SELECTORS.getValue) {
            return {
              ok: true,
              json: async () => ({
                result: '0x000000000000000000000000000000000000000000000000000000000000002a' // 42
              })
            };
          }
          if (callData === SELECTORS.creator) {
            return {
              ok: true,
              json: async () => ({
                result: '0x0000000000000000000000000000000000000000000000000000000000000001' // wrong creator
              })
            };
          }
        }
        return { ok: true, json: async () => ({ result: '0x0' }) };
      });

      const res = await service.inspectPortalTestStorage();
      expect(res.isVerified).toBe(false);
      expect(res.verificationError).toContain('Creator mismatch');
    });
  });

  describe('Live Testnet Contract Verification (Direct Real-RPC)', () => {
    it('successfully inspects the live deployed contract at 0x5065125265638A4b354FDDfe1f9339F65cC9f6F8', async () => {
      const liveService = new ContractInspectionService('https://test-evm-rpc-v3.portaldot.dev');
      const inspection = await liveService.inspectPortalTestStorage();

      expect(inspection.chainId).toBe(420420777);
      expect(inspection.contractAddress).toBe(verifiedAddress);
      expect(inspection.runtimeBytecodeSize).toBe(275);
      expect(inspection.getValue).toBe(42n);
      expect(inspection.creator?.toLowerCase()).toBe(deployerAddress.toLowerCase());
      expect(inspection.isVerified).toBe(true);
      expect(inspection.verificationError).toBeUndefined();
    }, 15000);
  });
});
