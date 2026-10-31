import React, { useState, useEffect } from 'react';
import { DeploymentService, DeploymentServiceState, CustomContractDeploymentPlan } from '../services/deploymentService';
import { EvmWalletState, PORTALDOT_EXPLORER_URL } from '../services/evmWallet';
import { TEST_USDC_MIN_BYTECODE, NEXUS_AMM_NATIVE_BYTECODE } from '../contracts/deploymentData';
import { encodeAddress, isAddress } from '../contracts/abi';
import { LIVE_DEPLOYMENT } from '../contracts/config';
import { ExternalLinkIcon, CheckIcon, AlertIcon } from './Icons';
import { compilerService, CompilationResult, validateSourceFile } from '../services/compilerService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deploymentService: DeploymentService;
  evmWalletState: EvmWalletState;
}

type ArchChoice = 'archA' | 'archB' | 'custom';

const DEFAULT_STAGE3D_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PortalTestStorage
 * @notice Ultra-minimal, self-contained verification contract for PortalNexus Stage 3D testnet deployment.
 * @dev Zero external imports, zero token approvals, zero payable functions, zero privileged/owner roles.
 */
contract PortalTestStorage {
    uint256 public value;
    address public immutable creator;

    event ValueUpdated(uint256 indexed previousValue, uint256 indexed newValue);

    constructor(uint256 initialValue) {
        value = initialValue;
        creator = msg.sender;
        emit ValueUpdated(0, initialValue);
    }

    function setValue(uint256 newValue) external {
        uint256 prev = value;
        value = newValue;
        emit ValueUpdated(prev, newValue);
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}
`;

export const DeploymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  deploymentService,
  evmWalletState
}) => {
  const [arch, setArch] = useState<ArchChoice>('custom');
  const [serviceState, setServiceState] = useState<DeploymentServiceState>(deploymentService.getState());
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Architecture A custom deployed addresses
  const [archAusdcAddress, setArchAusdcAddress] = useState<string>('');
  const [archAusdcTx, setArchAusdcTx] = useState<string | null>(null);
  const [archAammAddress, setArchAammAddress] = useState<string>('');
  const [archAammTx, setArchAammTx] = useState<string | null>(null);

  // Custom contract deployed state (Stage 3D)
  const [customDeployTx, setCustomDeployTx] = useState<string | null>(null);
  const [customDeployedAddress, setCustomDeployedAddress] = useState<string | null>(null);

  // Custom contract upload & compilation state (Stage 3C)
  const [customFileName, setCustomFileName] = useState<string>('PortalTestStorage.sol');
  const [customSource, setCustomSource] = useState<string>(DEFAULT_STAGE3D_SOURCE);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  const [selectedContractName, setSelectedContractName] = useState<string>('');
  const [constructorArgValues, setConstructorArgValues] = useState<Record<string, any>>({});
  const [deploymentPlan, setDeploymentPlan] = useState<CustomContractDeploymentPlan | null>(null);
  const [isPreparingPlan, setIsPreparingPlan] = useState<boolean>(false);
  const [showBytecodePreview, setShowBytecodePreview] = useState<boolean>(false);
  const [showAbiPreview, setShowAbiPreview] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string | null>(null);

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

  // Stage 3D Custom Contract Deployer (User Authorized)
  const handleDeployCustom = async () => {
    if (!deploymentPlan || !deploymentPlan.isValid || isProcessing) return;
    setErrorMsg(null);
    setStatusMsg(`Submitting ${deploymentPlan.contractName} creation to browser wallet for approval...`);
    setIsProcessing(true);
    try {
      const res = await deploymentService.deployContractArtifact({
        name: deploymentPlan.contractName,
        bytecode: deploymentPlan.creationBytecode
      });
      if (res.success && res.contractAddress) {
        setCustomDeployedAddress(res.contractAddress);
        setCustomDeployTx(res.txHash || null);
        setStatusMsg(`${deploymentPlan.contractName} deployed & verified on-chain at ${res.contractAddress}!`);
      } else {
        setErrorMsg(res.error || `Failed to deploy ${deploymentPlan.contractName}`);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Deployment transaction error');
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

  const handleActivateArchA = async () => {
    setErrorMsg(null);
    setStatusMsg('Verifying receipt, chain, and on-chain bytecode before activating...');
    setIsProcessing(true);
    try {
      const res = await deploymentService.activateCustomArchA({
        pusdcAddress: archAusdcAddress,
        ammAddress: archAammAddress,
        pusdcTxHash: archAusdcTx,
        ammTxHash: archAammTx
      });
      if (res.success) {
        setStatusMsg('Successfully verified and activated Architecture A in terminal registry!');
      } else {
        setErrorMsg(res.error || 'Activation failed');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Activation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivateCustom = () => {
    deploymentService.deactivateCustomDeployment();
    setStatusMsg('Safely restored canonical built-in contract configuration.');
  };

  // Stage 3C Custom Contract Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomError(null);
    setDeploymentPlan(null);
    setCompilationResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const val = validateSourceFile(file.name, file.size);
    if (!val.valid) {
      setCustomError(val.error || 'Invalid file');
      return;
    }

    setCustomFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomSource(content || '');
    };
    reader.onerror = () => {
      setCustomError('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  const handleCompileCustom = async () => {
    if (!customSource.trim()) {
      setCustomError('Source code cannot be empty. Upload a .sol file or paste Solidity code.');
      return;
    }
    setCustomError(null);
    setDeploymentPlan(null);
    setIsCompiling(true);

    try {
      const res = await compilerService.compile(customSource, {
        fileName: customFileName || 'Contract.sol'
      });
      setCompilationResult(res);
      if (res.success && res.contractNames.length > 0) {
        const primary = res.contractNames[0];
        setSelectedContractName(primary);
        if (primary === 'PortalTestStorage') {
          setConstructorArgValues({ initialValue: '42' });
        } else {
          setConstructorArgValues({});
        }
      }
    } catch (err: any) {
      setCustomError(err?.message || 'Compilation failed.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCancelCompile = () => {
    compilerService.cancelCurrentCompilation();
    setIsCompiling(false);
  };

  const handleSelectContract = (name: string) => {
    setSelectedContractName(name);
    setConstructorArgValues({});
    setDeploymentPlan(null);
  };

  const handleArgChange = (paramKey: string, val: string) => {
    setConstructorArgValues(prev => ({ ...prev, [paramKey]: val }));
    setDeploymentPlan(null);
  };

  const handlePrepareReview = async () => {
    if (!compilationResult || !selectedContractName) return;
    const contract = compilationResult.contracts[selectedContractName];
    if (!contract) return;

    setCustomError(null);
    setIsPreparingPlan(true);

    try {
      const plan = await deploymentService.prepareCustomDeployment({
        contractName: selectedContractName,
        fileName: customFileName || 'Contract.sol',
        bytecode: contract.bytecode,
        abi: contract.abi,
        constructorParams: contract.constructorParams,
        paramValues: constructorArgValues
      });
      setDeploymentPlan(plan);
      if (!plan.isValid) {
        setCustomError(plan.validationError || 'Deployment review identified validation errors.');
      }
    } catch (err: any) {
      setCustomError(err?.message || 'Failed to prepare deployment plan.');
    } finally {
      setIsPreparingPlan(false);
    }
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

        {/* Pre-Deployment Pallet-Revive Storage Deposit Warning (SEC-04) */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200 space-y-2">
          <p className="font-semibold flex items-center gap-1.5 text-indigo-300">
            ⚠️ Pallet-Revive Storage Deposit & State Collateral Warning
          </p>
          <p className="text-[11px] text-indigo-300/80 leading-relaxed">
            Portaldot V3 uses Substrate <code className="text-indigo-200">pallet-revive</code>, which charges on-chain state storage collateral (storage deposit) in POT in addition to standard computation gas fees.
          </p>
          <div className="p-2.5 rounded-lg bg-black/40 border border-indigo-500/20 text-[10px] mono text-slate-300 space-y-1">
            <p className="text-indigo-300 font-bold">Empirical On-Chain Testnet Deposit Evidence (from deployment records):</p>
            <p>&bull; <strong>TestUSDCMin:</strong> ~127 POT locked as byte/item storage collateral</p>
            <p>&bull; <strong>NexusAMMNative:</strong> ~280 POT locked as byte/item storage collateral</p>
            <p>&bull; <strong>Architecture A Total:</strong> ~408 POT total collateral required</p>
            <p>&bull; <strong>Architecture B (4 contracts):</strong> ~1,091 POT total collateral estimate</p>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-amber-300">Crucial distinction:</strong> The storage deposit is state collateral, NOT a transaction gas fee. Actual requirements depend on contract bytecode size, allocated storage slots, and runtime deposit rates at execution time. Accounts holding only typical testnet faucet grants (5–10 POT) will fail preflight or encounter wallet rejection.
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
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/50 rounded-xl border border-white/10">
          <button
            onClick={() => setArch('archA')}
            className={`py-2 px-3 rounded-lg text-xs mono font-semibold transition ${
              arch === 'archA'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Architecture A (Native)
          </button>
          <button
            onClick={() => setArch('archB')}
            className={`py-2 px-3 rounded-lg text-xs mono font-semibold transition ${
              arch === 'archB'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Architecture B (Wrapped)
          </button>
          <button
            onClick={() => setArch('custom')}
            className={`py-2 px-3 rounded-lg text-xs mono font-semibold transition ${
              arch === 'custom'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Custom Contract (.sol)
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

            {/* Explicit Activation Action for Architecture A (SEC-03) */}
            {archAusdcAddress && archAammAddress && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <button
                  disabled={isProcessing}
                  onClick={handleActivateArchA}
                  className="w-full py-3.5 rounded-xl font-bold text-xs mono uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  🚀 Activate Verified Architecture A in Terminal Registry
                </button>
              </div>
            )}

            {/* Custom Registry Active Banner (SEC-03) */}
            {serviceState.customRegistryEntry?.arch === 'archA' && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs mono space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    Custom Architecture A Active in Terminal Registry
                  </span>
                  <button
                    onClick={handleDeactivateCustom}
                    className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-semibold border border-rose-500/40"
                  >
                    Revert to Built-in Registry
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Active pUSDC: <code className="text-emerald-300">{serviceState.customRegistryEntry.pusdcAddress}</code> &bull; Active AMM: <code className="text-emerald-300">{serviceState.customRegistryEntry.ammAddress}</code>. Built-in constants remain safe and preserved.
                </p>
              </div>
            )}
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

        {/* CUSTOM SOLIDITY CONTRACT (STAGE 3C) */}
        {arch === 'custom' && (
          <div className="space-y-4">
            {/* Custom Intro */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Upload &amp; Deploy Custom Contract</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 mono">
                    Solidity 0.8.24
                  </span>
                </h3>
                <span className="text-[11px] mono text-slate-400">
                  Worker-Isolated &bull; 0 KB Network Leaks
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Compile your local <code className="text-emerald-300">.sol</code> contract using the in-browser Web Worker, configure constructor parameters, inspect the creation bytecode, and review Portaldot V3 deployment preflight.
              </p>
            </div>

            {/* Custom Error Banner */}
            {customError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs mono text-rose-300 flex items-center gap-2">
                <AlertIcon className="w-4 h-4 shrink-0" />
                <span>{customError}</span>
              </div>
            )}

            {/* Step A: Upload & Source Input */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <span>1. Contract Source Code</span>
                  {customFileName && (
                    <span className="text-[11px] text-cyan-300 mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                      {customFileName}
                    </span>
                  )}
                </label>
                <label className="cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold mono bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5">
                  <span>📁 Upload .sol File</span>
                  <input
                    type="file"
                    accept=".sol"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={customSource}
                onChange={(e) => {
                  setCustomSource(e.target.value);
                  setCompilationResult(null);
                  setDeploymentPlan(null);
                }}
                placeholder="// Paste or upload your Solidity source code here...
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MyCustomToken {
    string public name;
    constructor(string memory _name) {
        name = _name;
    }
}"
                rows={7}
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-y"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-500 mono">
                  {customSource.length > 0 ? `${(new Blob([customSource]).size / 1024).toFixed(1)} KB` : 'Empty'}
                </div>
                <div className="flex items-center gap-2">
                  {isCompiling ? (
                    <button
                      onClick={handleCancelCompile}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold mono bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 transition"
                    >
                      Cancel Compilation
                    </button>
                  ) : (
                    <button
                      onClick={handleCompileCustom}
                      disabled={!customSource.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold mono bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition shadow-lg shadow-emerald-600/20"
                    >
                      ⚡ Compile Source
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step B: Compiler Diagnostics */}
            {compilationResult && (
              <div className="space-y-2">
                {compilationResult.success ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs mono text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckIcon className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Compilation Successful ({compilationResult.contractNames.length} contract{compilationResult.contractNames.length > 1 ? 's' : ''} generated in {compilationResult.compilationTimeMs}ms)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      v{compilationResult.compilerVersion}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs mono text-rose-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-rose-400">
                      <AlertIcon className="w-4 h-4 shrink-0" />
                      Compilation Failed ({compilationResult.errors.length} error{compilationResult.errors.length > 1 ? 's' : ''}):
                    </p>
                    <div className="space-y-1 pl-5 max-h-32 overflow-y-auto">
                      {compilationResult.errors.map((err, idx) => (
                        <p key={idx} className="text-[11px] text-rose-200">
                          {err.line ? `[Line ${err.line}:${err.column}] ` : ''}{err.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {compilationResult.warnings.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] mono text-amber-200 space-y-1">
                    <p className="font-semibold text-amber-300">
                      ⚠️ Compiler Warnings ({compilationResult.warnings.length}):
                    </p>
                    <div className="space-y-0.5 pl-4 max-h-24 overflow-y-auto">
                      {compilationResult.warnings.map((warn, idx) => (
                        <p key={idx} className="text-amber-300/80">
                          {warn.line ? `[Line ${warn.line}] ` : ''}{warn.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step C: Contract Selection & Parameter Configuration */}
            {compilationResult && compilationResult.success && selectedContractName && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-300">
                    2. Configure Selected Contract
                  </h4>
                  {compilationResult.contractNames.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 mono">Select Contract:</span>
                      <select
                        value={selectedContractName}
                        onChange={(e) => handleSelectContract(e.target.value)}
                        className="bg-black/60 border border-white/20 rounded-lg text-xs mono text-cyan-300 px-2 py-1 focus:outline-none"
                      >
                        {compilationResult.contractNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-cyan-300 mono bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                      {selectedContractName}
                    </span>
                  )}
                </div>

                {/* Inspection Toggles */}
                <div className="flex items-center gap-2 text-[11px] mono">
                  <button
                    onClick={() => setShowBytecodePreview(!showBytecodePreview)}
                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
                  >
                    {showBytecodePreview ? '▲ Hide Bytecode' : '▼ Inspect Bytecode'}
                  </button>
                  <button
                    onClick={() => setShowAbiPreview(!showAbiPreview)}
                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
                  >
                    {showAbiPreview ? '▲ Hide ABI' : '▼ Inspect ABI'}
                  </button>
                </div>

                {/* Bytecode Preview */}
                {showBytecodePreview && compilationResult.contracts[selectedContractName] && (
                  <div className="p-2.5 rounded-lg bg-black/60 border border-white/10 space-y-1">
                    <p className="text-[10px] text-slate-400 mono">Creation Bytecode ({compilationResult.contracts[selectedContractName].bytecode.length / 2} bytes):</p>
                    <textarea
                      readOnly
                      rows={3}
                      value={compilationResult.contracts[selectedContractName].bytecode}
                      className="w-full p-2 bg-transparent text-[10px] mono text-emerald-400/80 break-all border-0 focus:outline-none resize-none"
                    />
                  </div>
                )}

                {/* ABI Preview */}
                {showAbiPreview && compilationResult.contracts[selectedContractName] && (
                  <div className="p-2.5 rounded-lg bg-black/60 border border-white/10 space-y-1">
                    <p className="text-[10px] text-slate-400 mono">Contract ABI ({compilationResult.contracts[selectedContractName].abi.length} entries):</p>
                    <textarea
                      readOnly
                      rows={4}
                      value={JSON.stringify(compilationResult.contracts[selectedContractName].abi, null, 2)}
                      className="w-full p-2 bg-transparent text-[10px] mono text-cyan-400/80 border-0 focus:outline-none resize-none font-mono"
                    />
                  </div>
                )}

                {/* Dynamic Constructor Arguments Form */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Constructor Parameters
                    </span>
                    {compilationResult.contracts[selectedContractName].constructorParams.length === 0 ? (
                      <span className="text-[11px] text-emerald-400 mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                        None required
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-300 mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                        {compilationResult.contracts[selectedContractName].constructorParams.length} parameter{compilationResult.contracts[selectedContractName].constructorParams.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {compilationResult.contracts[selectedContractName].constructorParams.length > 0 && (
                    <div className="space-y-2.5">
                      {compilationResult.contracts[selectedContractName].constructorParams.map((param, pIdx) => {
                        const fieldKey = param.name || `param_${pIdx}`;
                        return (
                          <div key={pIdx} className="space-y-1">
                            <label className="text-[11px] mono text-slate-300 flex items-center justify-between">
                              <span className="font-semibold text-cyan-300">{fieldKey}</span>
                              <span className="text-slate-500">type: <code className="text-emerald-400">{param.type}</code></span>
                            </label>
                            <input
                              type="text"
                              value={constructorArgValues[fieldKey] || ''}
                              onChange={(e) => handleArgChange(fieldKey, e.target.value)}
                              placeholder={
                                param.type === 'address'
                                  ? '0x...'
                                  : param.type.startsWith('uint')
                                  ? 'e.g. 1000000'
                                  : param.type === 'bool'
                                  ? 'true or false'
                                  : `Enter ${param.type}`
                              }
                              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={handlePrepareReview}
                      disabled={isPreparingPlan}
                      className="w-full py-2.5 rounded-xl text-xs font-bold mono bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition shadow-lg shadow-cyan-600/20"
                    >
                      {isPreparingPlan ? 'Estimating Preflight via Portaldot RPC...' : '🔍 Review Deployment Parameters'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step D: Deployment Review & Confirmation Interface */}
            {deploymentPlan && (
              <div className="p-4 rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Deployment Preflight Review
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Verified parameters &bull; Zero broadcast until Stage 3D
                    </p>
                  </div>
                  <span className={`text-[11px] mono font-bold px-2.5 py-1 rounded-lg border ${
                    deploymentPlan.isValid
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {deploymentPlan.isValid ? '✓ Ready for Review' : '⚠ Validation Warning'}
                  </span>
                </div>

                {/* Review Specifications Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Contract</span>
                    <p className="text-white font-semibold truncate">{deploymentPlan.contractName}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Source File</span>
                    <p className="text-slate-300 truncate">{deploymentPlan.fileName}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Compiler Settings</span>
                    <p className="text-emerald-400 truncate">v{deploymentPlan.compilerVersion} ({deploymentPlan.evmVersion}, {deploymentPlan.optimizerRuns} runs)</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Target Network</span>
                    <p className="text-cyan-300 truncate">Portaldot V3 ({deploymentPlan.chainId})</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-0.5 col-span-2">
                    <span className="text-[10px] text-slate-500 uppercase">Deployer EVM Account</span>
                    <p className="text-white font-semibold break-all">{deploymentPlan.deployerAddress}</p>
                  </div>
                </div>

                {/* Constructor Arguments Summary */}
                {deploymentPlan.constructorParams.length > 0 && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs mono space-y-2">
                    <span className="text-[11px] text-slate-400 font-semibold">Constructor Parameters:</span>
                    <div className="space-y-1">
                      {deploymentPlan.constructorParams.map((cp, idx) => {
                        const key = cp.name || `param_${idx}`;
                        return (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">{key} ({cp.type}):</span>
                            <span className="text-cyan-300 font-mono font-semibold">{String(deploymentPlan.paramValues[key])}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Preflight Fee & Gas Estimates */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs mono space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Creation Bytecode Size:</span>
                    <span className="text-slate-200 font-semibold">{deploymentPlan.bytecodeSizeBytes} bytes ({(deploymentPlan.bytecodeSizeBytes / 1024).toFixed(1)} KB)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Estimated Gas Limit:</span>
                    <span className="text-white font-semibold">{deploymentPlan.estimatedGasDecimal}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Current Gas Price:</span>
                    <span className="text-slate-300">{deploymentPlan.gasPriceGwei} Gwei</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-white/10">
                    <span className="text-slate-300 font-semibold">Estimated Computation Fee:</span>
                    <span className="text-cyan-300 font-bold">{deploymentPlan.estimatedGasFeePot} tPOT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Deployer Balance:</span>
                    <span className={deploymentPlan.isSufficientBalance ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {deploymentPlan.deployerPotBalance !== null ? `${deploymentPlan.deployerPotBalance} tPOT` : '—'}
                    </span>
                  </div>
                </div>

                {/* Crucial Fee Distinction Notice */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] mono text-amber-200 space-y-1">
                  <p className="font-bold text-amber-300">
                    ⚠️ Gas Fee vs. Pallet-Revive State Storage Collateral Distinction:
                  </p>
                  <p className="text-amber-300/80 leading-relaxed">
                    The {deploymentPlan.estimatedGasFeePot} tPOT figure is computation gas only. Substrate <code className="text-amber-100">pallet-revive</code> will also lock state collateral (storage deposit) in POT proportional to bytecode size and storage slots during execution.
                  </p>
                </div>

                {/* STAGE 3D AUTHORIZATION BANNER */}
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-xs mono text-cyan-200 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <span>🚀 Stage 3D Authorized Deployment</span>
                    <span className="text-[10px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300">
                      Broadcasting Authorized
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-200/90 leading-relaxed">
                    Stage 3D deployment authorized for {deploymentPlan.contractName}. Click below to present the contract-creation transaction to your connected browser wallet for personal inspection and approval.
                  </p>
                </div>

                {/* Deployed Success Display */}
                {customDeployedAddress && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs mono text-emerald-200 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold">
                      <span>✅ Deployment Confirmed</span>
                    </div>
                    <div className="text-[11px] space-y-1">
                      <div>Address: <code className="text-white font-bold">{customDeployedAddress}</code></div>
                      {customDeployTx && (
                        <div>Tx Hash: <code className="text-white">{customDeployTx}</code></div>
                      )}
                      <a
                        href={`${PORTALDOT_EXPLORER_URL}address/${customDeployedAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-cyan-400 underline hover:text-cyan-300 pt-1"
                      >
                        View on Portaldot Explorer ↗
                      </a>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setDeploymentPlan(null)}
                    disabled={isProcessing}
                    className="flex-1 py-3 rounded-xl text-xs font-semibold mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition disabled:opacity-50"
                  >
                    ← Edit Parameters
                  </button>
                  <button
                    disabled={!deploymentPlan.isValid || isProcessing || !evmWalletState.isCorrectNetwork}
                    onClick={handleDeployCustom}
                    className="flex-1 py-3 rounded-xl text-xs font-bold mono bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition shadow-lg shadow-cyan-950/40"
                    title={!evmWalletState.isCorrectNetwork ? 'Please connect to Portaldot V3 Testnet' : 'Deploy contract via browser wallet'}
                  >
                    {isProcessing ? '⏳ Prompting Wallet...' : '🚀 Deploy via Browser Wallet'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
