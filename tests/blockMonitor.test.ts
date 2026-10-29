import { describe, it, expect } from 'vitest';
import { BlockMonitor, calculateMetrics } from '../src/services/blockMonitor';
import { BlockComparisonSample } from '../src/types';

describe('BlockMonitor & calculateMetrics', () => {
  it('returns UNAVAILABLE when no samples exist', () => {
    const metrics = calculateMetrics([]);
    expect(metrics.sampleCount).toBe(0);
    expect(metrics.verdict).toBe('UNAVAILABLE');
    expect(metrics.lastDiff).toBeNull();
    expect(metrics.minDiff).toBeNull();
    expect(metrics.maxDiff).toBeNull();
  });

  it('strictly returns INSUFFICIENT_SAMPLES when sample count is less than 5', () => {
    const samples: BlockComparisonSample[] = [
      { id: 1, timestamp: Date.now(), substrateHeight: 100, evmHeight: 100, diff: 0, status: 'SYNCHRONIZED', note: '' },
      { id: 2, timestamp: Date.now(), substrateHeight: 101, evmHeight: 101, diff: 0, status: 'SYNCHRONIZED', note: '' }
    ];

    const metrics = calculateMetrics(samples);
    expect(metrics.sampleCount).toBe(2);
    expect(metrics.verdict).toBe('INSUFFICIENT_SAMPLES');
    expect(metrics.classificationNote).toContain('Cannot claim synchronization from isolated observations');
  });

  it('correctly classifies CONVERGING when >= 5 consecutive samples are within 1 block', () => {
    const now = Date.now();
    const samples: BlockComparisonSample[] = [
      { id: 1, timestamp: now - 4000, substrateHeight: 170000, evmHeight: 170000, diff: 0, status: 'SYNCHRONIZED', note: '' },
      { id: 2, timestamp: now - 3000, substrateHeight: 170001, evmHeight: 170000, diff: 1, status: 'SUBSTRATE_AHEAD', note: '' },
      { id: 3, timestamp: now - 2000, substrateHeight: 170001, evmHeight: 170001, diff: 0, status: 'SYNCHRONIZED', note: '' },
      { id: 4, timestamp: now - 1000, substrateHeight: 170002, evmHeight: 170002, diff: 0, status: 'SYNCHRONIZED', note: '' },
      { id: 5, timestamp: now, substrateHeight: 170003, evmHeight: 170002, diff: 1, status: 'SUBSTRATE_AHEAD', note: '' }
    ];

    const metrics = calculateMetrics(samples);
    expect(metrics.sampleCount).toBe(5);
    expect(metrics.verdict).toBe('CONVERGING');
    expect(metrics.minDiff).toBe(0);
    expect(metrics.maxDiff).toBe(1);
    expect(metrics.avgDiff).toBe(0.4);
    expect(metrics.freshness).toBe('LIVE');
  });

  it('classifies DESYNCHRONIZED when offset exceeds threshold', () => {
    const now = Date.now();
    const samples: BlockComparisonSample[] = [
      { id: 1, timestamp: now - 4000, substrateHeight: 170010, evmHeight: 170000, diff: 10, status: 'SUBSTRATE_AHEAD', note: '' },
      { id: 2, timestamp: now - 3000, substrateHeight: 170011, evmHeight: 170001, diff: 10, status: 'SUBSTRATE_AHEAD', note: '' },
      { id: 3, timestamp: now - 2000, substrateHeight: 170012, evmHeight: 170002, diff: 10, status: 'SUBSTRATE_AHEAD', note: '' },
      { id: 4, timestamp: now - 1000, substrateHeight: 170013, evmHeight: 170003, diff: 10, status: 'SUBSTRATE_AHEAD', note: '' },
      { id: 5, timestamp: now, substrateHeight: 170014, evmHeight: 170004, diff: 10, status: 'SUBSTRATE_AHEAD', note: '' }
    ];

    const metrics = calculateMetrics(samples);
    expect(metrics.sampleCount).toBe(5);
    expect(metrics.verdict).toBe('DESYNCHRONIZED');
    expect(metrics.avgDiff).toBe(10);
  });

  it('BlockMonitor records samples and maintains bounded rolling window', () => {
    const monitor = new BlockMonitor(3);
    monitor.recordSample(10, 10);
    monitor.recordSample(11, 10);
    monitor.recordSample(12, 12);
    monitor.recordSample(13, 13); // Should evict sample 1

    const list = monitor.getSamples();
    expect(list.length).toBe(3);
    expect(list[0].substrateHeight).toBe(11);
    expect(list[2].substrateHeight).toBe(13);
  });

  it('handles incomplete observations without throwing or corrupting metrics', () => {
    const monitor = new BlockMonitor(5);
    const sample = monitor.recordSample(null, 174000);
    expect(sample.diff).toBeNull();
    expect(sample.status).toBe('INCOMPLETE');

    const metrics = monitor.computeMetrics();
    expect(metrics.sampleCount).toBe(0);
    expect(metrics.verdict).toBe('UNAVAILABLE');
  });
});
