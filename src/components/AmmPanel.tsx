import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EvmRpcClient } from '../services/evmRpc';
import { EvmWalletState } from '../services/evmWallet';
import { formatTokenAmount } from '../services/contractMath';
import { LIVE_DEPLOYMENT, NETWORK_CONFIG } from '../contracts/config';
import {
  TX_SUBMISSION_ENABLED,
  PoolReserves,
  LpPosition,
  PreparedTx,
  readReserves,
  readPotBalance,
  readPusdcBalance,
  readAllowance,
  readPusdcTotalSupply,
  readLpPositions,
  isPoolEmpty,
  needsPusdcApproval,
  parseAmountStrict,
  applySlippageDown,
  swapOut,
  quoteAddLiquidity,
  deadlineFrom,
  prepareFaucetMint,
  prepareApprove,
  prepareAddLiquidity,
  prepareRemoveLiquidity,
  prepareSwapPotForUsdc,
  prepareSwapUsdcForPot,
  classifyReadError,
} from '../services/ammService';

interface Props {
  evmClient: EvmRpcClient;
  wallet: EvmWalletState;
}

type Mode = 'swap' | 'add' | 'remove' | 'faucet';
type Dir = 'pot2usdc' | 'usdc2pot';

interface LiveData {
  reserves: PoolReserves;
  pusdcTotalSupply: bigint;
  potBalance: bigint | null;
  usdcBalance: bigint | null;
  allowance: bigint | null;
  positions: LpPosition[];
  positionsError: string | null;
}

const fmtPot = (v: bigint) => formatTokenAmount(v, 18, 6);
const fmtUsdc = (v: bigint) => formatTokenAmount(v, 6, 2);

export const AmmPanel: React.FC<Props> = ({ evmClient, wallet }) => {
  const [mode, setMode] = useState<Mode>('swap');
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [dir, setDir] = useState<Dir>('pot2usdc');
  const [swapIn, setSwapIn] = useState('');
  const [addPot, setAddPot] = useState('');
  const [addUsdc, setAddUsdc] = useState('');
  const [faucetAmt, setFaucetAmt] = useState('');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [slippageBps, setSlippageBps] = useState(50);
  const [deadlineMin, setDeadlineMin] = useState(20);

  const rpc = useCallback(async (method: string, params: any[]) => (await evmClient.query(method, params)).result, [evmClient]);

  const connected = wallet.isConnected && !!wallet.address;
  const wrongNetwork = connected && !wallet.isCorrectNetwork;
  const account = connected && wallet.isCorrectNetwork ? wallet.address : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [reserves, pusdcTotalSupply] = await Promise.all([
          readReserves(rpc),
          readPusdcTotalSupply(rpc),
        ]);
        let potBalance: bigint | null = null;
        let usdcBalance: bigint | null = null;
        let allowance: bigint | null = null;
        let positions: LpPosition[] = [];
        let positionsError: string | null = null;
        if (account) {
          [potBalance, usdcBalance, allowance] = await Promise.all([
            readPotBalance(rpc, account),
            readPusdcBalance(rpc, account),
            readAllowance(rpc, account),
          ]);
          try {
            positions = await readLpPositions(rpc, account, reserves);
          } catch (e) {
            positionsError = classifyReadError(e);
          }
        }
        if (!cancelled) {
          setData({ reserves, pusdcTotalSupply, potBalance, usdcBalance, allowance, positions, positionsError });
          setReadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setReadError(classifyReadError(e));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rpc, account, refreshTick]);

  const empty = data ? isPoolEmpty(data.reserves) : false;
  const nowSec = Math.floor(Date.now() / 1000);

  // ---------------- review computation (pure; never sends anything)
  const review = useMemo(() => {
    type R = { error?: string; lines?: Array<[string, string]>; txs?: PreparedTx[]; warnings?: string[] };
    if (!data) return {} as R;
    const r = data.reserves;
    const recipient = account || LIVE_DEPLOYMENT.deployerAddress;
    const isPreviewRecipient = !account;
    try {
      if (mode === 'faucet') {
        const p = parseAmountStrict(faucetAmt, 6);
        if (!p.ok) return { error: faucetAmt ? p.error : undefined } as R;
        const tx = prepareFaucetMint(recipient, p.value);
        const warnings: string[] = [];
        if (isPreviewRecipient) {
          warnings.push('Preview mode (wallet disconnected): showing prepared calldata for reference deployer address. Connect a Portaldot V3 wallet to prepare for your own address.');
        }
        return {
          warnings,
          lines: [
            ['Action', 'faucetMint(address,uint256) on pUSDC'],
            ['Recipient', isPreviewRecipient ? `${recipient} (reference preview)` : recipient],
            ['Amount', `${fmtUsdc(p.value)} pUSDC (test token)`],
            ['Native POT sent', '0 (plus network gas & pallet-revive storage deposit)'],
          ],
          txs: [tx],
        } as R;
      }
      if (mode === 'swap') {
        if (empty) return { error: 'Trading is unavailable until liquidity is added.' } as R;
        const inDec = dir === 'pot2usdc' ? 18 : 6;
        const p = parseAmountStrict(swapIn, inDec);
        if (!p.ok) return { error: swapIn ? p.error : undefined } as R;
        const [rin, rout] = dir === 'pot2usdc' ? [r.reservePot, r.reserveUsdc] : [r.reserveUsdc, r.reservePot];
        const out = swapOut(p.value, rin, rout);
        if (out === 0n) return { error: 'Amount too small: output rounds to zero' } as R;
        const minOut = applySlippageDown(out, slippageBps);
        const deadline = deadlineFrom(nowSec, deadlineMin);
        const fee = (p.value * 3n) / 1000n;
        const outDec = dir === 'pot2usdc' ? fmtUsdc : fmtPot;
        const inFmt = dir === 'pot2usdc' ? fmtPot : fmtUsdc;
        const inSym = dir === 'pot2usdc' ? 'POT' : 'pUSDC';
        const outSym = dir === 'pot2usdc' ? 'pUSDC' : 'POT';
        const txs: PreparedTx[] = [];
        const warnings: string[] = [];
        if (isPreviewRecipient) {
          warnings.push('Preview mode (wallet disconnected): showing prepared calldata for reference deployer address.');
        }
        let balErr: string | undefined;
        if (dir === 'pot2usdc') {
          if (data.potBalance !== null && p.value > data.potBalance) balErr = 'Amount exceeds your POT balance';
          txs.push(prepareSwapPotForUsdc(p.value, minOut, recipient, deadline));
        } else {
          if (data.usdcBalance !== null && p.value > data.usdcBalance) balErr = 'Amount exceeds your pUSDC balance';
          if (needsPusdcApproval(data.allowance, p.value)) {
            txs.push(prepareApprove(p.value));
            warnings.push('Step 1 of 2: Exact-amount pUSDC approval for the AMM is required before the swap.');
          }
          txs.push(prepareSwapUsdcForPot(p.value, minOut, recipient, deadline));
        }
        const impact = (() => {
          const ideal = (p.value * rout) / rin;
          return ideal > 0n ? Number(((ideal - out) * 10000n) / ideal) / 100 : 0;
        })();
        return {
          error: balErr,
          warnings,
          lines: [
            ['You pay', `${inFmt(p.value)} ${inSym}`],
            ['Estimated receive', `${outDec(out)} ${outSym}`],
            [`Minimum receive (${slippageBps / 100}% slippage)`, `${outDec(minOut)} ${outSym}`],
            ['Fee (0.3% of input)', `${inFmt(fee)} ${inSym}`],
            ['Price impact', `${impact.toFixed(2)}%`],
            ['Deadline', `${deadlineMin} min (unix ${deadline})`],
            ['Recipient', isPreviewRecipient ? `${recipient} (reference preview)` : recipient],
          ],
          txs,
        } as R;
      }
      if (mode === 'add') {
        const pp = parseAmountStrict(addPot, 18);
        const pu = parseAmountStrict(addUsdc, 6);
        if (!pp.ok) return { error: addPot ? pp.error : undefined } as R;
        if (!pu.ok) return { error: addUsdc ? pu.error : undefined } as R;
        const q = quoteAddLiquidity(pp.value, pu.value, r, slippageBps);
        const deadline = deadlineFrom(nowSec, deadlineMin);
        let balErr: string | undefined;
        if (data.potBalance !== null && pp.value > data.potBalance) balErr = 'Amount exceeds your POT balance';
        if (data.usdcBalance !== null && q.amountUsdc > data.usdcBalance) balErr = 'Amount exceeds your pUSDC balance';
        const txs: PreparedTx[] = [];
        const warnings: string[] = [];
        if (isPreviewRecipient) {
          warnings.push('Preview mode (wallet disconnected): showing prepared calldata for reference deployer address. Connect a Portaldot V3 wallet to check your own balances.');
        }
        if (needsPusdcApproval(data.allowance, q.amountUsdc)) {
          txs.push(prepareApprove(q.amountUsdc));
          warnings.push('Step 1 of 2: Exact-amount pUSDC approval for the AMM is required before adding liquidity.');
        }
        txs.push(prepareAddLiquidity(pp.value, pu.value, q, deadline));
        if (q.isFirstDeposit) warnings.push('You are the first liquidity provider: your ratio sets the initial pool price. 1000 shares are permanently locked.');
        return {
          error: balErr,
          warnings,
          lines: [
            ['POT sent as msg.value', `${fmtPot(pp.value)} POT`],
            ['pUSDC deposited (estimate)', `${fmtUsdc(q.amountUsdc)} pUSDC`],
            ['POT refunded by contract', `${fmtPot(q.refundPot)} POT`],
            ['LP shares minted (estimate)', q.shares.toString()],
            ['Minimum POT / pUSDC', q.isFirstDeposit ? 'n/a (first deposit)' : `${fmtPot(q.minPot)} / ${fmtUsdc(q.minUsdc)}`],
            ['Deadline', `${deadlineMin} min (unix ${deadline})`],
          ],
          txs,
        } as R;
      }
      // remove
      if (!selectedToken) return {} as R;
      const pos = data.positions.find((x) => x.tokenId.toString() === selectedToken);
      if (!pos) return { error: 'Select one of your positions' } as R;
      if (!account) return { error: 'Connect wallet on Portaldot V3 first' } as R;
      const minPot = applySlippageDown(pos.currentPot, slippageBps);
      const minUsdc = applySlippageDown(pos.currentUsdc, slippageBps);
      const deadline = deadlineFrom(nowSec, deadlineMin);
      return {
        lines: [
          ['Position', `#${pos.tokenId} (entire position is redeemed and burned)`],
          ['Estimated POT returned', `${fmtPot(pos.currentPot)} POT`],
          ['Estimated pUSDC returned', `${fmtUsdc(pos.currentUsdc)} pUSDC`],
          [`Minimum (${slippageBps / 100}% slippage)`, `${fmtPot(minPot)} POT / ${fmtUsdc(minUsdc)} pUSDC`],
          ['Deadline', `${deadlineMin} min (unix ${deadline})`],
          ['Recipient', account],
        ],
        txs: [prepareRemoveLiquidity(pos.tokenId, minPot, minUsdc, account, deadline)],
      } as R;
    } catch (e: any) {
      return { error: e?.message || 'Invalid input' } as R;
    }
  }, [data, mode, dir, swapIn, addPot, addUsdc, faucetAmt, selectedToken, slippageBps, deadlineMin, account, empty, nowSec]);

  // ---------------- render
  const stateBanner = (() => {
    if (loading && !data) return { tone: 'text-slate-300', text: 'Loading live pool data from Portaldot V3…' };
    if (readError) return { tone: 'text-rose-400', text: `${readError}. Live data unavailable — nothing is shown as a fallback.` };
    return null;
  })();

  const mismatchNote = !connected
    ? 'Wallet disconnected. Connect an EVM wallet to see balances and prepare transactions.'
    : wrongNetwork
    ? `Unsupported network (chain ${wallet.chainId}). Switch to Portaldot V3 Testnet (${NETWORK_CONFIG.chainIdDec}).`
    : null;

  const handlePreviewInitialDeposit = () => {
    setMode('add');
    setAddPot('0.5');
    setAddUsdc('10');
  };

  return (
    <div id="tab-amm" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Nexus AMM — native POT / pUSDC</h3>
          <p className="text-xs text-slate-400">Trades native POT directly. No wrapping. No WPOT.</p>
        </div>
        <button
          onClick={() => setRefreshTick((t) => t + 1)}
          className="px-2.5 py-1 rounded-md text-[11px] mono bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
        >
          Refresh
        </button>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
        ⚠ {LIVE_DEPLOYMENT.tokenDisclosure}
      </div>

      {/* Verified Architecture A Deployment Summary */}
      <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] mono space-y-1">
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">NexusAMMNative (Block #{LIVE_DEPLOYMENT.ammDeployBlock})</span>
          <span className="text-cyan-300 truncate">{LIVE_DEPLOYMENT.ammAddress}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">TestUSDCMin / pUSDC (Block #{LIVE_DEPLOYMENT.pusdcDeployBlock})</span>
          <span className="text-emerald-300 truncate">{LIVE_DEPLOYMENT.pusdcAddress}</span>
        </div>
      </div>

      {stateBanner && (
        <div className={`p-3 rounded-xl bg-black/40 border border-white/10 text-xs mono space-y-2 ${stateBanner.tone}`}>
          <p>{stateBanner.text}</p>
          {readError && (
            <button
              onClick={() => setRefreshTick((t) => t + 1)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] mono transition"
            >
              Retry Live Read
            </button>
          )}
        </div>
      )}
      {mismatchNote && <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs mono text-amber-300">{mismatchNote}</div>}

      {data && (
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs mono space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-400">Pool POT reserve</span><span id="reserve-pot" className="text-white">{fmtPot(data.reserves.reservePot)} POT</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Pool pUSDC reserve</span><span id="reserve-usdc" className="text-white">{fmtUsdc(data.reserves.reserveUsdc)} pUSDC</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Total LP shares</span><span className="text-white">{data.reserves.totalShares.toString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">pUSDC total supply on-chain</span><span className="text-white">{fmtUsdc(data.pusdcTotalSupply)} pUSDC</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Your POT balance</span><span className="text-white">{account && data.potBalance !== null ? `${fmtPot(data.potBalance)} POT` : '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Your pUSDC balance (test token)</span><span className="text-white">{account && data.usdcBalance !== null ? `${fmtUsdc(data.usdcBalance)} pUSDC` : '—'}</span></div>
          {empty && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <p id="empty-pool" className="text-amber-300">
                The pool has zero reserves. Trading is unavailable until liquidity is added.
              </p>
              <button
                type="button"
                id="btn-preview-seed"
                onClick={handlePreviewInitialDeposit}
                className="px-2.5 py-1 rounded-md text-[11px] mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 transition"
              >
                Preview Initial Liquidity Calldata (0.5 POT + 10 pUSDC) →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {(['swap', 'add', 'remove', 'faucet'] as Mode[]).map((m) => (
          <button
            key={m}
            id={`amm-mode-${m}`}
            onClick={() => setMode(m)}
            className={`py-1.5 rounded-lg text-[11px] mono ${mode === m ? 'bg-cyan-500/25 text-white border border-cyan-400/40' : 'text-slate-400 bg-white/5'}`}
          >
            {m === 'swap' ? 'Swap' : m === 'add' ? 'Add' : m === 'remove' ? 'Remove' : 'Faucet'}
          </button>
        ))}
      </div>

      {mode === 'swap' && (
        <div className="space-y-2">
          <div className="flex gap-2 text-[11px] mono">
            <button onClick={() => setDir('pot2usdc')} className={`px-2 py-1 rounded ${dir === 'pot2usdc' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>POT → pUSDC</button>
            <button onClick={() => setDir('usdc2pot')} className={`px-2 py-1 rounded ${dir === 'usdc2pot' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>pUSDC → POT</button>
          </div>
          <AmountInput id="swap-in" label={`Pay (${dir === 'pot2usdc' ? 'native POT' : 'pUSDC'})`} value={swapIn} onChange={setSwapIn} />
        </div>
      )}
      {mode === 'add' && (
        <div className="space-y-2">
          <AmountInput id="add-pot" label="Native POT" value={addPot} onChange={setAddPot} />
          <AmountInput id="add-usdc" label="pUSDC (max to deposit)" value={addUsdc} onChange={setAddUsdc} />
        </div>
      )}
      {mode === 'remove' && (
        <div className="space-y-2 text-xs mono">
          {!account && <p className="text-slate-400">Connect wallet to see your LP positions.</p>}
          {account && data?.positionsError && <p className="text-rose-400">{data.positionsError}</p>}
          {account && data && !data.positionsError && data.positions.length === 0 && <p id="no-positions" className="text-slate-400">No LP positions found for this wallet.</p>}
          {data?.positions.map((p) => (
            <label key={p.tokenId.toString()} className="flex items-start gap-2 p-2 rounded-lg bg-black/40 border border-white/10">
              <input type="radio" name="pos" checked={selectedToken === p.tokenId.toString()} onChange={() => setSelectedToken(p.tokenId.toString())} />
              <span>
                #{p.tokenId.toString()} · {p.shares.toString()} shares · deposited {fmtPot(p.potDeposited)} POT / {fmtUsdc(p.usdcDeposited)} pUSDC ·
                now ≈ {fmtPot(p.currentPot)} POT / {fmtUsdc(p.currentUsdc)} pUSDC
              </span>
            </label>
          ))}
        </div>
      )}
      {mode === 'faucet' && (
        <div className="space-y-2">
          <AmountInput id="faucet-amt" label={`pUSDC to claim (max 10,000 per call)`} value={faucetAmt} onChange={setFaucetAmt} />
        </div>
      )}

      {mode !== 'faucet' && (
        <div className="flex flex-wrap items-center gap-3 text-xs mono">
          <span className="text-slate-400">Slippage</span>
          {[10, 50, 100].map((b) => (
            <button key={b} onClick={() => setSlippageBps(b)} className={`px-2 py-0.5 rounded ${slippageBps === b ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{b / 100}%</button>
          ))}
          <span className="text-slate-400">Deadline</span>
          {[10, 20, 60].map((m) => (
            <button key={m} onClick={() => setDeadlineMin(m)} className={`px-2 py-0.5 rounded ${deadlineMin === m ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{m}m</button>
          ))}
        </div>
      )}

      {review.error && <p id="review-error" className="text-xs mono text-rose-400">{review.error}</p>}
      {review.warnings?.map((w) => (
        <p key={w} className="text-xs mono text-amber-300">{w}</p>
      ))}
      {review.lines && !review.error && (
        <div id="review" className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs mono space-y-1.5">
          <p className="text-slate-300 font-semibold">Confirmation details (estimates; not yet submitted)</p>
          {review.lines.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><span className="text-slate-400">{k}</span><span className="text-white text-right break-all">{v}</span></div>
          ))}
          {review.txs?.map((t, i) => (
            <div key={i} className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 break-all">
              Tx {i + 1}: {t.label} → {t.to} · value {t.valueHex} · data {t.data.slice(0, 10)}…
            </div>
          ))}
        </div>
      )}

      <button
        disabled={!TX_SUBMISSION_ENABLED}
        id="submit-guarded"
        className="w-full py-3 rounded-2xl font-bold text-xs mono bg-slate-800 text-slate-400 cursor-not-allowed border border-white/10"
      >
        Transaction submission disabled in this build — preparation only
      </button>
      <p className="text-[10px] text-slate-500">A connected wallet is not a confirmed transaction. Nothing is sent from this screen.</p>
    </div>
  );
};

const AmountInput: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void }> = ({ id, label, value, onChange }) => (
  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10">
    <p className="text-[11px] mono text-slate-400">{label}</p>
    <input
      id={id}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0.0"
      className="w-full bg-transparent text-xl font-bold text-white mt-1 focus:outline-none"
    />
  </div>
);

export default AmmPanel;
