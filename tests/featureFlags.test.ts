import { describe, it, expect } from 'vitest';
import { FEATURE_FLAGS, checkFeaturePermission } from '../src/services/featureFlags';

describe('Feature Flags & Safety Controls', () => {
  it('defines all required granular operational feature flags', () => {
    expect(FEATURE_FLAGS.walletConnection.enabled).toBe(true);
    expect(FEATURE_FLAGS.contractDeployment.enabled).toBe(true);
    expect(FEATURE_FLAGS.faucetClaim.enabled).toBe(true);
    expect(FEATURE_FLAGS.tokenTransfer.enabled).toBe(true);
    expect(FEATURE_FLAGS.tokenApprove.enabled).toBe(true);
    expect(FEATURE_FLAGS.ammAddLiquidity.enabled).toBe(true);
    expect(FEATURE_FLAGS.ammRemoveLiquidity.enabled).toBe(true);
    expect(FEATURE_FLAGS.ammSwap.enabled).toBe(true);
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

    const permSwap = checkFeaturePermission('ammSwap', {
      isWalletConnected: false,
      isCorrectNetwork: false
    });
    expect(permSwap.allowed).toBe(false);
    expect(permSwap.reason).toContain('Connect wallet to proceed.');
  });

  it('blocks operations requiring network verification when connected to wrong chain', () => {
    const permDeploy = checkFeaturePermission('contractDeployment', {
      isWalletConnected: true,
      isCorrectNetwork: false
    });
    expect(permDeploy.allowed).toBe(false);
    expect(permDeploy.reason).toContain('Portaldot V3 Testnet');
  });

  it('enforces empty AMM pool protection on swaps', () => {
    // When pool has no liquidity
    const permSwapEmpty = checkFeaturePermission('ammSwap', {
      isWalletConnected: true,
      isCorrectNetwork: true,
      hasLiquidity: false
    });
    expect(permSwapEmpty.allowed).toBe(false);
    expect(permSwapEmpty.reason).toContain('zero liquidity');

    // When pool has liquidity
    const permSwapWithLiq = checkFeaturePermission('ammSwap', {
      isWalletConnected: true,
      isCorrectNetwork: true,
      hasLiquidity: true
    });
    expect(permSwapWithLiq.allowed).toBe(true);
    expect(permSwapWithLiq.reason).toBeUndefined();
  });

  it('allows adding initial liquidity even when pool has no reserves', () => {
    const permAdd = checkFeaturePermission('ammAddLiquidity', {
      isWalletConnected: true,
      isCorrectNetwork: true,
      hasLiquidity: false
    });
    expect(permAdd.allowed).toBe(true);
  });
});
