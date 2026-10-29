/**
 * Contract Math & AMM Utilities for PortalNexus V3
 *
 * Implements constant-product AMM formulas matching NexusAMM.sol exactly:
 * - 0.3% trading fee (997/1000 multiplier)
 * - Slippage calculation
 * - Price impact estimation
 * - Safe decimal scaling for EVM wei (18) and pUSDC (6)
 */

export interface AmmQuote {
  amountIn: bigint;
  amountOut: bigint;
  minAmountOut: bigint;
  priceImpactPercent: number;
  effectiveRate: number;
  feeAmount: bigint;
}

/**
 * Calculates swap output matching NexusAMM.sol:
 * amountInWithFee = amountIn * 997
 * numerator = amountInWithFee * reserveOut
 * denominator = (reserveIn * 1000) + amountInWithFee
 * amountOut = numerator / denominator
 */
export function calculateAmmQuote(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  slippageBps: number = 50 // 0.5% default (50 bps)
): AmmQuote {
  if (amountIn <= 0n) {
    throw new Error('Input amount must be greater than zero');
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error('Insufficient pool reserves');
  }
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error('Invalid slippage tolerance (0 - 10000 bps)');
  }

  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  const amountOut = numerator / denominator;

  // Slippage protection: minAmountOut = amountOut * (10000 - slippageBps) / 10000
  const minAmountOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

  // Fee taken = amountIn * 3 / 1000
  const feeAmount = (amountIn * 3n) / 1000n;

  // Price impact calculation: (1 - (spotPriceAfter / spotPriceBefore)) or |ideal - actual| / ideal
  // Ideal output without impact = (amountIn * reserveOut) / reserveIn
  const idealOutput = (amountIn * reserveOut) / reserveIn;
  let priceImpactPercent = 0;
  if (idealOutput > 0n) {
    const diff = idealOutput > amountOut ? idealOutput - amountOut : 0n;
    priceImpactPercent = Number((diff * 10000n) / idealOutput) / 100;
  }

  const effectiveRate = Number(amountOut) / Number(amountIn || 1n);

  return {
    amountIn,
    amountOut,
    minAmountOut,
    priceImpactPercent,
    effectiveRate,
    feeAmount
  };
}

/**
 * Formats bigint token amount to a human-readable string with given decimals.
 */
export function formatTokenAmount(amount: bigint, decimals: number, precision: number = 4): string {
  if (amount === 0n) return '0.00';
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const remainder = amount % divisor;

  if (precision <= 0) return integerPart.toString();

  const remainderStr = remainder.toString().padStart(decimals, '0');
  const fraction = remainderStr.slice(0, precision);
  return `${integerPart.toLocaleString()}.${fraction}`;
}

/**
 * Parses user string input to bigint token units.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const clean = input.trim().replace(/,/g, '');
  if (!clean || clean === '.') return 0n;

  const parts = clean.split('.');
  if (parts.length > 2) throw new Error('Invalid decimal format');

  const integerPart = BigInt(parts[0] || '0');
  let fractionPart = parts[1] || '';

  if (fractionPart.length > decimals) {
    fractionPart = fractionPart.slice(0, decimals);
  } else {
    fractionPart = fractionPart.padEnd(decimals, '0');
  }

  const fractionVal = BigInt(fractionPart || '0');
  return integerPart * (10n ** BigInt(decimals)) + fractionVal;
}
