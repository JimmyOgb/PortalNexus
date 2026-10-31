/**
 * PortalNexus — Substrate SCALE Encoding & Extrinsic Construction Utilities
 *
 * Implements genuine Substrate V14 metadata-verified extrinsic assembly for Portaldot V3:
 * - Pallet: Balances (Index 6)
 * - Call: transfer_keep_alive (Index 3)
 * - MultiAddress::Id (0x00 + 32-byte AccountId32)
 * - Compact<u128> balance units (14 decimals)
 * - Existential Deposit: 0.1000 tPOT (10^13 units)
 * - Signed Extrinsic format: V4 (0x84)
 */

import { base58Decode, blake2b512, blake2b128 } from './reviveMapper';

export const PORTALDOT_SUBSTRATE_CONSTANTS = {
  specName: 'portaldot-v3',
  specVersion: 3002,
  transactionVersion: 2,
  ss58Prefix: 42,
  tokenDecimals: 14,
  tokenSymbol: 'tPOT',
  balancesPalletIndex: 6,
  transferKeepAliveCallIndex: 3,
  transferAllowDeathCallIndex: 0,
  /**
   * Existential Deposit verified from Portaldot V3 runtime metadata constant:
   * 0x00a0724e180900000000000000000000 (LE) = 10_000_000_000_000 units = 0.1 tPOT (14 decimals).
   */
  existentialDepositUnits: 10_000_000_000_000n,
  existentialDepositFormatted: '0.1000 tPOT'
} as const;

/**
 * Authoritative ordered list of all 12 SignedExtensions in Portaldot V3.0 runtime.
 * Disassembled directly from Metadata V14 (Extrinsic type 817).
 */
export const PORTALDOT_V3_SIGNED_EXTENSIONS = [
  'AuthorizeCall',
  'CheckNonZeroSender',
  'CheckSpecVersion',
  'CheckTxVersion',
  'CheckGenesis',
  'CheckMortality',
  'CheckNonce',
  'CheckWeight',
  'ChargeAssetTxPayment',
  'CheckMetadataHash',
  'EthSetOrigin',
  'WeightReclaim'
] as const;

export interface DecodedSS58 {
  prefix: number;
  publicKey: Uint8Array;
  publicKeyHex: string;
}

/**
 * Decodes an SS58 address and verifies its length and checksum.
 * On Portaldot V3, prefix must be 42 (addresses starting with '5').
 */
export function decodeSS58(address: string, expectedPrefix = 42): DecodedSS58 {
  if (!address || typeof address !== 'string') {
    throw new Error('Address must be a non-empty string');
  }

  const clean = address.trim();
  if (expectedPrefix === 42 && !clean.startsWith('5')) {
    throw new Error(`Invalid SS58 address for Portaldot V3: expected Prefix 42 starting with '5', got '${clean.slice(0, 2)}...'`);
  }

  const bytes = base58Decode(clean);
  if (bytes.length !== 35) {
    throw new Error(`Invalid SS58 address length: expected 35 bytes for AccountId32, got ${bytes.length}`);
  }

  const prefix = bytes[0];
  if (expectedPrefix !== undefined && prefix !== expectedPrefix) {
    throw new Error(`SS58 prefix mismatch: expected ${expectedPrefix}, got ${prefix}`);
  }

  const publicKey = bytes.slice(1, 33);
  const checksum = bytes.slice(33, 35);

  // Verify checksum: blake2b512(TextEncoder('SS58PRE') + bytes.slice(0, 33)).slice(0, 2)
  const ss58Pre = new TextEncoder().encode('SS58PRE');
  const hashInput = new Uint8Array(ss58Pre.length + 33);
  hashInput.set(ss58Pre);
  hashInput.set(bytes.slice(0, 33), ss58Pre.length);

  const hash = blake2b512(hashInput);
  if (hash[0] !== checksum[0] || hash[1] !== checksum[1]) {
    throw new Error('SS58 address checksum verification failed: address is corrupted or invalid');
  }

  const publicKeyHex = '0x' + Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');
  return { prefix, publicKey, publicKeyHex };
}

/**
 * SCALE encodes an integer into Compact<T> format.
 */
export function encodeCompact(val: number | bigint): Uint8Array {
  const n = BigInt(val);
  if (n < 0n) throw new Error('Compact encoding requires non-negative integer');

  if (n <= 63n) {
    return new Uint8Array([Number(n << 2n)]);
  }
  if (n <= 16383n) {
    const v = Number((n << 2n) | 1n);
    return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  }
  if (n <= 1073741823n) {
    const v = Number((n << 2n) | 2n);
    return new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
  }

  // Big-compact: count required bytes
  const bytes: number[] = [];
  let temp = n;
  while (temp > 0n) {
    bytes.push(Number(temp & 0xffn));
    temp >>= 8n;
  }
  const prefix = ((bytes.length - 4) << 2) | 3;
  return new Uint8Array([prefix, ...bytes]);
}

/**
 * Encodes the call data for `balances.transfer_keep_alive(dest, value)`.
 * - Pallet: 6
 * - Call: 3
 * - MultiAddress::Id: 0x00 + 32-byte pubkey
 * - Value: Compact<u128>
 */
export function encodeTransferKeepAliveCall(destPublicKey: Uint8Array, amountUnits: bigint): Uint8Array {
  if (destPublicKey.length !== 32) {
    throw new Error(`destPublicKey must be 32 bytes, got ${destPublicKey.length}`);
  }
  if (amountUnits <= 0n) {
    throw new Error('Transfer amount must be greater than zero');
  }

  const compactValue = encodeCompact(amountUnits);
  // pallet index (1) + call index (1) + MultiAddress::Id (1) + pubkey (32) + compactValue (N)
  const callData = new Uint8Array(1 + 1 + 1 + 32 + compactValue.length);
  callData[0] = PORTALDOT_SUBSTRATE_CONSTANTS.balancesPalletIndex;
  callData[1] = PORTALDOT_SUBSTRATE_CONSTANTS.transferKeepAliveCallIndex;
  callData[2] = 0x00; // MultiAddress::Id variant
  callData.set(destPublicKey, 3);
  callData.set(compactValue, 35);

  return callData;
}

/**
 * Parses user input decimal string into 14-decimal Substrate native units.
 * Example: '1.5' -> 150_000_000_000_000n
 */
export function parseSubstrateNativeUnits(amountStr: string, decimals = 14): bigint {
  const clean = amountStr.trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error(`Invalid decimal amount string: "${amountStr}"`);
  }

  const [whole, fraction = ''] = clean.split('.');
  const truncatedFraction = fraction.slice(0, decimals).padEnd(decimals, '0');
  const combined = whole + truncatedFraction;
  return BigInt(combined);
}

/**
 * Formats 14-decimal native units into a display string.
 */
export function formatSubstrateNativeUnits(units: bigint, decimals = 14, precision = 4): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const rem = units % divisor;

  const remPadded = rem.toString().padStart(decimals, '0');
  const fractionPart = remPadded.slice(0, precision);
  return `${whole}.${fractionPart} ${PORTALDOT_SUBSTRATE_CONSTANTS.tokenSymbol}`;
}

/**
 * System.Account storage prefix:
 * twox128("System") = 0x26aa394eea5630e07c48ae0c9558cef7
 * twox128("Account") = 0xb99d880ec681799c0cf30e8886371da9
 * Combined = 0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9
 */
export const SYSTEM_ACCOUNT_STORAGE_PREFIX = '0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9';

/**
 * Computes the 80-byte (160 hex char) storage key for System.Account(accountId32)
 * using twox128("System") + twox128("Account") + blake2_128Concat(pubkey).
 */
export function computeSystemAccountStorageKey(addressOrPubkey: string | Uint8Array): string {
  let pubkey: Uint8Array;
  if (typeof addressOrPubkey === 'string') {
    const trimmed = addressOrPubkey.trim();
    if (trimmed.startsWith('5')) {
      pubkey = decodeSS58(trimmed, 42).publicKey;
    } else if (trimmed.startsWith('0x') && trimmed.length === 66) {
      pubkey = hexToBytes(trimmed);
    } else {
      pubkey = decodeSS58(trimmed).publicKey;
    }
  } else {
    pubkey = addressOrPubkey;
  }

  if (pubkey.length !== 32) {
    throw new Error(`Expected 32-byte public key for AccountId32, got ${pubkey.length}`);
  }

  const hash128 = blake2b128(pubkey);
  const hashHex = bytesToHex(hash128).slice(2);
  const pubHex = bytesToHex(pubkey).slice(2);

  return `${SYSTEM_ACCOUNT_STORAGE_PREFIX}${hashHex}${pubHex}`;
}

export interface DecodedSystemAccount {
  nonce: number;
  consumers: number;
  providers: number;
  suffragents: number;
  free: bigint;
  reserved: bigint;
  frozen: bigint;
  flags: bigint;
}

/**
 * Decodes a raw SCALE-encoded System.Account storage value into its constituent fields.
 * Layout (Substrate FRAME FrameSystemAccountInfo):
 * - nonce: u32 LE (bytes 0..4)
 * - consumers: u32 LE (bytes 4..8)
 * - providers: u32 LE (bytes 8..12)
 * - suffragents: u32 LE (bytes 12..16)
 * - AccountData:
 *   - free: u128 LE (bytes 16..32)
 *   - reserved: u128 LE (bytes 32..48)
 *   - frozen: u128 LE (bytes 48..64)
 *   - flags: u128 LE (bytes 64..80)
 */
export function decodeSystemAccount(storageHexOrBytes: string | Uint8Array | null | undefined): DecodedSystemAccount {
  const zeroAccount: DecodedSystemAccount = {
    nonce: 0,
    consumers: 0,
    providers: 0,
    suffragents: 0,
    free: 0n,
    reserved: 0n,
    frozen: 0n,
    flags: 0n
  };

  if (!storageHexOrBytes) return zeroAccount;

  let bytes: Uint8Array;
  if (typeof storageHexOrBytes === 'string') {
    const clean = storageHexOrBytes.trim();
    if (!clean || clean === '0x' || clean === 'null') return zeroAccount;
    bytes = hexToBytes(clean);
  } else {
    bytes = storageHexOrBytes;
  }

  if (bytes.length < 32) {
    return zeroAccount;
  }

  function decodeU32LE(b: Uint8Array, offset: number): number {
    return b[offset] | (b[offset + 1] << 8) | (b[offset + 2] << 16) | (b[offset + 3] << 24);
  }

  function decodeU128LE(b: Uint8Array, offset: number): bigint {
    let val = 0n;
    for (let i = 0; i < 16; i++) {
      if (offset + i < b.length) {
        val |= BigInt(b[offset + i]) << BigInt(i * 8);
      }
    }
    return val;
  }

  return {
    nonce: decodeU32LE(bytes, 0),
    consumers: decodeU32LE(bytes, 4),
    providers: decodeU32LE(bytes, 8),
    suffragents: decodeU32LE(bytes, 12),
    free: decodeU128LE(bytes, 16),
    reserved: bytes.length >= 48 ? decodeU128LE(bytes, 32) : 0n,
    frozen: bytes.length >= 64 ? decodeU128LE(bytes, 48) : 0n,
    flags: bytes.length >= 80 ? decodeU128LE(bytes, 64) : 0n
  };
}

export interface SubstrateSignerPayloadJSON {
  address: string;
  blockHash: string;
  blockNumber: string;
  era: string;
  genesisHash: string;
  method: string;
  nonce: string;
  specVersion: string;
  tip: string;
  transactionVersion: string;
  signedExtensions: string[];
  version: number;
  assetId?: number | object | null;
  metadataHash?: string | null;
  mode?: number;
  withSignedTransaction?: boolean;
}

/**
 * Constructs a SubstrateSignerPayloadJSON strictly conforming to Portaldot V3 runtime metadata.
 * For immortal era ('0x00'):
 * - blockHash MUST equal genesisHash (checkpoint required by Substrate CheckMortality)
 * - blockNumber MUST be '0x0'
 * - era MUST be '0x00'
 */
export function constructSignerPayload(params: {
  address: string;
  callDataHex: string;
  nonce: number;
  genesisHash: string;
  specVersion: number;
  transactionVersion: number;
  tip?: bigint | number;
  isImmortal?: boolean;
  currentBlockHash?: string;
  currentBlockNumber?: number;
}): SubstrateSignerPayloadJSON {
  const isImmortal = params.isImmortal ?? true;
  // If immortal, blockHash MUST be genesisHash and blockNumber MUST be 0.
  // Passing a dynamic blockHash with an immortal era is rejected by wallet extensions
  // and produces a signature mismatch against node's CheckMortality AdditionalSigned.
  const blockHash = isImmortal ? params.genesisHash : (params.currentBlockHash || params.genesisHash);
  const blockNumber = isImmortal ? 0 : (params.currentBlockNumber || 0);

  return {
    address: params.address,
    blockHash,
    blockNumber: '0x' + blockNumber.toString(16),
    era: isImmortal ? '0x00' : '0x01',
    genesisHash: params.genesisHash,
    method: params.callDataHex,
    nonce: '0x' + params.nonce.toString(16),
    specVersion: '0x' + params.specVersion.toString(16),
    tip: '0x00000000000000000000000000000000',
    transactionVersion: '0x' + params.transactionVersion.toString(16),
    signedExtensions: [...PORTALDOT_V3_SIGNED_EXTENSIONS],
    version: 4,
    assetId: null,
    metadataHash: null,
    mode: 0
  };
}

/**
 * SCALE-encodes SignedExtra fields for Portaldot V3 (12 SignedExtensions).
 */
export function encodeSignedExtra(params: {
  nonce: number;
  tip?: bigint | number;
  assetId?: Uint8Array | null;
  metadataHashMode?: number;
}): Uint8Array {
  const nonceCompact = encodeCompact(params.nonce);
  const tipCompact = encodeCompact(params.tip ?? 0n);
  const assetIdByte = params.assetId ? 0x01 : 0x00;
  const metadataModeByte = params.metadataHashMode === 1 ? 0x01 : 0x00;

  // Era (1) + Nonce (N) + Tip (M) + AssetId Option (1) + MetadataHash Mode (1)
  const len = 1 + nonceCompact.length + tipCompact.length + 1 + 1;
  const out = new Uint8Array(len);
  let off = 0;
  out[off++] = 0x00; // Immortal era
  out.set(nonceCompact, off);
  off += nonceCompact.length;
  out.set(tipCompact, off);
  off += tipCompact.length;
  out[off++] = assetIdByte;
  out[off++] = metadataModeByte;
  return out;
}

/**
 * SCALE-encodes AdditionalSigned fields for Portaldot V3 (12 SignedExtensions).
 * In Portaldot V3:
 * 3. CheckSpecVersion: specVersion as u32 LE (4 bytes)
 * 4. CheckTxVersion: transactionVersion as u32 LE (4 bytes)
 * 5. CheckGenesis: genesisHash (32 bytes)
 * 6. CheckMortality: for immortal era, genesisHash (32 bytes)
 * 10. CheckMetadataHash: Option<[u8; 32]>::None (0x00)
 */
export function encodeAdditionalSigned(params: {
  specVersion: number;
  transactionVersion: number;
  genesisHash: string;
  isImmortal?: boolean;
  currentBlockHash?: string;
  metadataHash?: Uint8Array | null;
}): Uint8Array {
  const isImmortal = params.isImmortal ?? true;
  const mortalityCheckpoint = isImmortal
    ? hexToBytes(params.genesisHash)
    : hexToBytes(params.currentBlockHash || params.genesisHash);

  const genHashBytes = hexToBytes(params.genesisHash);
  if (genHashBytes.length !== 32) throw new Error('genesisHash must be 32 bytes');
  if (mortalityCheckpoint.length !== 32) throw new Error('mortalityCheckpoint must be 32 bytes');

  // u32 specVersion (4) + u32 txVersion (4) + genesis (32) + mortality (32) + metadataHash Option (1) = 73 bytes
  const out = new Uint8Array(73);
  let off = 0;

  // 3. CheckSpecVersion (u32 LE)
  const spec = params.specVersion;
  out[off++] = spec & 0xff;
  out[off++] = (spec >> 8) & 0xff;
  out[off++] = (spec >> 16) & 0xff;
  out[off++] = (spec >> 24) & 0xff;

  // 4. CheckTxVersion (u32 LE)
  const txv = params.transactionVersion;
  out[off++] = txv & 0xff;
  out[off++] = (txv >> 8) & 0xff;
  out[off++] = (txv >> 16) & 0xff;
  out[off++] = (txv >> 24) & 0xff;

  // 5. CheckGenesis
  out.set(genHashBytes, off);
  off += 32;

  // 6. CheckMortality
  out.set(mortalityCheckpoint, off);
  off += 32;

  // 10. CheckMetadataHash (Option::None = 0x00)
  out[off++] = params.metadataHash ? 0x01 : 0x00;

  return out;
}

/**
 * Constructs the complete signable payload tuple: CallData + SignedExtra + AdditionalSigned.
 */
export function constructSignablePayload(params: {
  callData: Uint8Array;
  nonce: number;
  genesisHash: string;
  specVersion: number;
  transactionVersion: number;
  tip?: bigint | number;
  isImmortal?: boolean;
}): Uint8Array {
  const extra = encodeSignedExtra({ nonce: params.nonce, tip: params.tip });
  const additional = encodeAdditionalSigned({
    specVersion: params.specVersion,
    transactionVersion: params.transactionVersion,
    genesisHash: params.genesisHash,
    isImmortal: params.isImmortal ?? true
  });

  const payload = new Uint8Array(params.callData.length + extra.length + additional.length);
  payload.set(params.callData, 0);
  payload.set(extra, params.callData.length);
  payload.set(additional, params.callData.length + extra.length);
  return payload;
}

/**
 * Determines whether the signable payload needs to be hashed before signing
 * according to Substrate and Polkadot wallet extension rules (> 256 bytes threshold).
 */
export function getSigningPayloadData(payloadBytes: Uint8Array): {
  isHashed: boolean;
  signingData: Uint8Array;
  signingHex: string;
} {
  if (payloadBytes.length > 256) {
    const hash = blake2b256(payloadBytes);
    return { isHashed: true, signingData: hash, signingHex: bytesToHex(hash) };
  }
  return { isHashed: false, signingData: payloadBytes, signingHex: bytesToHex(payloadBytes) };
}

const BLAKE2B_IV = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];

const BLAKE2B_SIGMA = [
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

/**
 * Standard BLAKE2b-256 (32 bytes output) used across Substrate for extrinsic hashes,
 * block hashes, and state keys. Supports arbitrary-length inputs via streaming chunks.
 */
export function blake2b256(input: Uint8Array): Uint8Array {
  const h = [...BLAKE2B_IV];
  h[0] ^= 0x01010020n; // 32-byte digest

  const totalLen = input.length;
  let offset = 0;
  const block = new Uint8Array(128);

  do {
    const chunkLen = Math.min(128, totalLen - offset);
    block.fill(0);
    block.set(input.subarray(offset, offset + chunkLen));
    offset += chunkLen;

    const isLast = offset === totalLen;
    const m = new BigUint64Array(block.buffer);
    const v = new BigUint64Array(16);
    for (let i = 0; i < 8; i++) v[i] = h[i];
    for (let i = 0; i < 8; i++) v[i + 8] = BLAKE2B_IV[i];

    v[12] ^= BigInt(offset);
    if (isLast) {
      v[14] ^= 0xffffffffffffffffn;
    }

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
      const s = BLAKE2B_SIGMA[round];
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
  } while (offset < totalLen);

  const out = new Uint8Array(32);
  const out64 = new BigUint64Array(out.buffer);
  for (let i = 0; i < 4; i++) out64[i] = h[i];
  return out;
}

/**
 * Parses a hex string (with or without 0x prefix) into a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes the official 32-byte Blake2b-256 hash of an extrinsic hex string or byte array.
 * Exactly matches the hash returned by author_submitExtrinsic and found in block.extrinsics.
 */
export function computeExtrinsicHash(extrinsicHexOrBytes: string | Uint8Array): string {
  const bytes = typeof extrinsicHexOrBytes === 'string'
    ? hexToBytes(extrinsicHexOrBytes)
    : extrinsicHexOrBytes;
  return bytesToHex(blake2b256(bytes));
}

/**
 * Assembles a complete SCALE-encoded signed extrinsic (V4) from user signature.
 * Format for Portaldot V3.0 (with 12 SignedExtensions):
 *   [Compact<Length>, Version (0x84), MultiAddress::Id (0x00 + 32 bytes), MultiSignature::Sr25519 (0x01 + 64 bytes), SignedExtra, CallData]
 *
 * SignedExtra order for Portaldot V3:
 *   1. AuthorizeCall: () (0 bytes)
 *   2. CheckNonZeroSender: () (0 bytes)
 *   3. CheckSpecVersion: () (0 bytes)
 *   4. CheckTxVersion: () (0 bytes)
 *   5. CheckGenesis: () (0 bytes)
 *   6. CheckMortality: Era (1 byte: 0x00 immortal)
 *   7. CheckNonce: Compact<u32>
 *   8. CheckWeight: () (0 bytes)
 *   9. ChargeAssetTxPayment: Compact<u128> tip + Option<AssetId> (0x00 = None)
 *   10. CheckMetadataHash: Mode (0x00 = Disabled)
 *   11. EthSetOrigin: () (0 bytes)
 *   12. WeightReclaim: () (0 bytes)
 */
export function constructSignedExtrinsic(params: {
  signerPublicKey: Uint8Array;
  signatureHex: string;
  nonce: number;
  callData: Uint8Array;
  tip?: bigint | number;
  assetId?: Uint8Array | null;
  metadataHashMode?: number;
}): Uint8Array {
  const {
    signerPublicKey,
    signatureHex,
    nonce,
    callData,
    tip = 0n,
    assetId = null,
    metadataHashMode = 0
  } = params;

  if (signerPublicKey.length !== 32) {
    throw new Error(`signerPublicKey must be 32 bytes, got ${signerPublicKey.length}`);
  }

  const rawSig = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  const sigBytes = new Uint8Array(rawSig.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  if (sigBytes.length !== 64 && sigBytes.length !== 65) {
    throw new Error(`Invalid signature length: expected 64 or 65 bytes, got ${sigBytes.length}`);
  }
  const signature64 = sigBytes.slice(0, 64);

  const nonceCompact = encodeCompact(nonce);
  const tipCompact = encodeCompact(tip);
  const assetIdByte = assetId ? 0x01 : 0x00; // Option::None = 0x00
  const metadataModeByte = metadataHashMode === 1 ? 0x01 : 0x00; // Mode::Disabled = 0x00

  // Calculate total SignedExtra length
  // Era (1) + Nonce (N) + Tip (M) + AssetId Option (1) + MetadataHash Mode (1)
  const signedExtraLen = 1 + nonceCompact.length + tipCompact.length + 1 + 1;

  // Inner extrinsic body (without overall length prefix)
  // Version (1) + MultiAddress::Id (1 + 32) + MultiSignature::Sr25519 (1 + 64) + SignedExtra (signedExtraLen) + CallData (M)
  const bodyLen = 1 + (1 + 32) + (1 + 64) + signedExtraLen + callData.length;
  const body = new Uint8Array(bodyLen);

  let offset = 0;
  body[offset++] = 0x84; // V4 Signed extrinsic

  // Signer
  body[offset++] = 0x00; // MultiAddress::Id
  body.set(signerPublicKey, offset);
  offset += 32;

  // Signature
  body[offset++] = 0x01; // Sr25519 MultiSignature variant
  body.set(signature64, offset);
  offset += 64;

  // SignedExtra fields in exact runtime metadata order:
  // 6. CheckMortality
  body[offset++] = 0x00; // Era (0x00 = Immortal era)

  // 7. CheckNonce
  body.set(nonceCompact, offset);
  offset += nonceCompact.length;

  // 9. ChargeAssetTxPayment
  body.set(tipCompact, offset);
  offset += tipCompact.length;
  body[offset++] = assetIdByte; // Option<AssetId> (0x00 = None)

  // 10. CheckMetadataHash
  body[offset++] = metadataModeByte; // Mode (0x00 = Disabled)

  // Call
  body.set(callData, offset);
  offset += callData.length;

  // Prepend compact length of the extrinsic body
  const lengthPrefix = encodeCompact(body.length);
  const fullExtrinsic = new Uint8Array(lengthPrefix.length + body.length);
  fullExtrinsic.set(lengthPrefix, 0);
  fullExtrinsic.set(body, lengthPrefix.length);

  return fullExtrinsic;
}

/**
 * Converts a byte array to hex string with 0x prefix.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decodes a Substrate FRAME DispatchError according to Portaldot V3.0 runtime metadata:
 * - Module error (variant 3): pallet index + error index
 * - Token error (variant 7)
 * - Arithmetic error (variant 8)
 */
export function decodeDispatchError(errorBytes: Uint8Array): string {
  if (!errorBytes || errorBytes.length === 0) {
    return 'Unknown dispatch error';
  }

  const variant = errorBytes[0];
  if (variant === 0) return 'DispatchError::Other';
  if (variant === 1) return 'DispatchError::CannotLookup';
  if (variant === 2) return 'DispatchError::BadOrigin';

  if (variant === 3) {
    // Module error: [variant(3), palletIndex, errorIndex, ...]
    const palletIndex = errorBytes[1];
    const errorIndex = errorBytes[2];

    if (palletIndex === 6) {
      // pallet_balances::pallet::Error
      const balancesErrors: Record<number, string> = {
        0: 'VestingBalance (vesting balance too high to send)',
        1: 'LiquidityRestrictions (liquidity restrictions prevent transfer)',
        2: 'InsufficientBalance (account balance too low for transfer)',
        3: 'ExistentialDeposit (transfer drops sender or recipient below Existential Deposit of 0.1000 tPOT)',
        4: 'Expendability (cannot expend account balance)',
        5: 'ExistingVestingSchedule',
        6: 'DeadAccount (recipient cannot be reaped or created)',
        7: 'TooManyReserves',
        8: 'TooManyHolds',
        9: 'TooManyFreezes',
        10: 'IssuanceDeactivated',
        11: 'DeltaZero'
      };
      return `Balances.${balancesErrors[errorIndex] || `Error(${errorIndex})`}`;
    }

    return `ModuleError(Pallet: ${palletIndex}, ErrorIndex: ${errorIndex})`;
  }

  if (variant === 7) {
    const tokenErrors = ['FundsUnavailable', 'OnlyProvider', 'BelowMinimum', 'CannotCreate', 'UnknownAsset', 'Frozen', 'Unsupported', 'CannotCreateHold', 'NotExpendable', 'Blocked'];
    return `TokenError.${tokenErrors[errorBytes[1]] || errorBytes[1]}`;
  }

  if (variant === 8) {
    const arithErrors = ['Underflow', 'Overflow', 'DivisionByZero'];
    return `ArithmeticError.${arithErrors[errorBytes[1]] || errorBytes[1]}`;
  }

  return `DispatchError(Variant: ${variant})`;
}

export interface ExtrinsicDispatchVerification {
  success: boolean;
  eventName: string;
  error?: string;
  palletIndex?: number;
  eventIndex?: number;
}

/**
 * Parses SCALE-encoded System.Events from a finalized block and extracts
 * the definitive dispatch outcome (System.ExtrinsicSuccess or System.ExtrinsicFailed)
 * for a specific extrinsic index.
 */
export function parseExtrinsicDispatchResult(
  eventsHexOrBytes: string | Uint8Array,
  targetExtrinsicIndex: number
): ExtrinsicDispatchVerification {
  const bytes = typeof eventsHexOrBytes === 'string'
    ? hexToBytes(eventsHexOrBytes)
    : eventsHexOrBytes;

  if (bytes.length === 0) {
    return {
      success: false,
      eventName: 'System.EventsMissing',
      error: 'Block events storage is empty'
    };
  }

  // Target phase for ApplyExtrinsic(targetExtrinsicIndex):
  // [0x00, idx_b0, idx_b1, idx_b2, idx_b3]
  const targetPhase = new Uint8Array(5);
  targetPhase[0] = 0x00; // Phase::ApplyExtrinsic
  targetPhase[1] = targetExtrinsicIndex & 0xff;
  targetPhase[2] = (targetExtrinsicIndex >> 8) & 0xff;
  targetPhase[3] = (targetExtrinsicIndex >> 16) & 0xff;
  targetPhase[4] = (targetExtrinsicIndex >> 24) & 0xff;

  // Search for targetPhase in events bytes
  let foundExtrinsicSuccess = false;
  let foundExtrinsicFailed = false;
  let dispatchErrorMsg: string | undefined;

  for (let i = 0; i <= bytes.length - 7; i++) {
    // Check if phase matches
    if (
      bytes[i] === targetPhase[0] &&
      bytes[i + 1] === targetPhase[1] &&
      bytes[i + 2] === targetPhase[2] &&
      bytes[i + 3] === targetPhase[3] &&
      bytes[i + 4] === targetPhase[4]
    ) {
      const palletIndex = bytes[i + 5];
      const eventIndex = bytes[i + 6];

      // System pallet is index 0
      if (palletIndex === 0) {
        if (eventIndex === 0) {
          // System::ExtrinsicSuccess
          foundExtrinsicSuccess = true;
        } else if (eventIndex === 1) {
          // System::ExtrinsicFailed
          foundExtrinsicFailed = true;
          // Subsequent bytes contain DispatchError
          const errorSlice = bytes.slice(i + 7);
          dispatchErrorMsg = decodeDispatchError(errorSlice);
        }
      }
    }
  }

  if (foundExtrinsicFailed) {
    return {
      success: false,
      eventName: 'System.ExtrinsicFailed',
      error: dispatchErrorMsg || 'Extrinsic execution failed on-chain'
    };
  }

  if (foundExtrinsicSuccess) {
    return {
      success: true,
      eventName: 'System.ExtrinsicSuccess'
    };
  }

  return {
    success: false,
    eventName: 'System.EventNotFound',
    error: `No dispatch event found for extrinsic index ${targetExtrinsicIndex} in block events`
  };
}
