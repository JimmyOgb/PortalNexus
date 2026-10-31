/**
 * Substrate Transfer Lifecycle & Security Remediation Tests (SEC-01, SEC-03, SEC-04, SEC-05)
 *
 * All rejection, error, and lifecycle mocks are explicitly labeled as mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PORTALDOT_SUBSTRATE_CONSTANTS,
  PORTALDOT_V3_SIGNED_EXTENSIONS,
  decodeSS58,
  encodeCompact,
  encodeTransferKeepAliveCall,
  constructSignedExtrinsic,
  constructSignerPayload,
  encodeSignedExtra,
  encodeAdditionalSigned,
  constructSignablePayload,
  getSigningPayloadData,
  parseSubstrateNativeUnits,
  formatSubstrateNativeUnits,
  bytesToHex,
  blake2b256,
  computeExtrinsicHash,
  decodeDispatchError,
  parseExtrinsicDispatchResult
} from '../src/lib/substrateUtils';
import { INDEPENDENT_SUBSTRATE_REFERENCE } from './fixtures/independentSubstrateVectors';
import { SubstrateWalletService } from '../src/services/substrateWallet';
import { SubstrateRpcClient } from '../src/services/substrateRpc';
import { SubstrateTransferService } from '../src/services/substrateTransferService';
import { DeploymentService } from '../src/services/deploymentService';
import { EvmRpcClient } from '../src/services/evmRpc';
import { EvmWalletService } from '../src/services/evmWallet';
import { BUILTIN_DEPLOYMENT, CONTRACT_REGISTRY } from '../src/contracts/config';

const aliceSS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'; // Prefix 42
const referenceSS58 = '5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j'; // Deployer mapped

describe('Substrate SCALE Encoding & SS58 Utilities (SEC-01)', () => {

  it('correctly decodes valid SS58 Prefix 42 addresses', () => {
    const decoded = decodeSS58(referenceSS58, 42);
    expect(decoded.prefix).toBe(42);
    expect(decoded.publicKey).toHaveLength(32);
    expect(decoded.publicKeyHex).toBe('0x1111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee');
  });

  it('rejects invalid or non-prefix-42 SS58 addresses', () => {
    // Corrupted checksum
    expect(() => decodeSS58('5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8X', 42)).toThrow(/checksum verification failed/);
    // Non-5 prefix (e.g., Polkadot mainnet prefix 0 starts with 1)
    expect(() => decodeSS58('15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5', 42)).toThrow(/expected Prefix 42 starting with '5'/);
    // Empty
    expect(() => decodeSS58('', 42)).toThrow(/Address must be a non-empty string/);
  });

  it('encodes compact integers across mode 0, 1, 2, and big-compact boundaries', () => {
    // Mode 0: 0 <= n <= 63 (single byte)
    expect(encodeCompact(0)).toEqual(new Uint8Array([0x00]));
    expect(encodeCompact(1)).toEqual(new Uint8Array([0x04]));
    expect(encodeCompact(42)).toEqual(new Uint8Array([0xa8]));

    // Mode 1: 64 <= n <= 16383 (two bytes)
    const c69 = encodeCompact(69);
    expect(c69).toEqual(new Uint8Array([0x15, 0x01]));

    // Big-compact: 10^14 units (1 tPOT = 100,000,000,000,000)
    const c1Pot = encodeCompact(100_000_000_000_000n);
    expect(c1Pot[0]).toBe(0x0b); // 6 bytes -> (6-4)<<2 | 3 = 11 = 0x0b
  });

  it('encodes balances.transfer_keep_alive call data with verified pallet & call index', () => {
    const recipient = decodeSS58(aliceSS58, 42).publicKey;
    const amount = 100_000_000_000_000n; // 1 tPOT
    const callData = encodeTransferKeepAliveCall(recipient, amount);

    // Byte 0: Pallet index = 6
    expect(callData[0]).toBe(PORTALDOT_SUBSTRATE_CONSTANTS.balancesPalletIndex);
    expect(callData[0]).toBe(6);

    // Byte 1: Call index = 3 (transfer_keep_alive)
    expect(callData[1]).toBe(PORTALDOT_SUBSTRATE_CONSTANTS.transferKeepAliveCallIndex);
    expect(callData[1]).toBe(3);

    // Byte 2: MultiAddress::Id variant = 0x00
    expect(callData[2]).toBe(0x00);

    // Bytes 3-34: 32 bytes recipient public key
    expect(callData.slice(3, 35)).toEqual(recipient);

    // Remainder: Compact value
    expect(callData.slice(35)).toEqual(encodeCompact(amount));
  });

  it('correctly parses and formats 14-decimal Substrate units', () => {
    const parsed = parseSubstrateNativeUnits('2.5', 14);
    expect(parsed).toBe(250_000_000_000_000n);

    const formatted = formatSubstrateNativeUnits(parsed, 14, 4);
    expect(formatted).toBe('2.5000 tPOT');
  });

  it('defines all 12 SignedExtensions in exact Portaldot V3.0 runtime metadata order', () => {
    expect(PORTALDOT_V3_SIGNED_EXTENSIONS).toEqual([
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
    ]);
  });

  it('computes canonical BLAKE2b-256 extrinsic hash matching standard test vectors', () => {
    const input = new TextEncoder().encode('hello world');
    const hash = bytesToHex(blake2b256(input));
    expect(hash).toBe('0x256c83b297114d201b30179f3f0ef0cace9783622da5974326b436178aeef610');

    const extrinsicHex = '0x123456';
    const computed = computeExtrinsicHash(extrinsicHex);
    expect(computed.startsWith('0x')).toBe(true);
    expect(computed).toHaveLength(66);
  });

  it('assembles standard V4 signed extrinsic with exact 12-SignedExtension byte layout', () => {
    const signer = decodeSS58(referenceSS58, 42).publicKey;
    const recipient = decodeSS58(aliceSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, 100_000_000_000_000n);
    const mockSigHex = '0x' + 'aa'.repeat(64);

    const extrinsic = constructSignedExtrinsic({
      signerPublicKey: signer,
      signatureHex: mockSigHex,
      nonce: 5,
      callData,
      tip: 0n,
      assetId: null,
      metadataHashMode: 0
    });

    const hex = bytesToHex(extrinsic);
    expect(hex.startsWith('0x')).toBe(true);

    // Compact length prefix precedes the body
    // For body length ~144 bytes, length prefix is 2 bytes (mode 1 compact)
    let offset = 0;
    const firstByte = extrinsic[offset++];
    if ((firstByte & 0x03) === 1) offset++; // mode 1: 2 bytes
    else if ((firstByte & 0x03) === 2) offset += 3; // mode 2: 4 bytes

    // Version byte: 0x84 (Signed extrinsic V4)
    expect(extrinsic[offset++]).toBe(0x84);

    // MultiAddress::Id variant = 0x00
    expect(extrinsic[offset++]).toBe(0x00);

    // 32 bytes signer public key
    expect(extrinsic.slice(offset, offset + 32)).toEqual(signer);
    offset += 32;

    // MultiSignature::Sr25519 variant = 0x01
    expect(extrinsic[offset++]).toBe(0x01);

    // 64 bytes signature
    expect(bytesToHex(extrinsic.slice(offset, offset + 64))).toBe(mockSigHex);
    offset += 64;

    // SignedExtra in exact Portaldot V3 runtime metadata order:
    // 6. CheckMortality Era (0x00 for Immortal)
    expect(extrinsic[offset++]).toBe(0x00);

    // 7. CheckNonce (Compact 5 = 5 << 2 = 20 = 0x14)
    expect(extrinsic[offset++]).toBe(0x14);

    // 9. ChargeAssetTxPayment tip (Compact 0 = 0x00)
    expect(extrinsic[offset++]).toBe(0x00);

    // 9. ChargeAssetTxPayment asset_id (Option::None = 0x00)
    expect(extrinsic[offset++]).toBe(0x00);

    // 10. CheckMetadataHash mode (Mode::Disabled = 0x00)
    expect(extrinsic[offset++]).toBe(0x00);

    // CallData (Pallet 6, Call 3, ...)
    expect(extrinsic[offset]).toBe(6);
    expect(extrinsic[offset + 1]).toBe(3);
    expect(extrinsic.slice(offset)).toEqual(callData);
  });
});

describe('Independent Reference Vector Verification (Finding 2)', () => {
  const ref = INDEPENDENT_SUBSTRATE_REFERENCE;

  it('matches independent Python scalecodec 1.2.12 callData encoding bit-for-bit', () => {
    const recipient = decodeSS58(ref.testAccounts.alice.addressSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, ref.callData.amountUnits);
    expect(bytesToHex(callData)).toBe(ref.callData.expectedCallDataHex);
    expect(callData.length).toBe(ref.callData.length);
  });

  it('matches independent Python scalecodec 1.2.12 SignedExtra encoding (12 extensions)', () => {
    const signedExtra = encodeSignedExtra({
      nonce: ref.signedExtra.nonce,
      tip: ref.signedExtra.tip,
      assetId: ref.signedExtra.assetId,
      metadataHashMode: ref.signedExtra.metadataHashMode
    });
    expect(bytesToHex(signedExtra)).toBe(ref.signedExtra.expectedSignedExtraHex);
    expect(signedExtra.length).toBe(ref.signedExtra.length);
  });

  it('matches independent Python scalecodec 1.2.12 AdditionalSigned encoding (73 bytes)', () => {
    const additionalSigned = encodeAdditionalSigned({
      specVersion: ref.additionalSigned.specVersion,
      transactionVersion: ref.additionalSigned.transactionVersion,
      genesisHash: ref.additionalSigned.genesisHash,
      isImmortal: ref.additionalSigned.isImmortal
    });
    expect(bytesToHex(additionalSigned)).toBe(ref.additionalSigned.expectedAdditionalSignedHex);
    expect(additionalSigned.length).toBe(ref.additionalSigned.length);
  });

  it('matches independent Python scalecodec 1.2.12 signable payload (120 bytes)', () => {
    const recipient = decodeSS58(ref.testAccounts.alice.addressSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, ref.callData.amountUnits);
    const signablePayload = constructSignablePayload({
      callData,
      nonce: ref.signedExtra.nonce,
      genesisHash: ref.additionalSigned.genesisHash,
      specVersion: ref.additionalSigned.specVersion,
      transactionVersion: ref.additionalSigned.transactionVersion,
      tip: ref.signedExtra.tip,
      isImmortal: true
    });
    expect(bytesToHex(signablePayload)).toBe(ref.signablePayload.expectedSignablePayloadHex);
    expect(signablePayload.length).toBe(ref.signablePayload.length);
  });

  it('enforces payload hashing threshold: raw for <= 256 bytes, BLAKE2b-256 for > 256 bytes', () => {
    const recipient = decodeSS58(ref.testAccounts.alice.addressSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, ref.callData.amountUnits);
    const normalPayload = constructSignablePayload({
      callData,
      nonce: ref.signedExtra.nonce,
      genesisHash: ref.additionalSigned.genesisHash,
      specVersion: ref.additionalSigned.specVersion,
      transactionVersion: ref.additionalSigned.transactionVersion,
      tip: 0n,
      isImmortal: true
    });

    const normalResult = getSigningPayloadData(normalPayload);
    expect(normalResult.isHashed).toBe(false);
    expect(normalResult.signingHex).toBe(ref.signablePayload.expectedSignablePayloadHex);

    // Large payload (> 256 bytes)
    const largeRemark = new TextEncoder().encode('PortalNexus Substrate Extrinsic Verification with Authoritative Frame Vectors'.repeat(4));
    const largeCallData = new Uint8Array(2 + encodeCompact(largeRemark.length).length + largeRemark.length);
    largeCallData[0] = 0x00;
    largeCallData[1] = 0x01;
    largeCallData.set(encodeCompact(largeRemark.length), 2);
    largeCallData.set(largeRemark, 2 + encodeCompact(largeRemark.length).length);

    const largePayload = constructSignablePayload({
      callData: largeCallData,
      nonce: ref.signedExtra.nonce,
      genesisHash: ref.additionalSigned.genesisHash,
      specVersion: ref.additionalSigned.specVersion,
      transactionVersion: ref.additionalSigned.transactionVersion,
      tip: 0n,
      isImmortal: true
    });

    expect(largePayload.length).toBe(ref.largeSignablePayload.length);
    const largeResult = getSigningPayloadData(largePayload);
    expect(largeResult.isHashed).toBe(true);
    expect(largeResult.signingHex).toBe(ref.largeSignablePayload.expectedBlake2b256Hex);
  });

  it('matches independent Python scalecodec 1.2.12 complete serialized V4 signed extrinsic and canonical hash', () => {
    const signer = decodeSS58(ref.testAccounts.signer.addressSS58, 42).publicKey;
    const recipient = decodeSS58(ref.testAccounts.alice.addressSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, ref.callData.amountUnits);

    const extrinsic = constructSignedExtrinsic({
      signerPublicKey: signer,
      signatureHex: ref.finalExtrinsic.mockSignatureHex,
      nonce: ref.signedExtra.nonce,
      callData,
      tip: ref.signedExtra.tip,
      assetId: null,
      metadataHashMode: 0
    });

    expect(bytesToHex(extrinsic)).toBe(ref.finalExtrinsic.expectedExtrinsicHex);
    expect(extrinsic.length).toBe(ref.finalExtrinsic.length);

    const txHash = computeExtrinsicHash(extrinsic);
    expect(txHash).toBe(ref.finalExtrinsic.expectedExtrinsicHashHex);
  });
});

describe('Immortal-Era Signing Checkpoint Verification (Finding 1)', () => {
  const ref = INDEPENDENT_SUBSTRATE_REFERENCE;

  it('strictly sets blockHash to genesisHash and blockNumber to 0 for immortal-era payloads', () => {
    const payload = constructSignerPayload({
      address: ref.testAccounts.signer.addressSS58,
      callDataHex: ref.callData.expectedCallDataHex,
      nonce: 3,
      genesisHash: ref.provenance.genesisHash,
      specVersion: ref.provenance.specVersion,
      transactionVersion: ref.provenance.transactionVersion,
      isImmortal: true,
      currentBlockHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      currentBlockNumber: 240500
    });

    expect(payload.era).toBe('0x00');
    expect(payload.blockHash).toBe(ref.provenance.genesisHash);
    expect(payload.genesisHash).toBe(ref.provenance.genesisHash);
    expect(payload.blockNumber).toBe('0x0');
    expect(payload.signedExtensions).toEqual(PORTALDOT_V3_SIGNED_EXTENSIONS);
  });

  it('proves that a non-genesis blockHash creates an invalid AdditionalSigned mismatch against the node', () => {
    const wrongBlockHash = '0x9999999999999999999999999999999999999999999999999999999999999999';

    const nodeExpectedAdditional = encodeAdditionalSigned({
      specVersion: 3002,
      transactionVersion: 2,
      genesisHash: ref.provenance.genesisHash,
      isImmortal: true
    });

    const flawedAdditional = encodeAdditionalSigned({
      specVersion: 3002,
      transactionVersion: 2,
      genesisHash: ref.provenance.genesisHash,
      isImmortal: false,
      currentBlockHash: wrongBlockHash
    });

    expect(bytesToHex(nodeExpectedAdditional)).not.toBe(bytesToHex(flawedAdditional));
    expect(bytesToHex(flawedAdditional)).toContain(wrongBlockHash.slice(2));
  });
});

describe('Substrate Transfer Validation & Existential Deposit Keep-Alive (SEC-01)', () => {
  let transferService: SubstrateTransferService;
  const mockSender = {
    address: '5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j',
    name: 'Deployer',
    source: 'talisman'
  };

  beforeEach(() => {
    transferService = new SubstrateTransferService();
  });

  it('rejects transfer when Substrate wallet is not connected', () => {
    const res = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '1.0', null, null);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Substrate wallet is not connected');
  });

  it('rejects transfer with invalid recipient address', () => {
    const res = transferService.validateTransfer('invalid-address', '1.0', mockSender, null);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid SS58 address');
  });

  it('rejects transfer when amount is zero or negative', () => {
    const resZero = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '0', mockSender, null);
    expect(resZero.isValid).toBe(false);

    const resNeg = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '-1', mockSender, null);
    expect(resNeg.isValid).toBe(false);
  });

  it('rejects transfer when amount exceeds current balance', () => {
    // Balance is 1.0 tPOT (100,000,000,000,000 units), requesting 2.0 tPOT
    const balanceUnits = '100000000000000';
    const res = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '2.0', mockSender, balanceUnits);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Insufficient tPOT balance');
  });

  it('enforces Keep-Alive rule: rejects transfer that would drop remaining balance below 0.1000 tPOT Existential Deposit', () => {
    // Balance: 1.0 tPOT = 100,000,000,000,000 units
    // Requesting 0.95 tPOT -> Remaining balance would be 0.05 tPOT (< 0.1000 tPOT ED)
    const balanceUnits = '100000000000000';
    const res = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '0.95', mockSender, balanceUnits);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Keep-Alive safety guard');
    expect(res.error).toContain('Existential Deposit');
    expect(res.error).toContain('0.1000 tPOT');
  });

  it('approves transfer when remaining balance stays strictly above Existential Deposit', () => {
    // Balance: 1.0 tPOT, requesting 0.5 tPOT -> Remaining balance is 0.5 tPOT (> 0.1000 tPOT ED)
    const balanceUnits = '100000000000000';
    const res = transferService.validateTransfer('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '0.5', mockSender, balanceUnits);
    expect(res.isValid).toBe(true);
    expect(res.error).toBeNull();
    expect(res.amountUnits).toBe(50_000_000_000_000n);
  });
});

describe('Substrate Transaction Lifecycle & Adapter Compatibility (SEC-01)', () => {
  let transferService: SubstrateTransferService;
  let mockWallet: SubstrateWalletService;
  let mockRpc: SubstrateRpcClient;

  const mockSender = {
    address: '5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j',
    name: 'Deployer',
    source: 'polkadot-js'
  };

  beforeEach(() => {
    transferService = new SubstrateTransferService();
    mockRpc = new SubstrateRpcClient();
    mockWallet = new SubstrateWalletService(mockRpc);
  });

  it('fails safely and cleanly when wallet adapter does NOT support extrinsic signing (signPayload)', async () => {
    // Mock connected state without signPayload (e.g. only signRaw message signer)
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(false);

    await expect(
      transferService.executeTransfer({
        recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        amountStr: '0.1',
        wallet: mockWallet,
        rpc: mockRpc
      })
    ).rejects.toThrow(/does not support extrinsic signing \(signPayload unavailable\)/);
  });

  it('handles user rejection in wallet extension cleanly without corrupted state [Mocked Rejection]', async () => {
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(true);

    // Mock RPC calls
    vi.spyOn(mockRpc, 'getGenesisHash').mockResolvedValue('0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd');
    vi.spyOn(mockRpc, 'getAccountNonce').mockResolvedValue(0);

    // Mock user wallet rejection
    const rejectionError = new Error('User cancelled the signing request.');
    vi.spyOn(mockWallet, 'signPayload').mockRejectedValue(rejectionError);

    await expect(
      transferService.executeTransfer({
        recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        amountStr: '0.1',
        wallet: mockWallet,
        rpc: mockRpc
      })
    ).rejects.toThrow(/User cancelled the signing request/);

    expect(transferService.getIsBusy()).toBe(false);
  });

  it('executes full verified Substrate transfer lifecycle upon wallet authorization [Mocked Lifecycle]', async () => {
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(true);

    const mockGenesisHash = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
    const mockTxHash = '0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
    const mockFinalizedHash = '0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa';

    vi.spyOn(mockRpc, 'getGenesisHash').mockResolvedValue(mockGenesisHash);
    vi.spyOn(mockRpc, 'getAccountNonce').mockResolvedValue(3);
    vi.spyOn(mockWallet, 'signPayload').mockResolvedValue({ id: 1, signature: '0x' + 'bb'.repeat(64) });
    vi.spyOn(mockRpc, 'submitExtrinsic').mockResolvedValue(mockTxHash);
    vi.spyOn(mockRpc, 'waitForExtrinsicInclusion').mockResolvedValue({
      blockHash: mockFinalizedHash,
      blockNumber: 240100,
      extrinsicIndex: 1
    });
    vi.spyOn(mockRpc, 'verifyDispatchSuccess').mockResolvedValue({ success: true, eventName: 'System.ExtrinsicSuccess' });

    const statusUpdates: string[] = [];
    const result = await transferService.executeTransfer({
      recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      amountStr: '0.2',
      wallet: mockWallet,
      rpc: mockRpc,
      onStatusUpdate: (s) => statusUpdates.push(s)
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe(mockTxHash);
    expect(result.finalizedBlockHash).toBe(mockFinalizedHash);
    expect(result.blockNumber).toBe(240100);
    expect(result.extrinsicIndex).toBe(1);
    expect(result.amount).toBe('0.2');
    expect(transferService.getIsBusy()).toBe(false);
    expect(statusUpdates.length).toBeGreaterThan(2);

    // Verify Finding 1: wallet.signPayload received strict immortal genesis checkpoint
    expect(mockWallet.signPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        blockHash: mockGenesisHash,
        genesisHash: mockGenesisHash,
        blockNumber: '0x0',
        era: '0x00',
        signedExtensions: PORTALDOT_V3_SIGNED_EXTENSIONS
      })
    );
  });

  it('fails closed when on-chain extrinsic dispatch fails [Mocked Dispatch Failure]', async () => {
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(true);

    vi.spyOn(mockRpc, 'getGenesisHash').mockResolvedValue('0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd');
    vi.spyOn(mockRpc, 'getAccountNonce').mockResolvedValue(0);
    vi.spyOn(mockWallet, 'signPayload').mockResolvedValue({ id: 1, signature: '0x' + 'bb'.repeat(64) });
    vi.spyOn(mockRpc, 'submitExtrinsic').mockResolvedValue('0xtxhash');
    vi.spyOn(mockRpc, 'waitForExtrinsicInclusion').mockResolvedValue({
      blockHash: '0xfinblock',
      blockNumber: 240101,
      extrinsicIndex: 0
    });
    vi.spyOn(mockRpc, 'verifyDispatchSuccess').mockResolvedValue({
      success: false,
      error: 'Balances.InsufficientBalance (account balance too low for transfer)'
    });

    await expect(
      transferService.executeTransfer({
        recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        amountStr: '0.2',
        wallet: mockWallet,
        rpc: mockRpc
      })
    ).rejects.toThrow(/Balances.InsufficientBalance/);

    expect(transferService.getIsBusy()).toBe(false);
  });

  it('handles extrinsic inclusion timeout when transaction is dropped or unconfirmed [Mocked Timeout]', async () => {
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(true);

    vi.spyOn(mockRpc, 'getGenesisHash').mockResolvedValue('0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd');
    vi.spyOn(mockRpc, 'getAccountNonce').mockResolvedValue(0);
    vi.spyOn(mockWallet, 'signPayload').mockResolvedValue({ id: 1, signature: '0x' + 'bb'.repeat(64) });
    vi.spyOn(mockRpc, 'submitExtrinsic').mockResolvedValue('0xtxhash');
    vi.spyOn(mockRpc, 'waitForExtrinsicInclusion').mockRejectedValue(
      new Error('Extrinsic inclusion timed out after 60s. The extrinsic was not included in any finalized block.')
    );

    await expect(
      transferService.executeTransfer({
        recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        amountStr: '0.2',
        wallet: mockWallet,
        rpc: mockRpc
      })
    ).rejects.toThrow(/Extrinsic inclusion timed out/);

    expect(transferService.getIsBusy()).toBe(false);
  });

  it('prevents concurrent duplicate submissions while a transfer is in flight', async () => {
    vi.spyOn(mockWallet, 'getState').mockReturnValue({
      isConnected: true,
      selectedAccount: mockSender,
      accounts: [mockSender],
      availableExtensions: ['polkadot-js'],
      balanceRaw: '100000000000000',
      balanceFormatted: '1.0000 tPOT',
      isConnecting: false,
      error: null
    });
    vi.spyOn(mockWallet, 'isExtrinsicSignerAvailable').mockReturnValue(true);

    // Mock unresolved promise to keep transfer in-flight
    vi.spyOn(mockRpc, 'getGenesisHash').mockReturnValue(new Promise(() => {}));

    const flight1 = transferService.executeTransfer({
      recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      amountStr: '0.1',
      wallet: mockWallet,
      rpc: mockRpc
    });
    expect(flight1).toBeDefined();

    expect(transferService.getIsBusy()).toBe(true);

    // Second flight must be immediately rejected by concurrency guard
    await expect(
      transferService.executeTransfer({
        recipientSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        amountStr: '0.1',
        wallet: mockWallet,
        rpc: mockRpc
      })
    ).rejects.toThrow(/A Substrate transfer is already in progress/);
  });
});

describe('Substrate Event-Based Dispatch Decoding & Verification (SEC-01)', () => {
  it('correctly decodes System.ExtrinsicSuccess for target extrinsic index', () => {
    // Construct event record for ApplyExtrinsic(1):
    // Phase: [0x00, 0x01, 0x00, 0x00, 0x00]
    // Pallet 0 (System), Event 0 (ExtrinsicSuccess), Weight/Info ...
    const eventBytes = new Uint8Array([
      0x04, // Vec len 1 (compact 1 << 2)
      0x00, 0x01, 0x00, 0x00, 0x00, // Phase::ApplyExtrinsic(1)
      0x00, // System pallet
      0x00, // ExtrinsicSuccess event
      0x22, 0x90, 0x75, 0x00, // Weight info
      0x00 // Topics len 0
    ]);

    const res = parseExtrinsicDispatchResult(eventBytes, 1);
    expect(res.success).toBe(true);
    expect(res.eventName).toBe('System.ExtrinsicSuccess');
  });

  it('correctly decodes System.ExtrinsicFailed with Balances.InsufficientBalance for target extrinsic index', () => {
    // Phase: ApplyExtrinsic(2)
    // Pallet 0 (System), Event 1 (ExtrinsicFailed)
    // DispatchError::Module (variant 3): pallet 6 (Balances), error 2 (InsufficientBalance)
    const eventBytes = new Uint8Array([
      0x04,
      0x00, 0x02, 0x00, 0x00, 0x00, // Phase::ApplyExtrinsic(2)
      0x00, // System pallet
      0x01, // ExtrinsicFailed event
      0x03, 0x06, 0x02, 0x00, 0x00, 0x00 // ModuleError: pallet 6 (Balances), error 2 (InsufficientBalance)
    ]);

    const res = parseExtrinsicDispatchResult(eventBytes, 2);
    expect(res.success).toBe(false);
    expect(res.eventName).toBe('System.ExtrinsicFailed');
    expect(res.error).toContain('Balances.InsufficientBalance');
  });

  it('correctly decodes System.ExtrinsicFailed with Balances.ExistentialDeposit', () => {
    const errorBytes = new Uint8Array([0x03, 0x06, 0x03, 0x00, 0x00, 0x00]);
    const decoded = decodeDispatchError(errorBytes);
    expect(decoded).toContain('Balances.ExistentialDeposit');
    expect(decoded).toContain('0.1000 tPOT');
  });

  it('isolates target extrinsic index events from unrelated extrinsic events in the same block', () => {
    // Multi-event stream:
    // Event 1: Extrinsic 0 succeeded
    // Event 2: Extrinsic 1 failed with ExistentialDeposit
    // Event 3: Extrinsic 2 succeeded
    const multiEventBytes = new Uint8Array([
      0x0c, // Compact 3 events
      // Event 1: Extrinsic 0
      0x00, 0x00, 0x00, 0x00, 0x00, // ApplyExtrinsic(0)
      0x00, 0x00, 0x22, 0x00, // System.ExtrinsicSuccess
      // Event 2: Extrinsic 1
      0x00, 0x01, 0x00, 0x00, 0x00, // ApplyExtrinsic(1)
      0x00, 0x01, 0x03, 0x06, 0x03, // System.ExtrinsicFailed (Balances.ExistentialDeposit)
      // Event 3: Extrinsic 2
      0x00, 0x02, 0x00, 0x00, 0x00, // ApplyExtrinsic(2)
      0x00, 0x00, 0x22, 0x00 // System.ExtrinsicSuccess
    ]);

    // Query for extrinsic 0 -> success
    const res0 = parseExtrinsicDispatchResult(multiEventBytes, 0);
    expect(res0.success).toBe(true);

    // Query for extrinsic 1 -> failed with ExistentialDeposit
    const res1 = parseExtrinsicDispatchResult(multiEventBytes, 1);
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('Balances.ExistentialDeposit');

    // Query for extrinsic 2 -> success
    const res2 = parseExtrinsicDispatchResult(multiEventBytes, 2);
    expect(res2.success).toBe(true);

    // Query for non-existent extrinsic 3 -> not found
    const res3 = parseExtrinsicDispatchResult(multiEventBytes, 3);
    expect(res3.success).toBe(false);
    expect(res3.error).toContain('No dispatch event found for extrinsic index 3');
  });

  it('handles CheckMetadataHash mode: 0 (Disabled) vs 1 (Enabled) correctly in SignedExtra', () => {
    const signer = decodeSS58(referenceSS58, 42).publicKey;
    const recipient = decodeSS58(aliceSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, 10_000_000_000_000n);
    const sigHex = '0x' + 'aa'.repeat(64);

    // Mode 0: Disabled
    const exDisabled = constructSignedExtrinsic({
      signerPublicKey: signer,
      signatureHex: sigHex,
      nonce: 0,
      callData,
      metadataHashMode: 0
    });

    // Mode 1: Enabled
    const exEnabled = constructSignedExtrinsic({
      signerPublicKey: signer,
      signatureHex: sigHex,
      nonce: 0,
      callData,
      metadataHashMode: 1
    });

    // Offset for Mode byte:
    // Prefix (2) + Version (1) + MultiAddress (33) + Signature (65) + Era (1) + Nonce (1) + Tip (1) + AssetId (1) = 105
    expect(exDisabled[105]).toBe(0x00);
    expect(exEnabled[105]).toBe(0x01);
  });

  it('rejects malformed signature responses from wallet extension', () => {
    const signer = decodeSS58(referenceSS58, 42).publicKey;
    const recipient = decodeSS58(aliceSS58, 42).publicKey;
    const callData = encodeTransferKeepAliveCall(recipient, 10_000_000_000_000n);

    // 32-byte signature (too short, expected 64)
    expect(() =>
      constructSignedExtrinsic({
        signerPublicKey: signer,
        signatureHex: '0x' + 'aa'.repeat(32),
        nonce: 0,
        callData
      })
    ).toThrow(/Invalid signature length: expected 64 or 65 bytes/);

    // Empty signature
    expect(() =>
      constructSignedExtrinsic({
        signerPublicKey: signer,
        signatureHex: '0x',
        nonce: 0,
        callData
      })
    ).toThrow(/Invalid signature length/);
  });
});

describe('Substrate RPC Inclusion & Event Dispatch Direct Checks (SEC-01)', () => {
  let mockRpc: SubstrateRpcClient;

  beforeEach(() => {
    mockRpc = new SubstrateRpcClient();
  });

  it('waitForExtrinsicInclusion locates target extrinsic in block extrinsics array [Mocked RPC]', async () => {
    const dummyExtrinsicHex = '0x280503000b4049a588a101';
    const targetHash = computeExtrinsicHash(dummyExtrinsicHex);

    vi.spyOn(mockRpc as any, 'query').mockImplementation((...args: any[]) => {
      const method = args[0];
      if (method === 'chain_getFinalizedHead') {
        return Promise.resolve({ result: '0xfinalizedblockhash123' });
      }
      return Promise.resolve(null);
    });

    vi.spyOn(mockRpc, 'getBlock').mockResolvedValue({
      block: {
        header: { number: '0x3a98', parentHash: '0xparent' }, // 15000 in dec
        extrinsics: [
          '0xunrelated0',
          dummyExtrinsicHex, // Index 1!
          '0xunrelated2'
        ]
      }
    });

    const result = await mockRpc.waitForExtrinsicInclusion(
      targetHash,
      dummyExtrinsicHex,
      5000
    );

    expect(result.blockHash).toBe('0xfinalizedblockhash123');
    expect(result.blockNumber).toBe(15000);
    expect(result.extrinsicIndex).toBe(1);
  });

  it('waitForExtrinsicInclusion throws timeout when extrinsic is missing from finalized blocks [Mocked RPC]', async () => {
    vi.spyOn(mockRpc as any, 'query').mockImplementation((...args: any[]) => {
      const method = args[0];
      if (method === 'chain_getFinalizedHead') {
        return Promise.resolve({ result: '0xemptyblock' });
      }
      return Promise.resolve(null);
    });

    vi.spyOn(mockRpc, 'getBlock').mockResolvedValue({
      block: {
        header: { number: '0x01', parentHash: '0xparent' },
        extrinsics: ['0xother1', '0xother2']
      }
    });

    await expect(
      mockRpc.waitForExtrinsicInclusion('0xnonexistenthash', '0xnonexistenthex', 100)
    ).rejects.toThrow(/Extrinsic inclusion timed out/);
  });

  it('handles multi-block finality leap and locates extrinsic in an intermediate block [Finding 3]', async () => {
    const targetExtrinsicHex = '0x490284001111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee01bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0014000000060300d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d0b00407a10f35a';
    const targetHash = computeExtrinsicHash(targetExtrinsicHex);

    let pollCount = 0;
    vi.spyOn(mockRpc as any, 'query').mockImplementation((...args: any[]) => {
      const method = args[0];
      if (method === 'chain_getFinalizedHead') {
        pollCount++;
        // Poll 1: Block 100
        // Poll 2: Finality leaps to Block 104!
        return Promise.resolve({ result: pollCount === 1 ? '0xfin100' : '0xfin104' });
      }
      return Promise.resolve(null);
    });

    vi.spyOn(mockRpc, 'getBlockHash').mockImplementation(async (height: number) => {
      return `0xhash_block_${height}`;
    });

    vi.spyOn(mockRpc, 'getBlock').mockImplementation(async (hash?: string) => {
      if (hash === '0xfin100' || hash === '0xhash_block_100') {
        return { block: { header: { number: '0x64', parentHash: '0xparent99' }, extrinsics: ['0xother100'] } }; // 100
      }
      if (hash === '0xhash_block_101') {
        return { block: { header: { number: '0x65', parentHash: '0xfin100' }, extrinsics: ['0xother101'] } }; // 101
      }
      if (hash === '0xhash_block_102') {
        // Target extrinsic is in intermediate block 102 at index 1!
        return { block: { header: { number: '0x66', parentHash: '0xhash101' }, extrinsics: ['0xother102', targetExtrinsicHex] } }; // 102
      }
      if (hash === '0xhash_block_103') {
        return { block: { header: { number: '0x67', parentHash: '0xhash102' }, extrinsics: ['0xother103'] } }; // 103
      }
      if (hash === '0xfin104' || hash === '0xhash_block_104') {
        return { block: { header: { number: '0x68', parentHash: '0xhash103' }, extrinsics: ['0xother104'] } }; // 104
      }
      return null;
    });

    const result = await mockRpc.waitForExtrinsicInclusion(targetHash, targetExtrinsicHex, 5000, undefined, 10);
    expect(result.blockHash).toBe('0xhash_block_102');
    expect(result.blockNumber).toBe(102);
    expect(result.extrinsicIndex).toBe(1);
  });

  it('recovers from transient RPC failure during intermediate block inspection without skipping blocks [Finding 3]', async () => {
    const targetExtrinsicHex = '0x490284001111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee01bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0014000000060300d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d0b00407a10f35a';
    const targetHash = computeExtrinsicHash(targetExtrinsicHex);

    let pollCount = 0;
    let getBlockAttempts = 0;
    vi.spyOn(mockRpc as any, 'query').mockImplementation((...args: any[]) => {
      const method = args[0];
      if (method === 'chain_getFinalizedHead') {
        pollCount++;
        // Poll 1: Block 200
        // Subsequent polls: Finality leaped to Block 202
        return Promise.resolve({ result: pollCount === 1 ? '0xfin200' : '0xfin202' });
      }
      return Promise.resolve(null);
    });

    vi.spyOn(mockRpc, 'getBlockHash').mockImplementation(async (height: number) => {
      return `0xhash_${height}`;
    });

    vi.spyOn(mockRpc, 'getBlock').mockImplementation(async (hash?: string) => {
      if (hash === '0xfin200' || hash === '0xhash_200') {
        return { block: { header: { number: '0xc8', parentHash: '0xhash199' }, extrinsics: ['0xother200'] } }; // 200
      }
      if (hash === '0xfin202' || hash === '0xhash_202') {
        return { block: { header: { number: '0xca', parentHash: '0xhash201' }, extrinsics: ['0xother202'] } }; // 202
      }
      if (hash === '0xhash_201') {
        getBlockAttempts++;
        if (getBlockAttempts === 1) {
          // Transient failure on first attempt: returns null
          return null;
        }
        // Second attempt succeeds and contains target extrinsic
        return { block: { header: { number: '0xc9', parentHash: '0xhash200' }, extrinsics: [targetExtrinsicHex] } }; // 201
      }
      return null;
    });

    const result = await mockRpc.waitForExtrinsicInclusion(targetHash, targetExtrinsicHex, 5000, undefined, 10);
    expect(result.blockHash).toBe('0xhash_201');
    expect(result.blockNumber).toBe(201);
    expect(result.extrinsicIndex).toBe(0);
    expect(getBlockAttempts).toBe(2);
  });

  it('verifyDispatchSuccess queries System.Events storage and decodes outcome [Mocked RPC]', async () => {
    // Mock getStorage for System.Events key
    const successEvents = '0x04000000000000002290753e5517020000';
    vi.spyOn(mockRpc, 'getStorage').mockResolvedValue(successEvents);

    const verification = await mockRpc.verifyDispatchSuccess('0xfinalizedblock', 0);
    expect(verification.success).toBe(true);
    expect(verification.eventName).toBe('System.ExtrinsicSuccess');
  });
});

describe('Architecture A Activation & Storage Collateral Warning (SEC-03, SEC-04)', () => {
  let deploymentService: DeploymentService;
  let mockRpc: EvmRpcClient;
  let mockWallet: EvmWalletService;

  beforeEach(() => {
    mockRpc = new EvmRpcClient();
    mockWallet = new EvmWalletService();
    deploymentService = new DeploymentService(mockRpc, mockWallet);
  });

  it('activates Architecture A contracts after bytecode verification and preserves BUILTIN_DEPLOYMENT (SEC-03)', async () => {
    const customUsdc = '0x1111111111111111111111111111111111111111';
    const customAmm = '0x2222222222222222222222222222222222222222';

    // Mock RPC queries for chainId and eth_getCode
    vi.spyOn(mockRpc, 'query').mockImplementation(async (method: string) => {
      if (method === 'eth_chainId') return { result: '0x190f1ca9' }; // 420420777
      if (method === 'eth_getCode') return { result: '0x608060405234801561001057600080fd5b50' }; // Non-empty code
      return { result: null };
    });

    const activateRes = await deploymentService.activateCustomArchA({
      pusdcAddress: customUsdc,
      ammAddress: customAmm,
      pusdcTxHash: '0xtx1',
      ammTxHash: '0xtx2'
    });

    expect(activateRes.success).toBe(true);
    expect(deploymentService.getActiveRegistryMode()).toBe('custom');

    // Active registry points to custom
    expect(CONTRACT_REGISTRY.testUSDC.deployedAddress).toBe(customUsdc);
    expect(CONTRACT_REGISTRY.nexusAMM.deployedAddress).toBe(customAmm);

    // Built-in canonical deployment constants remain intact and preserved
    expect(BUILTIN_DEPLOYMENT.pusdcAddress).toBe('0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002');
    expect(BUILTIN_DEPLOYMENT.ammAddress).toBe('0x407A2609dfd5336a38D6274B1EFc1804930f160A');

    // Deactivate custom deployment and verify rollback
    deploymentService.deactivateCustomDeployment();
    expect(deploymentService.getActiveRegistryMode()).toBe('builtin');
    expect(CONTRACT_REGISTRY.testUSDC.deployedAddress).toBe(BUILTIN_DEPLOYMENT.pusdcAddress);
    expect(CONTRACT_REGISTRY.nexusAMM.deployedAddress).toBe(BUILTIN_DEPLOYMENT.ammAddress);
  });

  it('rejects activation if deployed bytecode is empty on-chain', async () => {
    vi.spyOn(mockRpc, 'query').mockImplementation(async (method: string) => {
      if (method === 'eth_chainId') return { result: '0x190f1ca9' };
      if (method === 'eth_getCode') return { result: '0x' }; // Empty code!
      return { result: null };
    });

    const activateRes = await deploymentService.activateCustomArchA({
      pusdcAddress: '0x1111111111111111111111111111111111111111',
      ammAddress: '0x2222222222222222222222222222222222222222'
    });

    expect(activateRes.success).toBe(false);
    expect(activateRes.error).toContain('No deployed bytecode found on-chain');
    expect(deploymentService.getActiveRegistryMode()).toBe('builtin');
  });
});
