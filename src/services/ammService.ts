/**
 * Live read layer + transaction PREPARATION for Architecture A
 * (NexusAMMNative native POT / pUSDC pool + TestUSDCMin).
 *
 * This module never signs or sends anything. Prepared transactions are plain
 * {to, data, value} objects shown to the user for review; broadcasting is gated
 * separately by TX_SUBMISSION_ENABLED in the UI.
 */

import { LIVE_DEPLOYMENT } from '../contracts/config';
import {
  SELECTORS,
  LIQUIDITY_ADDED_TOPIC0,
  decodeWords,
  encodeAddress,
  encodeCall,
  isAddress,
} from '../contracts/abi';
import { parseTokenAmount } from './contractMath';

/** Safety barrier: no transaction is ever sent while this is false. */
export const TX_SUBMISSION_ENABLED = false;

export type RpcCall = (method: string, params: any[]) => Promise<any>;

export interface PoolReserves {
  reservePot: bigint;
  reserveUsdc: bigint;
  totalShares: bigint;
}

export interface LpPosition {
  tokenId: bigint;
  shares: bigint;
  potDeposited: bigint;
  usdcDeposited: bigint;
  timestamp: bigint;
  currentPot: bigint;
  currentUsdc: bigint;
}

export interface PreparedTx {
  label: string;
  to: string;
  data: string;
  /** wei, for payable calls */
  value: bigint;
  valueHex: string;
}

const ethCall = async (rpc: RpcCall, to: string, data: string): Promise<string> =>
  rpc('eth_call', [{ to, data }, 'latest']);

export async function readReserves(rpc: RpcCall): Promise<PoolReserves> {
  const [res, shares] = await Promise.all([
    ethCall(rpc, LIVE_DEPLOYMENT.ammAddress, SELECTORS.getReserves),
    ethCall(rpc, LIVE_DEPLOYMENT.ammAddress, SELECTORS.totalLiquidityShares),
  ]);
  const [reservePot, reserveUsdc] = decodeWords(res, 2);
  const [totalShares] = decodeWords(shares, 1);
  return { reservePot, reserveUsdc, totalShares };
}

export async function readPotBalance(rpc: RpcCall, owner: string): Promise<bigint> {
  if (!isAddress(owner)) throw new Error('Invalid wallet address');
  const hex = await rpc('eth_getBalance', [owner, 'latest']);
  return BigInt(hex);
}

export async function readPusdcBalance(rpc: RpcCall, owner: string): Promise<bigint> {
  const out = await ethCall(rpc, LIVE_DEPLOYMENT.pusdcAddress, encodeCall(SELECTORS.balanceOf, [{ t: 'address', v: owner }]));
  return decodeWords(out, 1)[0];
}

export async function readAllowance(rpc: RpcCall, owner: string): Promise<bigint> {
  const out = await ethCall(
    rpc,
    LIVE_DEPLOYMENT.pusdcAddress,
    encodeCall(SELECTORS.allowance, [
      { t: 'address', v: owner },
      { t: 'address', v: LIVE_DEPLOYMENT.ammAddress },
    ])
  );
  return decodeWords(out, 1)[0];
}

export async function readPusdcTotalSupply(rpc: RpcCall): Promise<bigint> {
  const out = await ethCall(rpc, LIVE_DEPLOYMENT.pusdcAddress, SELECTORS.totalSupply);
  return decodeWords(out, 1)[0];
}

/**
 * Determines whether an exact-amount pUSDC approval transaction must precede an AMM call.
 * When wallet is disconnected (currentAllowance === null), returns true so the 2-step flow is visible in preview.
 */
export function needsPusdcApproval(currentAllowance: bigint | null, requiredUsdc: bigint): boolean {
  if (requiredUsdc <= 0n) return false;
  if (currentAllowance === null) return true;
  return currentAllowance < requiredUsdc;
}

/**
 * The AMM has no enumeration function, so candidate position ids are discovered from
 * LiquidityAdded logs (indexed provider) and each id is then verified on-chain with
 * ownerOf() and getPosition(). Burned / transferred positions are filtered out.
 */
export async function readLpPositions(rpc: RpcCall, owner: string, reserves: PoolReserves): Promise<LpPosition[]> {
  const logs: Array<{ topics: string[] }> = await rpc('eth_getLogs', [
    {
      address: LIVE_DEPLOYMENT.ammAddress,
      fromBlock: '0x' + LIVE_DEPLOYMENT.ammDeployBlock.toString(16),
      toBlock: 'latest',
      topics: [LIQUIDITY_ADDED_TOPIC0, '0x' + encodeAddress(owner)],
    },
  ]);
  const ids = Array.from(new Set((logs || []).map((l) => BigInt(l.topics[2]))));
  const positions: LpPosition[] = [];
  for (const id of ids) {
    const idWord = id.toString(16).padStart(64, '0');
    const ownerHex = await ethCall(rpc, LIVE_DEPLOYMENT.ammAddress, SELECTORS.ownerOf + idWord);
    const [ownerWord] = decodeWords(ownerHex, 1);
    if (ownerWord !== BigInt(owner)) continue;
    const posHex = await ethCall(rpc, LIVE_DEPLOYMENT.ammAddress, SELECTORS.getPosition + idWord);
    const [, shares, potDeposited, usdcDeposited, timestamp] = decodeWords(posHex, 5);
    if (shares === 0n) continue;
    const { currentPot, currentUsdc } = positionValue(shares, reserves);
    positions.push({ tokenId: id, shares, potDeposited, usdcDeposited, timestamp, currentPot, currentUsdc });
  }
  return positions;
}

export function positionValue(shares: bigint, r: PoolReserves): { currentPot: bigint; currentUsdc: bigint } {
  if (r.totalShares === 0n) return { currentPot: 0n, currentUsdc: 0n };
  return {
    currentPot: (shares * r.reservePot) / r.totalShares,
    currentUsdc: (shares * r.reserveUsdc) / r.totalShares,
  };
}

export function isPoolEmpty(r: PoolReserves | null): boolean {
  return !!r && (r.reservePot === 0n || r.reserveUsdc === 0n || r.totalShares === 0n);
}

// ---------------------------------------------------------------- validation

export type ParseResult = { ok: true; value: bigint } | { ok: false; error: string };

/** Strict amount parsing: rejects empty, negative, exponent, malformed and over-precise input. */
export function parseAmountStrict(input: string, decimals: number): ParseResult {
  const s = (input ?? '').trim();
  if (!s) return { ok: false, error: 'Enter an amount' };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { ok: false, error: 'Enter a valid positive number' };
  const frac = s.split('.')[1] ?? '';
  if (frac.length > decimals) return { ok: false, error: `Maximum ${decimals} decimal places` };
  const v = parseTokenAmount(s, decimals);
  if (v <= 0n) return { ok: false, error: 'Amount must be greater than zero' };
  return { ok: true, value: v };
}

export function applySlippageDown(amount: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) {
    throw new Error('Slippage must be an integer between 0 and 5000 bps');
  }
  return (amount * BigInt(10000 - slippageBps)) / 10000n;
}

export function validateDeadlineMinutes(min: number): void {
  if (!Number.isInteger(min) || min < 1 || min > 120) throw new Error('Deadline must be 1–120 minutes');
}

export function deadlineFrom(nowSec: number, minutes: number): bigint {
  validateDeadlineMinutes(minutes);
  return BigInt(nowSec + minutes * 60);
}

// ---------------------------------------------------------------- swap math (mirrors NexusAMMNative)

export function swapOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n) throw new Error('Amount must be greater than zero');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('Pool has no liquidity');
  const inFee = amountIn * 997n;
  const out = (inFee * reserveOut) / (reserveIn * 1000n + inFee);
  if (out >= reserveOut) throw new Error('Swap would drain the pool');
  return out;
}

// ---------------------------------------------------------------- liquidity math

export interface AddLiquidityQuote {
  isFirstDeposit: boolean;
  amountPot: bigint;
  amountUsdc: bigint;
  refundPot: bigint;
  shares: bigint;
  minPot: bigint;
  minUsdc: bigint;
}

export function isqrt(y: bigint): bigint {
  if (y < 0n) throw new Error('negative');
  if (y < 2n) return y;
  let z = y;
  let x = y / 2n + 1n;
  while (x < z) {
    z = x;
    x = (y / x + x) / 2n;
  }
  return z;
}

/** Mirrors NexusAMMNative.addLiquidity. potIn is msg.value, usdcDesired is the approved pUSDC amount. */
export function quoteAddLiquidity(potIn: bigint, usdcDesired: bigint, r: PoolReserves, slippageBps: number): AddLiquidityQuote {
  if (potIn <= 0n || usdcDesired <= 0n) throw new Error('Both amounts must be greater than zero');
  if (isPoolEmpty(r)) {
    const root = isqrt(potIn * usdcDesired);
    if (root <= 1000n) throw new Error('Initial deposit too small (shares must exceed MINIMUM_LIQUIDITY of 1000)');
    return {
      isFirstDeposit: true,
      amountPot: potIn,
      amountUsdc: usdcDesired,
      refundPot: 0n,
      shares: root - 1000n,
      minPot: 0n,
      minUsdc: 0n,
    };
  }
  let amountPot = potIn;
  let amountUsdc: bigint;
  let refundPot = 0n;
  const optimalUsdc = (potIn * r.reserveUsdc) / r.reservePot;
  if (optimalUsdc <= usdcDesired) {
    amountUsdc = optimalUsdc;
  } else {
    const optimalPot = (usdcDesired * r.reservePot) / r.reserveUsdc;
    if (optimalPot > potIn) throw new Error('Amounts do not match the pool ratio');
    refundPot = potIn - optimalPot;
    amountPot = optimalPot;
    amountUsdc = usdcDesired;
  }
  const s0 = (amountPot * r.totalShares) / r.reservePot;
  const s1 = (amountUsdc * r.totalShares) / r.reserveUsdc;
  const shares = s0 < s1 ? s0 : s1;
  if (shares <= 0n) throw new Error('Deposit too small to mint any shares');
  return {
    isFirstDeposit: false,
    amountPot,
    amountUsdc,
    refundPot,
    shares,
    minPot: applySlippageDown(amountPot, slippageBps),
    minUsdc: applySlippageDown(amountUsdc, slippageBps),
  };
}

// ---------------------------------------------------------------- transaction preparation

const toHexValue = (v: bigint) => '0x' + v.toString(16);

export function prepareFaucetMint(recipient: string, amount: bigint): PreparedTx {
  if (!isAddress(recipient)) throw new Error('Invalid recipient address');
  if (amount <= 0n) throw new Error('Amount must be greater than zero');
  if (amount > LIVE_DEPLOYMENT.faucetMaxPerCallBase) throw new Error('Faucet cap is 10,000 pUSDC per call');
  return {
    label: 'Claim pUSDC (faucetMint)',
    to: LIVE_DEPLOYMENT.pusdcAddress,
    data: encodeCall(SELECTORS.faucetMint, [
      { t: 'address', v: recipient },
      { t: 'uint', v: amount },
    ]),
    value: 0n,
    valueHex: '0x0',
  };
}

/** Exact-amount approval (no unlimited allowance). Required by addLiquidity and swapExactTokensForPOT. */
export function prepareApprove(amount: bigint): PreparedTx {
  if (amount <= 0n) throw new Error('Amount must be greater than zero');
  return {
    label: 'Approve pUSDC for the AMM',
    to: LIVE_DEPLOYMENT.pusdcAddress,
    data: encodeCall(SELECTORS.approve, [
      { t: 'address', v: LIVE_DEPLOYMENT.ammAddress },
      { t: 'uint', v: amount },
    ]),
    value: 0n,
    valueHex: '0x0',
  };
}

/** potIn is sent as msg.value (any excess over the pool ratio is refunded by the contract). */
export function prepareAddLiquidity(potIn: bigint, usdcDesired: bigint, q: AddLiquidityQuote, deadline: bigint): PreparedTx {
  if (potIn <= 0n || usdcDesired <= 0n) throw new Error('Both amounts must be greater than zero');
  return {
    label: 'Add liquidity',
    to: LIVE_DEPLOYMENT.ammAddress,
    data: encodeCall(SELECTORS.addLiquidity, [
      { t: 'uint', v: usdcDesired },
      { t: 'uint', v: q.minPot },
      { t: 'uint', v: q.minUsdc },
      { t: 'uint', v: deadline },
    ]),
    value: potIn,
    valueHex: toHexValue(potIn),
  };
}

export function prepareRemoveLiquidity(tokenId: bigint, minPot: bigint, minUsdc: bigint, to: string, deadline: bigint): PreparedTx {
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  return {
    label: 'Remove liquidity',
    to: LIVE_DEPLOYMENT.ammAddress,
    data: encodeCall(SELECTORS.removeLiquidity, [
      { t: 'uint', v: tokenId },
      { t: 'uint', v: minPot },
      { t: 'uint', v: minUsdc },
      { t: 'address', v: to },
      { t: 'uint', v: deadline },
    ]),
    value: 0n,
    valueHex: '0x0',
  };
}

export function prepareSwapPotForUsdc(amountInPot: bigint, minOut: bigint, to: string, deadline: bigint): PreparedTx {
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  if (amountInPot <= 0n) throw new Error('Amount must be greater than zero');
  return {
    label: 'Swap POT → pUSDC',
    to: LIVE_DEPLOYMENT.ammAddress,
    data: encodeCall(SELECTORS.swapExactPOTForTokens, [
      { t: 'uint', v: minOut },
      { t: 'address', v: to },
      { t: 'uint', v: deadline },
    ]),
    value: amountInPot,
    valueHex: toHexValue(amountInPot),
  };
}

export function prepareSwapUsdcForPot(amountIn: bigint, minOut: bigint, to: string, deadline: bigint): PreparedTx {
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  if (amountIn <= 0n) throw new Error('Amount must be greater than zero');
  return {
    label: 'Swap pUSDC → POT',
    to: LIVE_DEPLOYMENT.ammAddress,
    data: encodeCall(SELECTORS.swapExactTokensForPOT, [
      { t: 'uint', v: amountIn },
      { t: 'uint', v: minOut },
      { t: 'address', v: to },
      { t: 'uint', v: deadline },
    ]),
    value: 0n,
    valueHex: '0x0',
  };
}

/** Classifies an error from a read into a user-facing category. */
export function classifyReadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `RPC error: ${msg}`;
}
