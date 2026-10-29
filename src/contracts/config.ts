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
  tokenDisclosure: 'pUSDC is a Portaldot testnet simulation token. It has no real-world value and no backing.'
} as const;

export interface ContractDescriptor {
  name: string;
  symbol?: string;
  decimals?: number;
  deployedAddress: string | null;
  isDeployed: boolean;
  statusText: string;
  description: string;
}

export const CONTRACT_REGISTRY: Record<'wpot' | 'testUSDC' | 'nexusAMM' | 'nexusReceipt', ContractDescriptor> = {
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
    description: 'Testnet simulation token capped at 10,000 pUSDC per faucet call. Zero real-world backing.'
  },
  nexusAMM: {
    name: 'Nexus AMM Constant Product Pool (Native POT / pUSDC)',
    deployedAddress: '0x407A2609dfd5336a38D6274B1EFc1804930f160A',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Block #237284)',
    description: 'Constant-product AMM (x * y = k) pairing Native POT with pUSDC with 0.3% fee and unified LP receipts.'
  },
  nexusReceipt: {
    name: 'Nexus LP Position Receipt',
    symbol: 'NX-LP',
    deployedAddress: '0x407A2609dfd5336a38D6274B1EFc1804930f160A',
    isDeployed: true,
    statusText: 'Verified on Portaldot V3 Testnet (Unified AMM Authority)',
    description: 'ERC-721 NFT position tracking unified inside NexusAMMNative, burned upon position redemption.'
  }
};
