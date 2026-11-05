import { describe, it, expect } from 'vitest';
import { FEATURE_FLAGS, checkFeaturePermission } from '../src/services/featureFlags';

describe('Feature Flags & Safety Controls', () => {
  it('defines all required granular operational feature flags', () => {
    expect(FEATURE_FLAGS.walletConnection.enabled).toBe(true);
    expect(FEATURE_FLAGS.contractDeployment.enabled).toBe(true);
    expect(FEATURE_FLAGS.faucetClaim.enabled).toBe(false);
    expect(FEATURE_FLAGS.tokenTransfer.enabled).toBe(true);
    expect(FEATURE_FLAGS.tokenApprove.enabled).toBe(false);
    expect(FEATURE_FLAGS.ammAddLiquidity.enabled).toBe(false);
    expect(FEATURE_FLAGS.ammRemoveLiquidity.enabled).toBe(false);
    expect(FEATURE_FLAGS.ammSwap.enabled).toBe(false);
    expect(FEATURE_FLAGS.nativeEvmTransfer.enabled).toBe(true);
    expect(FEATURE_FLAGS.nativeSubstrateTransfer.enabled).toBe(true);
  });

  it('keeps cross-VM bridge strictly disabled due to runtime limitations', () => {
    expect(FEATURE_FLAGS.crossVmBridge.enabled).toBe(false);
    expect(FEATURE_FLAGS.crossVmBridge.requiresWallet).toBe(true);

    const perm = checkFeaturePermission('crossVmBridge', {
      isWalletConnected: true,
      isCorrectNetwork: true
    });
    expect(perm.allowed).toBe(false);
    expect(perm.reason).toContain('Portaldot V3 testnet does not expose');
  });

  it('blocks operations requiring wallet connection when wallet is disconnected', () => {
    const permTransfer = checkFeaturePermission('tokenTransfer', {
      isWalletConnected: false,
      isCorrectNetwork: false
    });
    expect(permTransfer.allowed).toBe(false);
    expect(permTransfer.reason).toContain('Connect wallet to proceed.');

    const permTransferDisconnected = checkFeaturePermission('tokenTransfer', {
      isWalletConnected: false,
      isCorrectNetwork: false
    });
    expect(permTransferDisconnected.allowed).toBe(false);
    expect(permTransferDisconnected.reason).toContain('Connect wallet to proceed.');
  });

  it('blocks operations requiring network verification when connected to wrong chain', () => {
    const permDeploy = checkFeaturePermission('contractDeployment', {
      isWalletConnected: true,
      isCorrectNetwork: false
    });
    expect(permDeploy.allowed).toBe(false);
    expect(permDeploy.reason).toContain('Portaldot V3 Testnet');
  });

  it('blocks faucet, approval, liquidity, and swap writes in this release', () => {
    for (const feature of ['faucetClaim', 'tokenApprove', 'ammAddLiquidity', 'ammRemoveLiquidity', 'ammSwap'] as const) {
      const permission = checkFeaturePermission(feature, {
        isWalletConnected: true,
        isCorrectNetwork: true,
        hasLiquidity: true
      });
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('disabled in this release');
    }
  });

  it('keeps empty-pool swap rejection explicit', () => {
    const permSwapEmpty = checkFeaturePermission('ammSwap', {
      isWalletConnected: true,
      isCorrectNetwork: true,
      hasLiquidity: false
    });
    expect(permSwapEmpty.allowed).toBe(false);
    expect(permSwapEmpty.reason).toContain('disabled in this release');
  });

  it('blocks adding liquidity even when the wallet is connected on the right network', () => {
    const permAdd = checkFeaturePermission('ammAddLiquidity', {
      isWalletConnected: true,
      isCorrectNetwork: true,
      hasLiquidity: false
    });
    expect(permAdd.allowed).toBe(false);
    expect(permAdd.reason).toContain('disabled in this release');
  });
});
