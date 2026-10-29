import React, { useState, useEffect } from 'react';
import { DeploymentService, DeploymentServiceState } from '../services/deploymentService';
import { EvmWalletState, PORTALDOT_EXPLORER_URL } from '../services/evmWallet';
import { TEST_USDC_MIN_BYTECODE, NEXUS_AMM_NATIVE_BYTECODE } from '../contracts/deploymentData';
import { encodeAddress, isAddress } from '../contracts/abi';
import { LIVE_DEPLOYMENT } from '../contracts/config';
import { ExternalLinkIcon, CheckIcon, AlertIcon } from './Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deploymentService: DeploymentService;
  evmWalletState: EvmWalletState;
}

type ArchChoice = 'archA' | 'archB';

export const DeploymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  deploymentService,
  evmWalletState
}) => {
  const [arch, setArch] = useState<ArchChoice>('archA');
  const [serviceState, setServiceState] = useState<DeploymentServiceState>(deploymentService.getState());
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Architecture A custom deployed addresses
  const [archAusdcAddress, setArchAusdcAddress] = useState<string>('');
  const [archAusdcTx, setArchAusdcTx] = useState<string | null>(null);
  const [archAammAddress, setArchAammAddress] = useState<string>('');
  const [archAammTx, setArchAammTx] = useState<string | null>(null);

  useEffect(() => {
    return deploymentService.subscribe(setServiceState);
  }, [deploymentService]);

  if (!isOpen) return null;

  // Architecture A Deployers
  const handleDeployArchAusdc = async () => {
    setErrorMsg(null);
    setStatusMsg('Prompting wallet for TestUSDCMin deployment...');
    setIsProcessing(true);
    try {
      const res = await deploymentService.deployContractArtifact({
        name: 'TestUSDCMin',
        bytecode: TEST_USDC_MIN_BYTECODE
      });
      if (res.success && res.contractAddress) {
        setArchAusdcAddress(res.contractAddress);
        setArchAusdcTx(res.txHash || null);
        setStatusMsg('TestUSDCMin successfully deployed & verified on-chain!');
      } else {
        setErrorMsg(res.error || 'Failed to deploy TestUSDCMin');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Deployment error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeployArchAamm = async () => {
    setErrorMsg(null);
    const targetUsdc = archAusdcAddress || LIVE_DEPLOYMENT.pusdcAddress;
    if (!isAddress(targetUsdc)) {
      setErrorMsg('Invalid USDC constructor address');
      return;
    }
    setStatusMsg('Prompting wallet for NexusAMMNative deployment...');
    setIsProcessing(true);
    try {
      const res = await deploymentService.deployContractArtifact({
        name: 'NexusAMMNative',
        bytecode: NEXUS_AMM_NATIVE_BYTECODE,
        constructorArgsHex: encodeAddress(targetUsdc)
      });
      if (res.success && res.contractAddress) {
        setArchAammAddress(res.contractAddress);
        setArchAammTx(res.txHash || null);
        setStatusMsg('NexusAMMNative successfully deployed & verified on-chain!');
      } else {
        setErrorMsg(res.error || 'Failed to deploy NexusAMMNative');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Deployment error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Architecture B Deployers
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
      <div className="relative w-full max-w-2xl bg-gray-950 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Portaldot V3 Contract Deployment Manager
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Deploy verified bytecode through your connected browser wallet &bull; Chain ID <code className="text-cyan-300">420420777</code>
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
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs mono space-y-2">
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
            <span className="text-slate-400">POT Balance:</span>
            <span className="text-cyan-300 font-semibold">
              {evmWalletState.balancePot !== null ? `${evmWalletState.balancePot} POT` : '—'}
            </span>
          </div>
        </div>

        {/* Architecture Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/50 rounded-xl border border-white/10">
          <button
            onClick={() => setArch('archA')}
            className={`py-2 px-3 rounded-lg text-xs mono font-semibold transition ${
              arch === 'archA'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Architecture A (Native POT AMM)
          </button>
          <button
            onClick={() => setArch('archB')}
            className={`py-2 px-3 rounded-lg text-xs mono font-semibold transition ${
              arch === 'archB'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Architecture B (Wrapped POT AMM)
          </button>
        </div>

        {/* Status Messages */}
        {statusMsg && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs mono text-cyan-300 flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
        {(errorMsg || serviceState.lastError) && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs mono text-rose-300 flex items-center gap-2">
            <AlertIcon className="w-4 h-4 shrink-0" />
            <span>{errorMsg || serviceState.lastError}</span>
          </div>
        )}

        {/* ARCHITECTURE A CONTRACTS */}
        {arch === 'archA' && (
          <div className="space-y-4">
            {/* Step 1: TestUSDCMin */}
            <div className={`p-4 rounded-xl border transition ${
              archAusdcAddress ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                    <span>1. TestUSDCMin.sol</span>
                    {archAusdcAddress && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                        ✓ Deployed &amp; Verified
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">Minimal pUSDC test token with built-in 10,000 faucet</p>
                </div>

                {!archAusdcAddress ? (
                  <button
                    disabled={!evmWalletState.isCorrectNetwork || isProcessing}
                    onClick={handleDeployArchAusdc}
                    className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                  >
                    {isProcessing ? 'Prompting...' : 'Deploy pUSDC'}
                  </button>
                ) : (
                  <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                    {archAusdcAddress}
                  </span>
                )}
              </div>

              {archAusdcTx && (
                <div className="mt-2 pt-2 border-t border-white/5 text-[11px] mono text-slate-400 flex items-center justify-between">
                  <span>Tx: <code className="text-slate-200">{archAusdcTx.slice(0, 10)}…{archAusdcTx.slice(-8)}</code></span>
                  <a
                    href={`${PORTALDOT_EXPLORER_URL}/tx/${archAusdcTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    Explorer <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Step 2: NexusAMMNative */}
            <div className={`p-4 rounded-xl border transition ${
              archAammAddress ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                    <span>2. NexusAMMNative.sol</span>
                    {archAammAddress && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                        ✓ Deployed &amp; Verified
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">Constant-product native POT / pUSDC pair (no wrapping)</p>
                </div>

                {!archAammAddress ? (
                  <button
                    disabled={!evmWalletState.isCorrectNetwork || isProcessing}
                    onClick={handleDeployArchAamm}
                    className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                  >
                    {isProcessing ? 'Prompting...' : 'Deploy AMM Pair'}
                  </button>
                ) : (
                  <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                    {archAammAddress}
                  </span>
                )}
              </div>

              {archAammTx && (
                <div className="mt-2 pt-2 border-t border-white/5 text-[11px] mono text-slate-400 flex items-center justify-between">
                  <span>Tx: <code className="text-slate-200">{archAammTx.slice(0, 10)}…{archAammTx.slice(-8)}</code></span>
                  <a
                    href={`${PORTALDOT_EXPLORER_URL}/tx/${archAammTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    Explorer <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ARCHITECTURE B CONTRACTS */}
        {arch === 'archB' && (
          <div className="space-y-4">
            {/* STEP 1: WPotToken */}
            <div className={`p-4 rounded-xl border transition ${
              serviceState.wpot.verified ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-white/[0.02] border-white/10'
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
                    {isProcessing && serviceState.step.includes('WPOT') ? 'Prompting...' : 'Deploy WPot'}
                  </button>
                ) : (
                  <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                    {serviceState.wpot.deployedAddress}
                  </span>
                )}
              </div>
            </div>

            {/* STEP 2: TestUSDC */}
            <div className={`p-4 rounded-xl border transition ${
              serviceState.testUSDC.verified ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-white/[0.02] border-white/10'
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
                    {isProcessing && serviceState.step.includes('USDC') ? 'Prompting...' : 'Deploy pUSDC'}
                  </button>
                ) : (
                  <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                    {serviceState.testUSDC.deployedAddress}
                  </span>
                )}
              </div>
            </div>

            {/* STEP 3: NexusAMM */}
            <div className={`p-4 rounded-xl border transition ${
              serviceState.nexusAMM.verified ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-white/[0.02] border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                    <span>3. NexusAMM.sol &amp; NexusLPReceipt.sol</span>
                    {serviceState.nexusAMM.verified && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                        ✓ Verified Live
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">Constant-product AMM pool &amp; auto-instantiated LP NFT</p>
                </div>

                {!serviceState.nexusAMM.verified ? (
                  <button
                    disabled={!serviceState.wpot.verified || !serviceState.testUSDC.verified || !evmWalletState.isCorrectNetwork || isProcessing}
                    onClick={handleDeployAMM}
                    className="px-4 py-2 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition"
                  >
                    {isProcessing && serviceState.step.includes('AMM') ? 'Prompting...' : 'Deploy AMM Pool'}
                  </button>
                ) : (
                  <span className="text-xs mono text-emerald-400 truncate max-w-[200px]">
                    {serviceState.nexusAMM.deployedAddress}
                  </span>
                )}
              </div>
            </div>

            {/* Commit Button for Architecture B */}
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
        )}

      </div>
    </div>
  );
};
