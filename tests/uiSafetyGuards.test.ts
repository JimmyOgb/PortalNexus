import { describe, it, expect } from 'vitest';
import { CONTRACT_REGISTRY, NETWORK_CONFIG } from '../src/contracts/config';

describe('UI Safety Guards & Verified Testnet Deployment Barrier', () => {
  it('confirms deployed contracts are verified on Portaldot V3 Testnet', () => {
    // WPOT is omitted in Architecture A (Native POT direct pool)
    expect(CONTRACT_REGISTRY.wpot.deployedAddress).toBeNull();
    expect(CONTRACT_REGISTRY.wpot.isDeployed).toBe(false);

    // TestUSDC is deployed and verified on-chain
    expect(CONTRACT_REGISTRY.testUSDC.deployedAddress).toBe('0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002');
    expect(CONTRACT_REGISTRY.testUSDC.isDeployed).toBe(true);
    expect(CONTRACT_REGISTRY.testUSDC.statusText).toContain('Verified on Portaldot V3 Testnet');

    // NexusAMM is deployed and verified on-chain
    expect(CONTRACT_REGISTRY.nexusAMM.deployedAddress).toBe('0x407A2609dfd5336a38D6274B1EFc1804930f160A');
    expect(CONTRACT_REGISTRY.nexusAMM.isDeployed).toBe(true);
    expect(CONTRACT_REGISTRY.nexusAMM.statusText).toContain('Verified on Portaldot V3 Testnet');

    // NexusReceipt is unified inside NexusAMMNative
    expect(CONTRACT_REGISTRY.nexusReceipt.deployedAddress).toBe('0x407A2609dfd5336a38D6274B1EFc1804930f160A');
    expect(CONTRACT_REGISTRY.nexusReceipt.isDeployed).toBe(true);
    expect(CONTRACT_REGISTRY.nexusReceipt.statusText).toContain('Verified on Portaldot V3 Testnet');
  });

  it('strictly specifies Portaldot V3 parameters without fabrication', () => {
    expect(NETWORK_CONFIG.chainIdDec).toBe(420420777);
    expect(NETWORK_CONFIG.chainIdHex).toBe('0x190f1ca9');
    expect(NETWORK_CONFIG.evmRpcUrl).toBe('https://test-evm-rpc-v3.portaldot.dev');
    expect(NETWORK_CONFIG.substrateWsUrl).toBe('wss://test-node-v3.portaldot.dev');
    expect(NETWORK_CONFIG.nativeCurrency.substrateDecimals).toBe(14);
    expect(NETWORK_CONFIG.nativeCurrency.decimals).toBe(18);
    expect(NETWORK_CONFIG.nativeCurrency.ss58Prefix).toBe(42);
  });

  it('documents that WPOT wraps EVM-native POT only and not Substrate POT', () => {
    expect(CONTRACT_REGISTRY.wpot.description).toContain('EVM-native POT currency wrapper');
    expect(CONTRACT_REGISTRY.wpot.description).toContain('Does NOT wrap Substrate POT');
  });

  it('documents that pUSDC is a test simulation token with zero backing', () => {
    expect(CONTRACT_REGISTRY.testUSDC.description).toContain('Zero real-world backing');
  });
});
