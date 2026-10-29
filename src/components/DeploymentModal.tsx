import React, { useState, useEffect } from 'react';
import { DeploymentService, DeploymentServiceState } from '../services/deploymentService';
import { EvmWalletState } from '../services/evmWallet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deploymentService: DeploymentService;
  evmWalletState: EvmWalletState;
}

export const DeploymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  deploymentService,
  evmWalletState
}) => {
  const [serviceState, setServiceState] = useState<DeploymentServiceState>(deploymentService.getState());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return deploymentService.subscribe(setServiceState);
  }, [deploymentService]);

  if (!isOpen) return null;

  const handleDeployWPot = async () => {
    setIsProcessing(true);
    await deploymentService.deployWPot();
    setIsProcessing(false);
  };

  const handleDeployUSDC = async () => {
    setIsProcessing(true);
    await deploymentService.deployTestUSDC();
    setIsProcessing(false);
  };

  const handleDeployAMM = async () => {
    setIsProcessing(true);
    await deploymentService.deployNexusAMM();
    setIsProcessing(false);
  };

  const handleCommit = () => {
    deploymentService.commitToConfig();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-gray-950 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Portaldot V3 Testnet Contract Deployment
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Option A: Native MetaMask / Rabby Injected Deployment &bull; Chain ID <code className="text-cyan-300">420420777</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1 rounded-lg text-sm bg-white/5 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Safety Boundary Notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            🛡️ Zero-Simulation & Zero Private Key Access Policy
          </p>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Every deployment step triggers your browser wallet's native confirmation dialog. PortalNexus never requests private keys, never uses an unattended signer, and never broadcasts without your manual wallet confirmation.
          </p>
        </div>

        {/* Deployer Wallet Preflight Status */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-xs mono space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Deployer Address:</span>
            <span className="text-white font-semibold">
              {evmWalletState.address ? `${evmWalletState.address.slice(0, 10)}...${evmWalletState.address.slice(-8)}` : 'Not connected'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Target Network:</span>
            <span className={evmWalletState.isCorrectNetwork ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {evmWalletState.isCorrectNetwork ? 'Portaldot V3 (420420777)' : 'Wrong Network (Switch to 420420777)'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Testnet POT Balance:</span>
            <span className="text-cyan-300 font-semibold">
              {evmWalletState.balancePot !== null ? `${evmWalletState.balancePot} POT` : '—'}
            </span>
          </div>
        </div>

        {/* Step-by-Step Contract Deployment Cards */}
        <div className="space-y-4">
          
          {/* STEP 1: WPotToken */}
          <div className={`p-4 rounded-xl border transition ${
            serviceState.wpot.verified
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-white/[0.02] border-white/10'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <span>1. WPotToken.sol</span>
                  {serviceState.wpot.verified && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                      ✓ Verified Live
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400">EVM POT wrapper (18 decimals, 1:1 backing)</p>
              </div>

              {!serviceState.wpot.verified ? (
                <button
                  disabled={!evmWalletState.isCorrectNetwork || isProcessing}
                  onClick={handleDeployWPot}
                  className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                >
                  {isProcessing && serviceState.step.includes('WPOT') ? 'Prompting Wallet...' : 'Deploy WPot'}
                </button>
              ) : (
                <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                  {serviceState.wpot.deployedAddress}
                </span>
              )}
            </div>

            {serviceState.wpot.txHash && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[11px] mono text-slate-400 space-y-0.5">
                <div>Tx Hash: <span className="text-slate-200">{serviceState.wpot.txHash}</span></div>
                {serviceState.wpot.blockNumber && <div>Mined in Block: <span className="text-cyan-300">#{serviceState.wpot.blockNumber}</span></div>}
              </div>
            )}
          </div>

          {/* STEP 2: TestUSDC */}
          <div className={`p-4 rounded-xl border transition ${
            serviceState.testUSDC.verified
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-white/[0.02] border-white/10'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <span>2. TestUSDC.sol</span>
                  {serviceState.testUSDC.verified && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                      ✓ Verified Live
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400">pUSDC test stablecoin (6 decimals, 10,000 faucet cap)</p>
              </div>

              {!serviceState.testUSDC.verified ? (
                <button
                  disabled={!serviceState.wpot.verified || !evmWalletState.isCorrectNetwork || isProcessing}
                  onClick={handleDeployUSDC}
                  className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                >
                  {isProcessing && serviceState.step.includes('USDC') ? 'Prompting Wallet...' : 'Deploy pUSDC'}
                </button>
              ) : (
                <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                  {serviceState.testUSDC.deployedAddress}
                </span>
              )}
            </div>

            {serviceState.testUSDC.txHash && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[11px] mono text-slate-400 space-y-0.5">
                <div>Tx Hash: <span className="text-slate-200">{serviceState.testUSDC.txHash}</span></div>
                {serviceState.testUSDC.blockNumber && <div>Mined in Block: <span className="text-cyan-300">#{serviceState.testUSDC.blockNumber}</span></div>}
              </div>
            )}
          </div>

          {/* STEP 3: NexusAMM */}
          <div className={`p-4 rounded-xl border transition ${
            serviceState.nexusAMM.verified
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-white/[0.02] border-white/10'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <span>3. NexusAMM.sol & NexusLPReceipt.sol</span>
                  {serviceState.nexusAMM.verified && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                      ✓ Verified Live
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-400">Constant-product AMM pool & auto-instantiated LP NFT</p>
              </div>

              {!serviceState.nexusAMM.verified ? (
                <button
                  disabled={!serviceState.wpot.verified || !serviceState.testUSDC.verified || !evmWalletState.isCorrectNetwork || isProcessing}
                  onClick={handleDeployAMM}
                  className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                >
                  {isProcessing && serviceState.step.includes('AMM') ? 'Prompting Wallet...' : 'Deploy AMM Pool'}
                </button>
              ) : (
                <div className="text-right">
                  <span className="block text-xs mono text-emerald-400 truncate max-w-[200px]">
                    AMM: {serviceState.nexusAMM.deployedAddress}
                  </span>
                  <span className="block text-[10px] mono text-purple-400 truncate max-w-[200px]">
                    NFT: {serviceState.nexusReceipt.deployedAddress}
                  </span>
                </div>
              )}
            </div>

            {serviceState.nexusAMM.txHash && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[11px] mono text-slate-400 space-y-0.5">
                <div>Tx Hash: <span className="text-slate-200">{serviceState.nexusAMM.txHash}</span></div>
                {serviceState.nexusAMM.blockNumber && <div>Mined in Block: <span className="text-cyan-300">#{serviceState.nexusAMM.blockNumber}</span></div>}
              </div>
            )}
          </div>

        </div>

        {/* Error Display */}
        {serviceState.lastError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            ⚠️ {serviceState.lastError}
          </div>
        )}

        {/* Final Activation Button */}
        {serviceState.step === 'ALL_VERIFIED' && (
          <div className="pt-2 border-t border-white/10">
            <button
              onClick={handleCommit}
              className="w-full py-3.5 rounded-xl font-bold text-xs mono uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95 shadow-lg shadow-emerald-500/20"
            >
              🚀 Activate Deployed Contracts in PortalNexus Terminal
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
