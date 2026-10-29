/**
 * PortalNexus — Pallet-Revive Address Derivation & Mapping Engine
 * 
 * Implements the verified Polkadot SDK pallet_revive::AccountId32Mapper:
 * Stateless mapping: 20-byte H160 EVM address + 12 bytes of 0xEE -> 32-byte AccountId32.
 * SS58 Prefix: 42 (Portaldot V3 standard).
 * 
 * Explicitly guards against and rejects the legacy Frontier/Moonbeam evmToAddress()
 * hashing bug which leads to lost funds on Portaldot V3.
 */

import { ReviveDerivationResult } from '../types';

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    str += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += B58_ALPHABET[digits[i]];
  }
  return str;
}

const IV = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3]
];

function rotr64(x: bigint, n: number): bigint {
  const shift = BigInt(n);
  return ((x >> shift) | (x << (64n - shift))) & 0xffffffffffffffffn;
}

export function blake2b512(input: Uint8Array): Uint8Array {
  const h = [...IV];
  h[0] ^= 0x01010040n;

  const block = new Uint8Array(128);
  block.set(input);
  const m = new BigUint64Array(block.buffer);

  const v = new BigUint64Array(16);
  for (let i = 0; i < 8; i++) v[i] = h[i];
  for (let i = 0; i < 8; i++) v[i + 8] = IV[i];

  v[12] ^= BigInt(input.length);
  v[14] ^= 0xffffffffffffffffn;

  function G(a: number, b: number, c: number, d: number, x: bigint, y: bigint) {
    v[a] = (v[a] + v[b] + x) & 0xffffffffffffffffn;
    v[d] = rotr64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & 0xffffffffffffffffn;
    v[b] = rotr64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & 0xffffffffffffffffn;
    v[d] = rotr64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & 0xffffffffffffffffn;
    v[b] = rotr64(v[b] ^ v[c], 63);
  }

  for (let round = 0; round < 12; round++) {
    const s = SIGMA[round];
    G(0, 4, 8, 12, m[s[0]], m[s[1]]);
    G(1, 5, 9, 13, m[s[2]], m[s[3]]);
    G(2, 6, 10, 14, m[s[4]], m[s[5]]);
    G(3, 7, 11, 15, m[s[6]], m[s[7]]);
    G(0, 5, 10, 15, m[s[8]], m[s[9]]);
    G(1, 6, 11, 12, m[s[10]], m[s[11]]);
    G(2, 7, 8, 13, m[s[12]], m[s[13]]);
    G(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }

  for (let i = 0; i < 8; i++) {
    h[i] ^= v[i] ^ v[i + 8];
  }

  const out = new Uint8Array(64);
  const out64 = new BigUint64Array(out.buffer);
  for (let i = 0; i < 8; i++) out64[i] = h[i];
  return out;
}

/**
 * Encodes an AccountId32 (32 bytes) as an SS58 address with prefix 42 (Portaldot standard).
 */
export function encodeSS58Prefix42(accountId32Bytes: Uint8Array): string {
  if (accountId32Bytes.length !== 32) {
    throw new Error(`AccountId32 must be exactly 32 bytes, got ${accountId32Bytes.length}`);
  }

  const prefixAndPub = new Uint8Array(33);
  prefixAndPub[0] = 42; // SS58 Prefix 42 for Portaldot / Substrate default
  prefixAndPub.set(accountId32Bytes, 1);

  const ss58Pre = new TextEncoder().encode('SS58PRE');
  const hashInput = new Uint8Array(ss58Pre.length + prefixAndPub.length);
  hashInput.set(ss58Pre);
  hashInput.set(prefixAndPub, ss58Pre.length);

  const hash = blake2b512(hashInput);
  const checksum = hash.slice(0, 2);

  const result = new Uint8Array(35);
  result.set(prefixAndPub);
  result.set(checksum, 33);

  return base58Encode(result);
}

/**
 * Derives the official pallet-revive AccountId32 and SS58 prefix 42 address
 * from an Ethereum H160 address.
 */
export function deriveReviveAccountId(evmAddress: string): ReviveDerivationResult {
  const cleanAddr = evmAddress.trim().toLowerCase();
  const hex = cleanAddr.startsWith('0x') ? cleanAddr.slice(2) : cleanAddr;

  if (!/^[0-9a-f]{40}$/.test(hex)) {
    return {
      evmAddress,
      isValidEvmAddress: false,
      paddedAccountId32Hex: null,
      ss58Prefix42Address: null,
      legacyMoonbeamMismatchWarning: false,
      explanation: 'Invalid EVM address format. Must be a 20-byte hexadecimal string (40 hex characters).'
    };
  }

  const evmBytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    evmBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  // AccountId32Mapper: 20 bytes H160 + 12 bytes of 0xEE
  const accountId32Bytes = new Uint8Array(32);
  accountId32Bytes.set(evmBytes, 0);
  accountId32Bytes.fill(0xee, 20, 32);

  let paddedHex = '0x' + hex;
  for (let i = 0; i < 12; i++) {
    paddedHex += 'ee';
  }

  const ss58Address = encodeSS58Prefix42(accountId32Bytes);

  return {
    evmAddress: '0x' + hex,
    isValidEvmAddress: true,
    paddedAccountId32Hex: paddedHex,
    ss58Prefix42Address: ss58Address,
    legacyMoonbeamMismatchWarning: true,
    explanation: 'Derived via pallet-revive AccountId32Mapper (20-byte H160 + 12x 0xEE padding). Do NOT use legacy evmToAddress().'
  };
}
