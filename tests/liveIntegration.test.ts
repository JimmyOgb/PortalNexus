import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { SELECTORS, LIQUIDITY_ADDED_TOPIC0, decodeWords } from '../src/contracts/abi';
import { LIVE_DEPLOYMENT } from '../src/contracts/config';
import {
  readReserves, readPusdcBalance, readPusdcTotalSupply, readLpPositions, isPoolEmpty,
  needsPusdcApproval, parseAmountStrict, quoteAddLiquidity, swapOut, applySlippageDown, deadlineFrom,
  prepareFaucetMint, prepareApprove, prepareAddLiquidity, prepareRemoveLiquidity,
  prepareSwapPotForUsdc, prepareSwapUsdcForPot, TX_SUBMISSION_ENABLED, RpcCall,
} from '../src/services/ammService';

const word = (n: bigint) => n.toString(16).padStart(64, '0');
const OWNER = '0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A';

describe('ABI selectors match deployed contract ABIs', () => {
  const require = createRequire(import.meta.url);
  const { Interface, id } = require('../contracts/node_modules/ethers');
  const amm = new Interface(JSON.parse(readFileSync('contracts/artifacts/contracts/NexusAMMNative.sol/NexusAMMNative.json', 'utf8')).abi);
  const usdc = new Interface(JSON.parse(readFileSync('contracts/artifacts/contracts/TestUSDCMin.sol/TestUSDCMin.json', 'utf8')).abi);

  it('selectors equal artifact ABI selectors', () => {
    expect(SELECTORS.getReserves).toBe(amm.getFunction('getReserves').selector);
    expect(SELECTORS.totalLiquidityShares).toBe(amm.getFunction('totalLiquidityShares').selector);
    expect(SELECTORS.addLiquidity).toBe(amm.getFunction('addLiquidity').selector);
    expect(SELECTORS.removeLiquidity).toBe(amm.getFunction('removeLiquidity').selector);
    expect(SELECTORS.swapExactPOTForTokens).toBe(amm.getFunction('swapExactPOTForTokens').selector);
    expect(SELECTORS.swapExactTokensForPOT).toBe(amm.getFunction('swapExactTokensForPOT').selector);
    expect(SELECTORS.getPosition).toBe(amm.getFunction('getPosition').selector);
    expect(SELECTORS.ownerOf).toBe(amm.getFunction('ownerOf').selector);
    expect(SELECTORS.usdc).toBe(amm.getFunction('usdc').selector);
    expect(SELECTORS.receiptContract).toBe(amm.getFunction('receiptContract').selector);
    expect(SELECTORS.faucetMint).toBe(usdc.getFunction('faucetMint').selector);
    expect(SELECTORS.approve).toBe(usdc.getFunction('approve').selector);
    expect(SELECTORS.allowance).toBe(usdc.getFunction('allowance').selector);
    expect(SELECTORS.balanceOf).toBe(usdc.getFunction('balanceOf').selector);
    expect(SELECTORS.totalSupply).toBe(usdc.getFunction('totalSupply').selector);
    expect(LIQUIDITY_ADDED_TOPIC0).toBe(id('LiquidityAdded(address,uint256,uint256,uint256,uint256)'));
  });

  it('prepared calldata decodes to the intended arguments', () => {
    const dl = deadlineFrom(1_000_000, 20);
    const sw = prepareSwapPotForUsdc(5n * 10n ** 18n, 123n, OWNER, dl);
    const d = amm.decodeFunctionData('swapExactPOTForTokens', sw.data);
    expect([d[0], d[1].toLowerCase(), d[2]]).toEqual([123n, OWNER.toLowerCase(), dl]);
    expect(sw.value).toBe(5n * 10n ** 18n);

    const sw2 = prepareSwapUsdcForPot(100n, 90n, OWNER, dl);
    const d2 = amm.decodeFunctionData('swapExactTokensForPOT', sw2.data);
    expect([d2[0], d2[1], d2[3]]).toEqual([100n, 90n, dl]);
    expect(sw2.value).toBe(0n);

    const rm = prepareRemoveLiquidity(7n, 1n, 2n, OWNER, dl);
    const d3 = amm.decodeFunctionData('removeLiquidity', rm.data);
    expect([d3[0], d3[1], d3[2], d3[4]]).toEqual([7n, 1n, 2n, dl]);

    const f = prepareFaucetMint(OWNER, 500n * 10n ** 6n);
    const d4 = usdc.decodeFunctionData('faucetMint', f.data);
    expect(d4[1]).toBe(500n * 10n ** 6n);
    expect(f.to).toBe(LIVE_DEPLOYMENT.pusdcAddress);

    const ap = prepareApprove(42n);
    const d5 = usdc.decodeFunctionData('approve', ap.data);
    expect(d5[0].toLowerCase()).toBe(LIVE_DEPLOYMENT.ammAddress.toLowerCase());
    expect(d5[1]).toBe(42n);

    const q = quoteAddLiquidity(10n ** 18n, 2_000_000n, { reservePot: 10n ** 20n, reserveUsdc: 2n * 10n ** 8n, totalShares: 10n ** 9n }, 50);
    const add = prepareAddLiquidity(10n ** 18n, 2_000_000n, q, dl);
    const d6 = amm.decodeFunctionData('addLiquidity', add.data);
    expect(d6[0]).toBe(2_000_000n);
    expect(add.value).toBe(10n ** 18n);
  });
});

describe('live reads (RPC mocked in tests only)', () => {
  it('reads reserves and shares from getReserves/totalLiquidityShares', async () => {
    const rpc: RpcCall = async (m, p) => {
      expect(m).toBe('eth_call');
      expect(p[0].to).toBe(LIVE_DEPLOYMENT.ammAddress);
      if (p[0].data === SELECTORS.getReserves) return '0x' + word(7n) + word(9n);
      if (p[0].data === SELECTORS.totalLiquidityShares) return '0x' + word(5n);
      throw new Error('unexpected');
    };
    expect(await readReserves(rpc)).toEqual({ reservePot: 7n, reserveUsdc: 9n, totalShares: 5n });
  });

  it('detects zero-reserve pool', async () => {
    const rpc: RpcCall = async (_m, p) =>
      p[0].data === SELECTORS.getReserves ? '0x' + word(0n) + word(0n) : '0x' + word(0n);
    const r = await readReserves(rpc);
    expect(isPoolEmpty(r)).toBe(true);
    expect(() => swapOut(1n, r.reservePot, r.reserveUsdc)).toThrow('no liquidity');
  });

  it('surfaces RPC errors and empty return data', async () => {
    await expect(readReserves(async () => { throw new Error('HTTP 503'); })).rejects.toThrow('HTTP 503');
    await expect(readReserves(async () => '0x')).rejects.toThrow('no data');
    expect(() => decodeWords('nope', 1)).toThrow();
  });

  it('reads pUSDC balance and totalSupply', async () => {
    const rpc: RpcCall = async (_m, p) => {
      expect(p[0].to).toBe(LIVE_DEPLOYMENT.pusdcAddress);
      if (p[0].data === SELECTORS.totalSupply) return '0x' + word(0n);
      expect(p[0].data.startsWith(SELECTORS.balanceOf)).toBe(true);
      return '0x' + word(1234n);
    };
    expect(await readPusdcBalance(rpc, OWNER)).toBe(1234n);
    expect(await readPusdcTotalSupply(rpc)).toBe(0n);
  });

  it('discovers LP positions from logs and verifies ownership on-chain', async () => {
    const reserves = { reservePot: 1000n, reserveUsdc: 2000n, totalShares: 100n };
    const me = '0x' + OWNER.slice(2).toLowerCase().padStart(64, '0');
    const rpc: RpcCall = async (m, p) => {
      if (m === 'eth_getLogs') {
        expect(p[0].topics[1]).toBe(me);
        return [{ topics: [LIQUIDITY_ADDED_TOPIC0, me, '0x' + word(1n)] }, { topics: [LIQUIDITY_ADDED_TOPIC0, me, '0x' + word(2n)] }];
      }
      const data: string = p[0].data;
      if (data.startsWith(SELECTORS.ownerOf)) {
        return BigInt(data.slice(10)) === 1n ? '0x' + word(BigInt(OWNER)) : '0x' + word(0n); // #2 burned
      }
      if (data.startsWith(SELECTORS.getPosition)) return '0x' + word(0n) + word(10n) + word(100n) + word(200n) + word(1n);
      throw new Error('unexpected');
    };
    const pos = await readLpPositions(rpc, OWNER, reserves);
    expect(pos).toHaveLength(1);
    expect(pos[0].currentPot).toBe(100n);
    expect(pos[0].currentUsdc).toBe(200n);
  });
});

describe('math, validation and failure states', () => {
  it('rejects invalid amounts', () => {
    for (const bad of ['', '.', '-1', '1e5', 'abc', '0', '0.0', '1.2.3']) expect(parseAmountStrict(bad, 6).ok).toBe(false);
    expect(parseAmountStrict('1.1234567', 6).ok).toBe(false);
    expect(parseAmountStrict('1.5', 6)).toEqual({ ok: true, value: 1_500_000n });
  });

  it('swap quote mirrors contract formula and slippage floors', () => {
    const out = swapOut(10n ** 18n, 100n * 10n ** 18n, 200n * 10n ** 6n);
    expect(out).toBe((10n ** 18n * 997n * 200n * 10n ** 6n) / (100n * 10n ** 18n * 1000n + 10n ** 18n * 997n));
    expect(applySlippageDown(1000n, 50)).toBe(995n);
    expect(() => applySlippageDown(1n, 9000)).toThrow();
  });

  it('validates deadlines', () => {
    expect(() => deadlineFrom(0, 0)).toThrow();
    expect(() => deadlineFrom(0, 500)).toThrow();
    expect(deadlineFrom(100, 1)).toBe(160n);
  });

  it('first deposit mints sqrt(k) - 1000 and rejects dust', () => {
    const empty = { reservePot: 0n, reserveUsdc: 0n, totalShares: 0n };
    const q = quoteAddLiquidity(10n ** 18n, 4_000_000n, empty, 50);
    expect(q.isFirstDeposit).toBe(true);
    expect(q.shares).toBe(2_000_000_000_000n - 1000n);
    expect(() => quoteAddLiquidity(10n, 10n, empty, 50)).toThrow('too small');
  });

  it('subsequent deposit refunds excess POT and rejects mismatches', () => {
    const r = { reservePot: 100n * 10n ** 18n, reserveUsdc: 200n * 10n ** 6n, totalShares: 10n ** 9n };
    const q = quoteAddLiquidity(10n ** 18n, 1_000_000n, r, 50); // wants 2 pUSDC, only 1 offered -> POT is trimmed
    expect(q.amountUsdc).toBe(1_000_000n);
    expect(q.refundPot).toBe(5n * 10n ** 17n);
  });

  it('faucet enforces cap and address', () => {
    expect(() => prepareFaucetMint(OWNER, 10_001n * 10n ** 6n)).toThrow('cap');
    expect(() => prepareFaucetMint('0x123', 1n)).toThrow('Invalid');
  });

  it('transaction submission is hard-disabled', () => {
    expect(TX_SUBMISSION_ENABLED).toBe(false);
  });

  it('determines exact-allowance pUSDC approval needs accurately', () => {
    expect(needsPusdcApproval(null, 10_000_000n)).toBe(true);
    expect(needsPusdcApproval(0n, 10_000_000n)).toBe(true);
    expect(needsPusdcApproval(9_999_999n, 10_000_000n)).toBe(true);
    expect(needsPusdcApproval(10_000_000n, 10_000_000n)).toBe(false);
    expect(needsPusdcApproval(25_000_000n, 10_000_000n)).toBe(false);
    expect(needsPusdcApproval(0n, 0n)).toBe(false);
  });

  it('matches deployment-receipt-arch-a.json addresses, blocks, and tx hashes', () => {
    const receipt = JSON.parse(readFileSync('contracts/deployment-receipt-arch-a.json', 'utf8'));
    expect(LIVE_DEPLOYMENT.pusdcAddress).toBe(receipt.contracts.testUSDC.address);
    expect(LIVE_DEPLOYMENT.pusdcDeployBlock).toBe(receipt.contracts.testUSDC.blockNumber);
    expect(LIVE_DEPLOYMENT.pusdcDeployTxHash).toBe(receipt.contracts.testUSDC.txHash);
    expect(LIVE_DEPLOYMENT.ammAddress).toBe(receipt.contracts.nexusAMM.address);
    expect(LIVE_DEPLOYMENT.ammDeployBlock).toBe(receipt.contracts.nexusAMM.blockNumber);
    expect(LIVE_DEPLOYMENT.ammDeployTxHash).toBe(receipt.contracts.nexusAMM.txHash);
    expect(LIVE_DEPLOYMENT.deployerAddress).toBe(receipt.deployer);
  });
});
