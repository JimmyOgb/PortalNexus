/**
 * Minimal ABI encoding/decoding for the deployed Architecture A contracts.
 *
 * Signatures are taken from contracts/contracts/NexusAMMNative.sol and TestUSDCMin.sol.
 * Selectors were verified against ethers' keccak256 (see tests/liveIntegration.test.ts,
 * which re-derives them from the compiled Hardhat artifacts).
 */

export const SELECTORS = {
  // TestUSDCMin
  transfer: '0xa9059cbb', // transfer(address,uint256)
  faucetMint: '0xa5c51274', // faucetMint(address,uint256)
  approve: '0x095ea7b3', // approve(address,uint256)
  allowance: '0xdd62ed3e', // allowance(address,address)
  balanceOf: '0x70a08231', // balanceOf(address) (pUSDC and AMM position count)
  totalSupply: '0x18160ddd', // totalSupply() -> uint256
  // NexusAMMNative
  getReserves: '0x0902f1ac', // getReserves() -> (uint256,uint256)
  totalLiquidityShares: '0x87cd5b20',
  usdc: '0x3e413bee', // usdc() -> address
  receiptContract: '0xd435b3a3', // receiptContract() -> address
  addLiquidity: '0xaebf3e41', // addLiquidity(uint256,uint256,uint256,uint256) payable
  removeLiquidity: '0xed856cdc', // removeLiquidity(uint256,uint256,uint256,address,uint256)
  swapExactPOTForTokens: '0xe3c32a03', // (uint256,address,uint256) payable
  swapExactTokensForPOT: '0x5b31b707', // (uint256,uint256,address,uint256)
  getPosition: '0xeb02c301', // getPosition(uint256) -> (address,uint256,uint256,uint256,uint256)
  ownerOf: '0x6352211e', // ownerOf(uint256)
} as const;

/** topic0 of LiquidityAdded (indexed provider = topic1, indexed tokenId = topic2) */
export const LIQUIDITY_ADDED_TOPIC_SIGNATURE = 'LiquidityAdded(address,uint256,uint256,uint256,uint256)';
export const LIQUIDITY_ADDED_TOPIC0 = '0x08d7621a09a86934f387f650007fa17f2413759ca5f2ae0681161b371583a5f5';

const MAX_UINT256 = (1n << 256n) - 1n;

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function encodeUint(value: bigint): string {
  if (value < 0n || value > MAX_UINT256) throw new Error('uint256 out of range');
  return value.toString(16).padStart(64, '0');
}

export function encodeAddress(addr: string): string {
  if (!isAddress(addr)) throw new Error(`Invalid address: ${addr}`);
  return addr.slice(2).toLowerCase().padStart(64, '0');
}

export function encodeCall(selector: string, args: Array<{ t: 'uint' | 'address'; v: bigint | string }>): string {
  return (
    selector +
    args.map((a) => (a.t === 'uint' ? encodeUint(a.v as bigint) : encodeAddress(a.v as string))).join('')
  );
}

export function decodeWords(hex: string, expectedWords: number): bigint[] {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) throw new Error('Malformed RPC result');
  const body = hex.slice(2);
  if (body.length < expectedWords * 64) {
    throw new Error('Contract returned no data (not deployed at this address or wrong network)');
  }
  const out: bigint[] = [];
  for (let i = 0; i < expectedWords; i++) out.push(BigInt('0x' + body.slice(i * 64, (i + 1) * 64)));
  return out;
}
