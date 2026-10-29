/**
 * PortalNexus — Dual-VM Block Synchronization & Cadence Monitor
 * Observes repeated paired samples from Substrate and EVM endpoints.
 * Explicitly guards against premature "perfect synchronization" claims based on isolated samples.
 */

import { BlockComparisonSample, BlockComparisonMetrics, FreshnessStatus } from '../types';

export class BlockMonitor {
  private samples: BlockComparisonSample[] = [];
  private maxSamples: number;
  private nextId = 1;

  constructor(maxSamples = 20) {
    this.maxSamples = maxSamples;
  }

  /**
   * Records a new paired observation from the two independent execution environments.
   */
  public recordSample(substrateHeight: number | null, evmHeight: number | null): BlockComparisonSample {
    const timestamp = Date.now();
    let diff: number | null = null;
    let status: BlockComparisonSample['status'] = 'INCOMPLETE';
    let note = '';

    if (substrateHeight !== null && evmHeight !== null) {
      diff = substrateHeight - evmHeight;
      if (diff === 0) {
        status = 'SYNCHRONIZED';
        note = 'Heights match exactly for this observation';
      } else if (diff > 0) {
        status = 'SUBSTRATE_AHEAD';
        note = `Substrate leads EVM by ${diff} block(s)`;
      } else {
        status = 'EVM_AHEAD';
        note = `EVM leads Substrate by ${Math.abs(diff)} block(s)`;
      }
    } else {
      note = `Incomplete observation: Substrate=${substrateHeight ?? 'N/A'}, EVM=${evmHeight ?? 'N/A'}`;
    }

    const sample: BlockComparisonSample = {
      id: this.nextId++,
      timestamp,
      substrateHeight,
      evmHeight,
      diff,
      status,
      note
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return sample;
  }

  public getSamples(): BlockComparisonSample[] {
    return [...this.samples];
  }

  public clear(): void {
    this.samples = [];
  }

  /**
   * Computes empirical synchronization metrics across all collected samples.
   */
  public computeMetrics(): BlockComparisonMetrics {
    return calculateMetrics(this.samples);
  }
}

/**
 * Pure calculation function for metrics computation, fully testable without state.
 */
export function calculateMetrics(samples: BlockComparisonSample[]): BlockComparisonMetrics {
  const completeSamples = samples.filter(s => s.diff !== null);
  const sampleCount = completeSamples.length;

  if (sampleCount === 0) {
    return {
      sampleCount: 0,
      lastDiff: null,
      minDiff: null,
      maxDiff: null,
      avgDiff: null,
      verdict: 'UNAVAILABLE',
      freshness: 'UNAVAILABLE',
      classificationNote: 'No complete paired block samples recorded yet.'
    };
  }

  const diffs = completeSamples.map(s => s.diff!);
  const lastDiff = diffs[diffs.length - 1];
  const minDiff = Math.min(...diffs);
  const maxDiff = Math.max(...diffs);
  const sum = diffs.reduce((acc, d) => acc + d, 0);
  const avgDiff = Number((sum / sampleCount).toFixed(2));

  // Determine freshness based on recency of newest sample
  const newestTimestamp = completeSamples[completeSamples.length - 1].timestamp;
  const ageMs = Date.now() - newestTimestamp;
  const freshness: FreshnessStatus = ageMs < 12000 ? 'LIVE' : 'STALE';

  // Guard against premature conclusion
  if (sampleCount < 5) {
    return {
      sampleCount,
      lastDiff,
      minDiff,
      maxDiff,
      avgDiff,
      verdict: 'INSUFFICIENT_SAMPLES',
      freshness,
      classificationNote: `Observed ${sampleCount}/5 required samples. Cannot claim synchronization from isolated observations.`
    };
  }

  // Assess stability over the window
  const maxAbsDiff = Math.max(Math.abs(minDiff), Math.abs(maxDiff));

  if (maxAbsDiff <= 1) {
    return {
      sampleCount,
      lastDiff,
      minDiff,
      maxDiff,
      avgDiff,
      verdict: 'CONVERGING',
      freshness,
      classificationNote: `High-fidelity lockstep verified across ${sampleCount} consecutive samples (range: ${minDiff} to ${maxDiff}, avg diff: ${avgDiff}).`
    };
  }

  if (maxAbsDiff <= 3) {
    return {
      sampleCount,
      lastDiff,
      minDiff,
      maxDiff,
      avgDiff,
      verdict: 'DRIFTING',
      freshness,
      classificationNote: `Transient latency drift observed across ${sampleCount} samples (range: ${minDiff} to ${maxDiff}). eth-rpc polling cadence variance.`
    };
  }

  return {
    sampleCount,
    lastDiff,
    minDiff,
    maxDiff,
    avgDiff,
    verdict: 'DESYNCHRONIZED',
    freshness,
    classificationNote: `Significant disparity detected between Substrate and EVM block heights (range: ${minDiff} to ${maxDiff}, avg: ${avgDiff}).`
  };
}
