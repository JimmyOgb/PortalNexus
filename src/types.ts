/**
 * PortalNexus — Stage 1 Foundation Types
 * Real-network data provenance and dual-VM monitoring interfaces.
 */

export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED' | 'ERROR';

export type FreshnessStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'DERIVED';

export interface EndpointConfig {
  name: string;
  url: string;
  protocol: 'WEBSOCKET' | 'HTTP_JSONRPC';
  expectedChainId?: number;
  expectedSpec?: string;
}

export interface SubstrateChainState {
  status: ConnectionStatus;
  endpoint: string;
  systemName: string | null;
  systemChain: string | null;
  systemVersion: string | null;
  specName: string | null;
  specVersion: number | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  ss58Format: number | null;
  blockHeight: number | null;
  blockHash: string | null;
  finalizedBlockHeight: number | null;
  finalizedBlockHash: string | null;
  lastUpdated: number | null;
  latencyMs: number | null;
  freshness: FreshnessStatus;
  error: string | null;
}

export interface EvmChainState {
  status: ConnectionStatus;
  endpoint: string;
  chainId: number | null;
  netVersion: string | null;
  clientVersion: string | null;
  blockHeight: number | null;
  blockHash: string | null;
  blockTimestamp: number | null;
  gasPriceGwei: string | null;
  isSyncing: boolean | null;
  lastUpdated: number | null;
  latencyMs: number | null;
  freshness: FreshnessStatus;
  error: string | null;
}

export interface BlockComparisonSample {
  id: number;
  timestamp: number;
  substrateHeight: number | null;
  evmHeight: number | null;
  diff: number | null; // Substrate - EVM
  status: 'SYNCHRONIZED' | 'SUBSTRATE_AHEAD' | 'EVM_AHEAD' | 'INCOMPLETE';
  note: string;
}

export interface BlockComparisonMetrics {
  sampleCount: number;
  lastDiff: number | null;
  minDiff: number | null;
  maxDiff: number | null;
  avgDiff: number | null;
  verdict: 'CONVERGING' | 'DRIFTING' | 'INSUFFICIENT_SAMPLES' | 'DESYNCHRONIZED' | 'UNAVAILABLE';
  freshness: FreshnessStatus;
  classificationNote: string;
}

export interface ReviveDerivationResult {
  evmAddress: string;
  isValidEvmAddress: boolean;
  paddedAccountId32Hex: string | null;
  ss58Prefix42Address: string | null;
  legacyMoonbeamMismatchWarning: boolean;
  isDeterministicDerivation: boolean;
  isProofOfOwnership: boolean;
  ownershipWarning: string;
  crossVmTransferSupported: boolean;
  explanation: string;
}
