/**
 * Contract Configurations & Verified Network Parameters
 *
 * Mode: LOCAL-FIRST · ZERO-SIMULATION · FAIL-CLOSED
 * Contract deployment to Portaldot V3 is pending community faucet tokens.
 * All public chain writes remain disabled by safety barrier.
 */

export const NETWORK_CONFIG = {
  chainIdDec: 420420777,
  chainIdHex: '0x190f1ca9',
  chainName: 'Portaldot V3 Testnet',
  nativeCurrency: {
    name: 'Portaldot',
    symbol: 'POT',
    decimals: 18,
    substrateDecimals: 14,
    ss58Prefix: 42
  },
  evmRpcUrl: 'https://test-evm-rpc-v3.portaldot.dev',
  substrateWsUrl: 'wss://test-node-v3.portaldot.dev',
  explorerUrl: 'https://node-console.portaldot.dev/'
} as const;

import { PORTAL_TEST_STORAGE_ABI } from './abi';

/**
 * Verified Architecture A deployment (source: contracts/deployment-receipt-arch-a.json).
 * Addresses are the single source of truth for the live-integration layer.
 */
export const LIVE_DEPLOYMENT = {
  pusdcAddress: '0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002',
  pusdcDeployBlock: 237279,
  pusdcDeployTxHash: '0x4534608666225d9fba0f8c69a28dd29c4130825b06a5160c33e6beec1b225152',
  ammAddress: '0x407A2609dfd5336a38D6274B1EFc1804930f160A',
  ammDeployBlock: 237284,
  ammDeployTxHash: '0x48cd085966cc570984aa4883d05ed3c26de9ade7d4296f909cc47f6ae0e9ba54',
  deployerAddress: '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A',
  pusdcDecimals: 6,
  potDecimals: 18,
  faucetMaxPerCallBase: 10_000n * 10n ** 6n,
  tokenDisclosure: 'pUSDC is an unrestricted Portaldot testnet simulation token. It has no real-world value and no backing. Faucet minting is capped per call, not in total supply.'
} as const;

/** Canonical immutable built-in deployment constants (SEC-03 preservation). */
export const BUILTIN_DEPLOYMENT = LIVE_DEPLOYMENT;

export interface VerifiedContract {
  id: string;
  name: string;
  address: string;
  chainId: number;
  network: string;
  deployer: string;
  deploymentTxHash: string;
  blockNumber: number;
  verified: boolean;
  verificationMetadata: {
    verifiedOnChain: boolean;
    verifiedRuntimeBytecodeSize: number;
    verificationTimestamp: string;
    verifiedGetters: Record<string, string>;
    explorerUrl: string;
    txExplorerUrl: string;
  };
  abi: readonly any[];
}

/**
 * Verified Stage 3D PortalTestStorage deployment
 * Source of truth: contracts/deployment-receipt-stage3d.json & on-chain Block #261857
 */
export const PORTAL_TEST_STORAGE_DEPLOYMENT: VerifiedContract = {
  id: 'portalTestStorage',
  name: 'PortalTestStorage',
  address: '0x5065125265638A4b354FDDfe1f9339F65cC9f6F8',
  chainId: 420420777,
  network: 'Portaldot V3.0 Testnet',
  deployer: '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A',
  deploymentTxHash: '0x3ff04400eab1b83d221444f5cd2ff829a39154c54c7562dea7dbc06ae304722e',
  blockNumber: 261857,
  verified: true,
  verificationMetadata: {
    verifiedOnChain: true,
    verifiedRuntimeBytecodeSize: 275,
    verificationTimestamp: '2026-10-31T04:04:39.928Z',
    verifiedGetters: {
      'getValue()': '42',
      'creator()': '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A'
    },
    explorerUrl: 'https://explorer.portaldot.dev/address/0x5065125265638A4b354FDDfe1f9339F65cC9f6F8',
    txExplorerUrl: 'https://explorer.portaldot.dev/tx/0x3ff04400eab1b83d221444f5cd2ff829a39154c54c7562dea7dbc06ae304722e'
  },
  abi: PORTAL_TEST_STORAGE_ABI
};

export interface ContractDescriptor {
  name: string;
  symbol?: string;
  decimals?: number;
  deployedAddress: string | null;
  isDeployed: boolean;
  statusText: string;
  description: string;
  chainId?: number;
  network?: string;
  deployerAddress?: string;
  deploymentTxHash?: string;
  blockNumber?: number;
  abi?: readonly any[];
  verificationMetadata?: {
    verifiedOnChain: boolean;
    verificationTimestamp: string;
    verifiedRuntimeBytecodeSize: number;
    verifiedGetters?: Record<string, string>;
    explorerUrl?: string;
    txExplorerUrl?: string;
  };
}

export const CONTRACT_REGISTRY: Record<'wpot' | 'testUSDC' | 'nexusAMM' | 'nexusReceipt' | 'portalTestStorage', ContractDescriptor> = {
  wpot: {
    name: 'Wrapped POT',
    symbol: 'WPOT',
    decimals: 18,
    deployedAddress: null,
    isDeployed: false,
    statusText: 'Omitted in Architecture A (Native POT Direct Pair)',
    description: 'EVM-native POT currency wrapper ERC-20 with 1:1 backing invariant. Does NOT wrap Substrate POT. Omitted in Architecture A in favor of direct Native POT pool.'
  },
  testUSDC: {
    name: 'Portal Test USD',
    symbol: 'pUSDC',
    decimals: 6,
    deployedAddress: '0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Block #237279)',
    description: 'Testnet simulation token capped at 10,000 pUSDC per faucet call (no total supply cap). Zero real-world backing.'
  },
  nexusAMM: {
    name: 'Nexus AMM Constant Product Pool (Native POT / pUSDC)',
    deployedAddress: '0x407A2609dfd5336a38D6274B1EFc1804930f160A',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Block #237284)',
    description: 'Constant-product AMM (x * y = k) pairing Native POT with pUSDC with 0.3% fee and unified non-transferable LP receipts.'
  },
  nexusReceipt: {
    name: 'Nexus LP Position Receipt',
    symbol: 'NX-LP',
    deployedAddress: '0x407A2609dfd5336a38D6274B1EFc1804930f160A',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Unified AMM Authority)',
    description: 'Internal LP position tracking unified inside NexusAMMNative. Positions are non-transferable (soulbound to depositor) and redeemed via removeLiquidity. (Contrast with Architecture B transferable receipts).'
  },
  portalTestStorage: {
    name: 'PortalTestStorage',
    deployedAddress: '0x5065125265638A4b354FDDfe1f9339F65cC9f6F8',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Block #261857)',
    description: 'Ultra-minimal verification storage contract. Immutable creator 0xdC7f...8A2A, initial value 42, zero external imports.',
    chainId: 420420777,
    network: 'Portaldot V3.0 Testnet',
    deployerAddress: '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A',
    deploymentTxHash: '0x3ff04400eab1b83d221444f5cd2ff829a39154c54c7562dea7dbc06ae304722e',
    blockNumber: 261857,
    abi: PORTAL_TEST_STORAGE_ABI,
    verificationMetadata: PORTAL_TEST_STORAGE_DEPLOYMENT.verificationMetadata
  }
};
