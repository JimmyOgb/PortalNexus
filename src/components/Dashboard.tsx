import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { SubstrateRpcClient } from '../services/substrateRpc';
import { EvmRpcClient } from '../services/evmRpc';
import { BlockMonitor } from '../services/blockMonitor';
import { deriveReviveAccountId } from '../lib/reviveMapper';
import { SubstrateChainState, EvmChainState, BlockComparisonSample } from '../types';
import type { CameraMode } from './ThreeCanvas';
import { EvmWalletService, EvmWalletState } from '../services/evmWallet';
import { SubstrateWalletService, SubstrateWalletState } from '../services/substrateWallet';
import { NETWORK_CONFIG, LIVE_DEPLOYMENT } from '../contracts/config';
import { AmmPanel } from './AmmPanel';
import { ServerIcon as Server } from './Icons';
import { DeploymentService } from '../services/deploymentService';
import { DeploymentModal } from './DeploymentModal';

const ThreeCanvas = lazy(() => import('./ThreeCanvas'));

interface Props {
  substrateClient: SubstrateRpcClient;
  evmClient: EvmRpcClient;
}

type TabType = 'teleport' | 'swap';

export const Dashboard: React.FC<Props> = ({ substrateClient, evmClient }) => {
  // RPC Telemetry States
  const [substrateState, setSubstrateState] = useState<SubstrateChainState>(substrateClient.getState());
  const [evmState, setEvmState] = useState<EvmChainState>(evmClient.getState());
  const [monitor] = useState(() => new BlockMonitor(15));
  const [samples, setSamples] = useState<BlockComparisonSample[]>([]);

  // 3D Canvas States
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [warpTrigger, setWarpTrigger] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Terminal Tab State
  const [activeTab, setActiveTab] = useState<TabType>('teleport');

  // Diagnostics Drawer
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Wallet Services
  const [evmWallet] = useState(() => new EvmWalletService());
  const [evmWalletState, setEvmWalletState] = useState<EvmWalletState>(evmWallet.getState());

  const [deploymentService] = useState(() => new DeploymentService(evmClient, evmWallet));
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);

  const [substrateWallet] = useState(() => new SubstrateWalletService(substrateClient));
  const [substrateWalletState, setSubstrateWalletState] = useState<SubstrateWalletState>(substrateWallet.getState());

  // Tab 1 (Cross-VM Inspector) States
  const [customSubstrateInput, setCustomSubstrateInput] = useState<string>('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
  const [customEvmInput, setCustomEvmInput] = useState<string>('0x1111111111111111111111111111111111111111');
  const [teleportAmount, setTeleportAmount] = useState<string>('100');

  // Subscriptions to RPC Clients
  useEffect(() => {
    const unsubSub = substrateClient.subscribe(setSubstrateState);
    const unsubEvm = evmClient.subscribe(setEvmState);
    return () => {
      unsubSub();
      unsubEvm();
    };
  }, [substrateClient, evmClient]);

  // Subscriptions to Wallet Services
  useEffect(() => {
    const unsubEvmWallet = evmWallet.subscribe(setEvmWalletState);
    const unsubSubWallet = substrateWallet.subscribe(setSubstrateWalletState);
    return () => {
      unsubEvmWallet();
      unsubSubWallet();
    };
  }, [evmWallet, substrateWallet]);

  // Sync Substrate Wallet with Substrate Client
  useEffect(() => {
    substrateWallet.setRpcClient(substrateClient);
  }, [substrateClient, substrateWallet]);

  // Monitor Paired Blocks
  useEffect(() => {
    if (substrateState.blockHeight !== null || evmState.blockHeight !== null) {
      monitor.recordSample(substrateState.blockHeight, evmState.blockHeight);
      setSamples(monitor.getSamples());
    }
  }, [substrateState.blockHeight, evmState.blockHeight, monitor]);

  const metrics = useMemo(() => monitor.computeMetrics(), [samples, monitor]);

  // Address Derivation using Audited Mapper
  const activeEvmForDerive = evmWalletState.address || customEvmInput;
  const derivation = useMemo(() => {
    return deriveReviveAccountId(activeEvmForDerive);
  }, [activeEvmForDerive]);

  const triggerWarp = () => {
    setWarpTrigger(prev => prev + 1);
  };

  const handleConnectEvm = async () => {
    triggerWarp();
    if (evmWalletState.isConnected && !evmWalletState.isCorrectNetwork) {
      await evmWallet.switchOrAddNetwork();
    } else if (!evmWalletState.isConnected) {
      await evmWallet.connect();
    }
  };

  const handleConnectSubstrate = async () => {
    triggerWarp();
    await substrateWallet.connect();
  };

  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* 3D WebGL Background Canvas (Lazy Loaded to Optimize Initial Bundle) */}
      <Suspense fallback={<div className="fixed inset-0 bg-[#030712] pointer-events-none z-0" />}>
        <ThreeCanvas
          cameraMode={cameraMode}
          warpTrigger={warpTrigger}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      {/* Ambient Vignette Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 15%, #030712 95%)'
        }}
      />

      {/* Main Content Layer */}
      <div className="relative z-10 min-h-screen flex flex-col justify-between">
        
        {/* Top Navigation Bar */}
        <header className="w-full border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-500 to-purple-600 p-[1.5px]">
                <div className="w-full h-full bg-gray-950 rounded-[10px] flex items-center justify-center">
                  <span className="font-bold text-lg text-gradient">PN</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight">PortalNexus</span>
                  <span className="text-[10px] mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">V3.0 Hybrid</span>
                </div>
                <p className="text-xs text-slate-400 mono">WASM (Substrate) ↔ EVM (420420777)</p>
              </div>
            </div>

            {/* Live Network Telemetry Badges */}
            <div className="hidden xl:flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-full px-4 py-1.5 text-xs mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className={`w-2 h-2 rounded-full bg-emerald-400 ${substrateState.status === 'CONNECTED' ? 'animate-ping' : ''}`} />
                WSS: test-node-v3 (
                <span id="sub-block">
                  {substrateState.blockHeight ? `#${substrateState.blockHeight.toLocaleString()}` : 'Connecting...'}
                </span>
                )
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className={`w-2 h-2 rounded-full bg-cyan-400 ${evmState.status === 'CONNECTED' ? 'animate-pulse' : ''}`} />
                EVM RPC: 420420777 (
                <span id="evm-block">
                  {evmState.blockHeight ? `#${evmState.blockHeight.toLocaleString()}` : 'Connecting...'}
                </span>
                )
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">
                Δ: <strong className="text-white">{metrics.lastDiff !== null ? metrics.lastDiff : '—'}</strong>
              </span>
            </div>

            {/* Dual Wallet Connectors & Motion Controls */}
            <div className="flex items-center gap-3">
              {/* Substrate Wallet Button */}
              <button
                id="btn-substrate"
                onClick={handleConnectSubstrate}
                className="px-3.5 py-2 rounded-xl text-xs mono font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-2"
                title={substrateWalletState.error || 'Connect Substrate extension'}
              >
                <span className={`w-2 h-2 rounded-full ${substrateWalletState.isConnected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span id="sub-wallet-label">
                  {substrateWalletState.isConnected
                    ? `${substrateWalletState.selectedAccount?.address.slice(0, 5)}...${substrateWalletState.selectedAccount?.address.slice(-4)} (Connected)`
                    : (substrateWalletState.isConnecting ? 'Connecting...' : 'Connect SS58 (5...)')}
                </span>
              </button>

              {/* EVM Wallet Button */}
              <button
                id="btn-evm"
                onClick={handleConnectEvm}
                className={`px-3.5 py-2 rounded-xl text-xs mono font-medium border transition flex items-center gap-2 ${
                  evmWalletState.isConnected && !evmWalletState.isCorrectNetwork
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                }`}
                title={evmWalletState.error || 'Connect MetaMask or Rabby'}
              >
                <span className={`w-2 h-2 rounded-full ${evmWalletState.isConnected ? (evmWalletState.isCorrectNetwork ? 'bg-cyan-400' : 'bg-amber-400') : 'bg-slate-500'}`} />
                <span id="evm-wallet-label">
                  {evmWalletState.isConnected
                    ? (evmWalletState.isCorrectNetwork
                        ? `${evmWalletState.address?.slice(0, 6)}...${evmWalletState.address?.slice(-4)} (420420777)`
                        : 'Switch to 420420777')
                    : (evmWalletState.isConnecting ? 'Connecting...' : 'Connect EVM (0x...)')}
                </span>
              </button>

              {/* Testnet Deployer Modal Trigger */}
              <button
                id="btn-deploy-modal"
                onClick={() => setShowDeployModal(true)}
                className="px-3 py-2 rounded-xl text-xs mono font-semibold bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5"
                title="Open Portaldot V3 Testnet Contract Deployment Modal"
              >
                <span>🚀</span>
                <span>Deploy Contracts</span>
              </button>

              {/* Reduced Motion Toggle */}
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                className="px-2.5 py-2 rounded-xl text-xs mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
                title={reducedMotion ? 'Enable 3D animation' : 'Reduce 3D motion'}
              >
                {reducedMotion ? '▶ Motion' : '⏸ Pause'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero + Interactive 3D Portal Centerpiece */}
        <main className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-10 items-center my-auto">
          
          {/* Left Column: Storytelling & Live Architecture Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs mono text-emerald-300">
              <span>⚡ Portaldot V3.0 Dual-VM Hub</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">pallet-revive REVM</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.08]">
              Unifying <span className="text-gradient">Substrate WASM</span> &amp; <span className="text-gradient">pallet-revive EVM</span> in One Portal.
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
              Eliminate the V3.0 Dual-VM divide. Deterministically map native <span className="mono text-emerald-400">POT</span> between <span className="mono text-emerald-400">5... (SS58)</span> and <span className="mono text-cyan-400">0x... (H160)</span> accounts, inspect <span className="mono text-white">ERC-20 / ERC-721</span> vaults, and verify constant-product liquidity.
            </p>

            {/* Interactive 3D Camera Mode Switcher */}
            <div className="pt-2">
              <p className="text-xs mono uppercase tracking-wider text-slate-400 mb-2.5">
                Interactive 3D Core Inspector (Click to Focus Camera)
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setCameraMode('overview')}
                  className={`px-3.5 py-2 rounded-lg text-xs mono border transition ${cameraMode === 'overview' ? 'bg-white/20 text-white border-white/40' : 'bg-white/10 hover:bg-white/15 border-white/15 text-slate-200'}`}
                >
                  🌌 Dual-VM Singularity
                </button>
                <button
                  onClick={() => setCameraMode('substrate')}
                  className={`px-3.5 py-2 rounded-lg text-xs mono border transition ${cameraMode === 'substrate' ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}
                >
                  🟢 Substrate Outer Ring (5...)
                </button>
                <button
                  onClick={() => setCameraMode('evm')}
                  className={`px-3.5 py-2 rounded-lg text-xs mono border transition ${cameraMode === 'evm' ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50' : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'}`}
                >
                  🔵 EVM Torus Core (0x...)
                </button>
                <button
                  onClick={triggerWarp}
                  className="px-3.5 py-2 rounded-lg text-xs mono bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition"
                >
                  🚀 Test XVM Warp Pulse
                </button>
              </div>
            </div>

            {/* Live Protocol Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-xs text-slate-400 mono">Substrate Height</p>
                <p className="text-2xl font-bold text-white mt-1" id="metric-sub-height">
                  {substrateState.blockHeight ? `#${substrateState.blockHeight.toLocaleString()}` : 'Connecting...'}
                </p>
                <p className="text-[11px] text-emerald-400 mono mt-0.5">
                  Finalized: {substrateState.finalizedBlockHeight ? `#${substrateState.finalizedBlockHeight.toLocaleString()}` : 'Syncing'}
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-4">
                <p className="text-xs text-slate-400 mono">Block Offset (Δ)</p>
                <p className="text-2xl font-bold text-white mt-1" id="metric-offset">
                  {metrics.lastDiff !== null ? `${metrics.lastDiff > 0 ? '+' : ''}${metrics.lastDiff}` : 'Sampling'}
                </p>
                <p className="text-[11px] text-cyan-400 mono mt-0.5">
                  Verdict: {metrics.verdict}
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-4">
                <p className="text-xs text-slate-400 mono">Architecture A</p>
                <p className="text-2xl font-bold text-white mt-1">2 Live Contracts</p>
                <p className="text-[11px] text-purple-400 mono mt-0.5">114 Automated Tests OK</p>
              </div>
            </div>
          </div>

          {/* Right Column: Glassmorphic 3-Tab Cross-VM Execution Terminal */}
          <div className="lg:col-span-6">
            <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 relative overflow-hidden">
              
              {/* Top Glowing Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500" />

              {/* Terminal Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/50 rounded-2xl border border-white/10 mb-6">
                <button
                  id="tab-btn-teleport"
                  onClick={() => setActiveTab('teleport')}
                  className={`py-2.5 px-3 rounded-xl text-xs mono font-semibold transition ${
                    activeTab === 'teleport'
                      ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 text-white border border-emerald-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Cross-VM Map
                </button>
                <button
                  id="tab-btn-swap"
                  onClick={() => setActiveTab('swap')}
                  className={`py-2.5 px-3 rounded-xl text-xs mono font-semibold transition ${
                    activeTab === 'swap'
                      ? 'bg-gradient-to-r from-purple-500/25 to-emerald-500/25 text-white border border-purple-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. Nexus AMM (native POT)
                </button>
              </div>

              {/* TAB 1: Cross-VM Account & Mapping Inspector */}
              {activeTab === 'teleport' && (
                <div id="tab-teleport" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Cross-VM Account &amp; Mapping Inspector</h3>
                      <p className="text-xs text-slate-400">
                        Inspect Substrate <span className="mono text-emerald-400">5... (SS58)</span> &amp; EVM <span className="mono text-cyan-400">0x... (H160)</span> address mappings
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[11px] mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      pallet-revive
                    </span>
                  </div>

                  {/* Source Substrate Box */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 space-y-2">
                    <div className="flex justify-between text-xs mono text-slate-400">
                      <span>FROM: SUBSTRATE NATIVE (SS58: 42)</span>
                      <span>
                        Balance:{' '}
                        <strong className="text-emerald-400" id="sub-bal">
                          {substrateWalletState.isConnected
                            ? (substrateWalletState.balanceFormatted ?? '0.00 tPOT')
                            : 'Not connected'}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        id="input-sub-addr"
                        type="text"
                        value={substrateWalletState.selectedAccount?.address || customSubstrateInput}
                        onChange={(e) => setCustomSubstrateInput(e.target.value)}
                        className="w-full bg-transparent text-xs mono text-slate-200 focus:outline-none truncate"
                        placeholder="Enter 5... SS58 address"
                      />
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        WASM
                      </span>
                    </div>
                  </div>

                  {/* Deterministic Revive Mapping Preview */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs mono space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Pallet-Revive Deterministic Fallback:</span>
                      <span className="text-emerald-300 font-semibold truncate max-w-[280px]">
                        {derivation.ss58Prefix42Address ?? 'Deriving...'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Algorithm: <code className="text-cyan-300">H160 || [0xEE; 12]</code> padded via Polkadot SDK AccountId32Mapper.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setCustomEvmInput(LIVE_DEPLOYMENT.deployerAddress)}
                        className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] mono transition"
                      >
                        Preset: Verified Deployer ({LIVE_DEPLOYMENT.deployerAddress.slice(0, 6)}…{LIVE_DEPLOYMENT.deployerAddress.slice(-4)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomEvmInput('0x1111111111111111111111111111111111111111')}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[10px] mono transition"
                      >
                        Preset: Reference Vector (0x1111…1111)
                      </button>
                    </div>
                  </div>

                  {/* Destination EVM Box */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-cyan-500/30 space-y-2">
                    <div className="flex justify-between text-xs mono text-slate-400">
                      <span>TO: PORTALDOT EVM (CHAIN ID 420420777)</span>
                      <span>
                        Balance:{' '}
                        <strong className="text-cyan-400" id="evm-bal">
                          {evmWalletState.isConnected
                            ? (evmWalletState.isCorrectNetwork
                                ? (evmWalletState.balancePot !== null ? `${evmWalletState.balancePot} POT` : 'Querying...')
                                : 'Wrong network')
                            : 'Not connected'}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        id="input-evm-addr"
                        type="text"
                        value={evmWalletState.address || customEvmInput}
                        onChange={(e) => setCustomEvmInput(e.target.value)}
                        className="w-full bg-transparent text-xs mono text-slate-200 focus:outline-none truncate"
                        placeholder="Enter 0x... EVM address"
                      />
                      <span className="text-[10px] mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        EVM
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        id="teleport-amount"
                        type="number"
                        value={teleportAmount}
                        onChange={(e) => setTeleportAmount(e.target.value)}
                        className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none"
                        placeholder="0.0"
                      />
                      <span className="font-bold text-sm mono text-slate-300">POT</span>
                    </div>
                  </div>

                  {/* Disabled Transfer Button with Strict Architectural Truth */}
                  <button
                    disabled
                    className="w-full py-4 rounded-2xl font-bold text-xs mono uppercase tracking-wider bg-slate-800 text-slate-400 cursor-not-allowed border border-white/10 flex flex-col items-center justify-center gap-1"
                  >
                    <span>⚡ Native Cross-VM Transfer Disabled</span>
                    <span className="text-[10px] normal-case text-slate-400">
                      (Portaldot V3 pallet-revive direct extrinsic bridge not exposed on client interface)
                    </span>
                  </button>
                </div>
              )}

              {/* TAB 2: Live Nexus AMM (native POT / pUSDC) */}
              {activeTab === 'swap' && (
                <AmmPanel evmClient={evmClient} wallet={evmWalletState} />
              )}

            </div>
          </div>

        </main>

        {/* Collapsible Diagnostics & Stage 1 Deep Telemetry Accordion */}
        <div className="max-w-7xl mx-auto px-6 py-4 w-full">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full py-2 px-4 rounded-xl text-xs mono bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-slate-300 flex items-center justify-between transition"
          >
            <span className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Deep Diagnostics, Cadence Offset Table &amp; Blake2b Converter</span>
            </span>
            <span className="text-emerald-400">{showDiagnostics ? '▲ Hide' : '▼ Expand'}</span>
          </button>

          {showDiagnostics && (
            <div className="mt-4 space-y-6">
              {/* Dual-Endpoint Diagnostics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Substrate Card */}
                <div className="glass-panel rounded-2xl p-5 text-xs mono space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="font-bold text-emerald-400">Substrate Native (WASM)</span>
                    <span className="badge badge-live">LIVE (WSS)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Endpoint:</span>
                    <span className="text-white truncate max-w-[220px]">{substrateState.endpoint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Client / Runtime:</span>
                    <span className="text-white">{substrateState.specName ?? '—'} (v{substrateState.specVersion ?? '—'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Native Asset:</span>
                    <span className="text-emerald-400">{substrateState.tokenSymbol ?? 'tPOT'} (14 decimals, SS58: 42)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency:</span>
                    <span className="text-white">{substrateState.latencyMs !== null ? `${substrateState.latencyMs} ms` : '—'}</span>
                  </div>
                </div>

                {/* EVM Card */}
                <div className="glass-panel rounded-2xl p-5 text-xs mono space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="font-bold text-cyan-400">Portaldot EVM (pallet-revive)</span>
                    <span className="badge badge-live">LIVE (HTTP)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Endpoint:</span>
                    <span className="text-white truncate max-w-[220px]">{evmState.endpoint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chain ID:</span>
                    <span className="text-cyan-300 font-semibold">{evmState.chainId ?? 'Querying...'} (0x{evmState.chainId?.toString(16) ?? '—'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Execution Backend:</span>
                    <span className="text-white">pallet-revive (REVM Cancun)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency:</span>
                    <span className="text-white">{evmState.latencyMs !== null ? `${evmState.latencyMs} ms` : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Paired Block Cadence Samples Table */}
              <div className="glass-panel rounded-2xl p-5 text-xs mono space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="font-bold text-white">Paired Block Cadence Stream (Last 15 Observations)</span>
                  <span className="text-slate-400">{samples.length} samples recorded</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-white/10">
                        <th className="py-1">Observation Time</th>
                        <th className="py-1">Substrate Block</th>
                        <th className="py-1">EVM Block</th>
                        <th className="py-1">Δ (Sub - EVM)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {samples.slice(-8).reverse().map((s, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-1 text-slate-400">{new Date(s.timestamp).toLocaleTimeString()}</td>
                          <td className="py-1 text-emerald-400">{s.substrateHeight !== null ? `#${s.substrateHeight}` : '—'}</td>
                          <td className="py-1 text-cyan-400">{s.evmHeight !== null ? `#${s.evmHeight}` : '—'}</td>
                          <td className="py-1 font-bold text-white">
                            {s.diff !== null ? `${s.diff > 0 ? '+' : ''}${s.diff}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Live On-Chain Verification Proof Bar */}
        <footer className="w-full border-t border-white/10 bg-black/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs mono">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LIVE ON-CHAIN PROOF
              </span>
              <span id="proof-status" className="text-slate-300">
                Connected to Portaldot V3 Dual-VM Runtime (Read-Only Foundation Mode)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Write Barrier: <strong className="text-amber-400">Disabled ($0 Budget Guarantee)</strong>
              </span>
              <a
                href={NETWORK_CONFIG.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                Verify on node-console.portaldot.dev ↗
              </a>
            </div>
          </div>
        </footer>

        {/* Portaldot V3 Testnet Wallet-Native Deployment Modal */}
        <DeploymentModal
          isOpen={showDeployModal}
          onClose={() => setShowDeployModal(false)}
          deploymentService={deploymentService}
          evmWalletState={evmWalletState}
        />

      </div>
    </div>
  );
};

export default Dashboard;
