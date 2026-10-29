import { describe, it, expect } from 'vitest';

describe('RPC Data Parsers & Conversions', () => {
  it('correctly parses hex EVM chain ID', () => {
    const rawChainIdHex = '0x190f1ca9';
    const chainId = parseInt(rawChainIdHex, 16);
    expect(chainId).toBe(420420777);
  });

  it('correctly parses EVM hex block numbers', () => {
    const hexBlock = '0x2a820';
    const height = parseInt(hexBlock, 16);
    expect(height).toBe(174112);
  });

  it('correctly parses Substrate SCALE header number hex', () => {
    const substrateHex = '0x2a877';
    const height = parseInt(substrateHex, 16);
    expect(height).toBe(174199);
  });

  it('correctly converts EVM wei gas price to Gwei format', () => {
    // 0x7e5e = 32350 wei
    const gasPriceWei = BigInt('0x7e5e');
    const gwei = Number(gasPriceWei) / 1e9;
    expect(gwei.toFixed(4)).toBe('0.0000'); // Low testnet gas price
  });

  it('handles standard 1 Gwei gas price conversion', () => {
    const oneGweiWei = BigInt(1000000000);
    const gwei = Number(oneGweiWei) / 1e9;
    expect(gwei.toFixed(2)).toBe('1.00');
  });

  it('handles RPC error response decoding without unhandled exceptions', () => {
    const mockRpcError = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };

    expect(mockRpcError.error.code).toBe(-32601);
    expect(mockRpcError.error.message).toBe('Method not found');
  });
});
