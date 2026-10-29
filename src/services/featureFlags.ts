/**
 * PortalNexus — Granular Feature Controls & Capability Matrix
 *
 * Replaces the monolithic demo gate (TX_SUBMISSION_ENABLED) with granular,
 * verifiable, state-aware feature gates.
 *
 * Each capability is individually verified against the connected wallet state,
 * target network (Chain ID 420420777), and runtime capabilities.
 */

export interface FeatureControl {
  id: string;
  name: string;
  enabled: boolean;
  requiresWallet: boolean;
  requiresCorrectNetwork: boolean;
  requiresNonZeroReserves?: boolean;
  statusLabel: 'ACTIVE' | 'CONDITIONAL' | 'DISABLED_BY_RUNTIME' | 'SAFETY_LOCKED';
  description: string;
  disabledReason?: string;
}

export interface FeatureFlagsConfig {
  walletConnection: FeatureControl;
  contractDeployment: FeatureControl;
  faucetClaim: FeatureControl;
  tokenTransfer: FeatureControl;
  tokenApprove: FeatureControl;
  ammAddLiquidity: FeatureControl;
  ammRemoveLiquidity: FeatureControl;
  ammSwap: FeatureControl;
  nativeEvmTransfer: FeatureControl;
  nativeSubstrateTransfer: FeatureControl;
  crossVmBridge: FeatureControl;
}

export const FEATURE_FLAGS: FeatureFlagsConfig = {
  walletConnection: {
    id: 'walletConnection',
    name: 'Wallet Connection (EVM & Substrate)',
    enabled: true,
    requiresWallet: false,
    requiresCorrectNetwork: false,
    statusLabel: 'ACTIVE',
    description: 'Enables user wallet discovery and authorization via window.ethereum and window.injectedWeb3.'
  },
  contractDeployment: {
    id: 'contractDeployment',
    name: 'User Contract Deployment',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Allows connected EVM wallet to deploy verified contracts (TestUSDCMin, WPotToken, NexusAMMNative).'
  },
  faucetClaim: {
    id: 'faucetClaim',
    name: 'pUSDC Testnet Faucet Claim',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Calls TestUSDCMin.faucetMint(recipient, amount) directly from the connected wallet.'
  },
  tokenTransfer: {
    id: 'tokenTransfer',
    name: 'pUSDC Token Transfer',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Executes standard ERC-20 transfer(to, amount) from user wallet.'
  },
  tokenApprove: {
    id: 'tokenApprove',
    name: 'pUSDC Token Approval',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Authorizes exact pUSDC allowance for the NexusAMMNative pool without unlimited allowances.'
  },
  ammAddLiquidity: {
    id: 'ammAddLiquidity',
    name: 'AMM Liquidity Provision',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Submits payable Native POT + pUSDC liquidity to NexusAMMNative, minting an on-chain position NFT.'
  },
  ammRemoveLiquidity: {
    id: 'ammRemoveLiquidity',
    name: 'AMM Liquidity Removal',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Burns the user LP position NFT and withdraws proportional POT and pUSDC reserves.'
  },
  ammSwap: {
    id: 'ammSwap',
    name: 'AMM Constant-Product Swap',
    enabled: true, // Enabled when pool has liquidity; guarded dynamically when reserves are 0
    requiresWallet: true,
    requiresCorrectNetwork: true,
    requiresNonZeroReserves: true,
    statusLabel: 'CONDITIONAL',
    description: 'Executes swapExactPOTForTokens or swapExactTokensForPOT. Requires seeded pool liquidity.'
  },
  nativeEvmTransfer: {
    id: 'nativeEvmTransfer',
    name: 'Native POT Transfer (EVM)',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'ACTIVE',
    description: 'Direct transfer of native POT currency between EVM accounts with gas estimation.'
  },
  nativeSubstrateTransfer: {
    id: 'nativeSubstrateTransfer',
    name: 'Native tPOT Transfer (Substrate)',
    enabled: true,
    requiresWallet: true,
    requiresCorrectNetwork: false,
    statusLabel: 'ACTIVE',
    description: 'Signs and broadcasts native balance transfers between Substrate SS58 accounts.'
  },
  crossVmBridge: {
    id: 'crossVmBridge',
    name: 'Native Cross-VM Single-Step Teleport',
    enabled: false,
    requiresWallet: true,
    requiresCorrectNetwork: true,
    statusLabel: 'DISABLED_BY_RUNTIME',
    description: 'Direct single-step Cross-VM bridge between Substrate WASM and pallet-revive EVM.',
    disabledReason: 'Portaldot V3 testnet does not expose an unprivileged client-side cross-VM teleport extrinsic on public RPC. Use independent native transfers within each respective VM.'
  }
};

/**
 * Validates whether an action is currently permitted given live wallet & reserve conditions.
 */
export function checkFeaturePermission(
  featureId: keyof FeatureFlagsConfig,
  context: {
    isWalletConnected: boolean;
    isCorrectNetwork: boolean;
    hasLiquidity?: boolean;
  }
): { allowed: boolean; reason?: string } {
  const feature = FEATURE_FLAGS[featureId];
  if (!feature) return { allowed: false, reason: 'Unknown feature' };

  if (!feature.enabled) {
    return { allowed: false, reason: feature.disabledReason || `${feature.name} is disabled.` };
  }

  if (feature.requiresWallet && !context.isWalletConnected) {
    return { allowed: false, reason: 'Connect wallet to proceed.' };
  }

  if (feature.requiresCorrectNetwork && !context.isCorrectNetwork) {
    return { allowed: false, reason: 'Switch wallet to Portaldot V3 Testnet (Chain ID 420420777).' };
  }

  if (feature.requiresNonZeroReserves && context.hasLiquidity === false) {
    return { allowed: false, reason: 'Pool has zero liquidity. Seed initial liquidity before swapping.' };
  }

  return { allowed: true };
}
