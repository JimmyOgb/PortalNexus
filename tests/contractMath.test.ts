import { describe, it, expect } from 'vitest';
import {
  calculateAmmQuote,
  formatTokenAmount,
  parseTokenAmount
} from '../src/services/contractMath';

describe('Nexus AMM Contract Math ($x \\cdot y = k$, 0.3% Fee)', () => {
  const reserveIn = 10000n * 10n ** 18n; // 10,000 WPOT (18 decimals)
  const reserveOut = 25000n * 10n ** 6n; // 25,000 pUSDC (6 decimals)

  it('calculates exact swap output according to 0.3% fee constant-product formula', () => {
    const amountIn = 100n * 10n ** 18n; // 100 WPOT
    const quote = calculateAmmQuote(amountIn, reserveIn, reserveOut, 50); // 0.5% slippage

    // amountInWithFee = 100e18 * 997 = 99700e18
    // numerator = 99700e18 * 25000e6 = 2492500000e24
    // denominator = (10000e18 * 1000) + 99700e18 = 10099700e18
    // expected amountOut = 2492500000e24 / 10099700e18 = 246789508 (approx 246.789508 pUSDC)
    const expectedNumerator = (amountIn * 997n) * reserveOut;
    const expectedDenominator = (reserveIn * 1000n) + (amountIn * 997n);
    const expectedOut = expectedNumerator / expectedDenominator;

    expect(quote.amountOut).toBe(expectedOut);
    expect(quote.amountOut).toBe(246789508n); // 246.789508 pUSDC

    // minAmountOut with 0.5% slippage (50 bps) = 246789508 * 9950 / 10000 = 245555560
    const expectedMin = (expectedOut * 9950n) / 10000n;
    expect(quote.minAmountOut).toBe(expectedMin);

    // Fee amount = 100e18 * 3 / 1000 = 0.3 WPOT
    expect(quote.feeAmount).toBe(3n * 10n ** 17n);
  });

  it('reverts if swap input amount is zero or negative', () => {
    expect(() => calculateAmmQuote(0n, reserveIn, reserveOut)).toThrow(
      'Input amount must be greater than zero'
    );
  });

  it('reverts if reserves are zero or negative', () => {
    expect(() => calculateAmmQuote(100n, 0n, reserveOut)).toThrow(
      'Insufficient pool reserves'
    );
    expect(() => calculateAmmQuote(100n, reserveIn, 0n)).toThrow(
      'Insufficient pool reserves'
    );
  });

  it('reverts on invalid slippage tolerance outside 0-10000 bps', () => {
    expect(() => calculateAmmQuote(100n, reserveIn, reserveOut, -1)).toThrow(
      'Invalid slippage tolerance'
    );
    expect(() => calculateAmmQuote(100n, reserveIn, reserveOut, 10001)).toThrow(
      'Invalid slippage tolerance'
    );
  });

  it('calculates price impact accurately for small and large swaps', () => {
    const smallIn = 1n * 10n ** 18n; // 1 WPOT
    const smallQuote = calculateAmmQuote(smallIn, reserveIn, reserveOut);
    expect(smallQuote.priceImpactPercent).toBeGreaterThanOrEqual(0);
    expect(smallQuote.priceImpactPercent).toBeLessThan(1); // Very low impact

    const largeIn = 5000n * 10n ** 18n; // 5,000 WPOT (50% of pool)
    const largeQuote = calculateAmmQuote(largeIn, reserveIn, reserveOut);
    expect(largeQuote.priceImpactPercent).toBeGreaterThan(20); // High impact
  });
});

describe('Token Amount Decimal Formatting & Parsing', () => {
  it('formats 18-decimal wei amounts accurately to human strings', () => {
    const amount = 12500000000000000000n; // 12.5 POT
    expect(formatTokenAmount(amount, 18, 2)).toBe('12.50');
    expect(formatTokenAmount(amount, 18, 4)).toBe('12.5000');
    expect(formatTokenAmount(0n, 18)).toBe('0.00');
  });

  it('formats 6-decimal pUSDC amounts accurately', () => {
    const amount = 250500000n; // 250.5 pUSDC
    expect(formatTokenAmount(amount, 6, 2)).toBe('250.50');
    expect(formatTokenAmount(amount, 6, 4)).toBe('250.5000');
  });

  it('parses user input strings into exact bigint units', () => {
    expect(parseTokenAmount('12.5', 18)).toBe(12500000000000000000n);
    expect(parseTokenAmount('250.50', 6)).toBe(250500000n);
    expect(parseTokenAmount('1,000.25', 18)).toBe(1000250000000000000000n);
    expect(parseTokenAmount('0', 18)).toBe(0n);
    expect(parseTokenAmount('', 18)).toBe(0n);
  });

  it('safely truncates fractional decimals that exceed the token precision', () => {
    // 6 decimals with 8 decimal places provided
    const parsed = parseTokenAmount('1.12345678', 6);
    expect(parsed).toBe(1123456n); // Truncated cleanly to 6 decimals
  });

  it('throws on invalid decimal string format with multiple dots', () => {
    expect(() => parseTokenAmount('1.2.3', 18)).toThrow('Invalid decimal format');
  });
});
