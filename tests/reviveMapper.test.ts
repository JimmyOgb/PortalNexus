import { describe, it, expect } from 'vitest';
import { deriveReviveAccountId, encodeSS58Prefix42, REVIVE_MAPPING_TEST_VECTORS } from '../src/lib/reviveMapper';

describe('pallet-revive AccountId32Mapper & SS58 Derivation', () => {
  it('correctly pads 20-byte H160 with 12x 0xEE bytes for Revive AccountId32', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111';
    const result = deriveReviveAccountId(evmAddress);

    expect(result.isValidEvmAddress).toBe(true);
    expect(result.paddedAccountId32Hex).toBe('0x1111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee');
  });

  it('generates the byte-exact Portaldot SS58 prefix 42 address', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111';
    const result = deriveReviveAccountId(evmAddress);

    expect(result.ss58Prefix42Address).toBe('5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j');
    expect(result.ss58Prefix42Address?.startsWith('5')).toBe(true);
  });

  it('rejects and contrasts with Frontier/Moonbeam evmToAddress output', () => {
    const evmAddress = '0x1111111111111111111111111111111111111111';
    const result = deriveReviveAccountId(evmAddress);

    // Frontier evmToAddress hashes blake2_256("evm:" + addr) which produces 5DDYKUgyHe2Sx8a9oTZPAXrgFaTiGnYZXrecNdeC9bG7TbtX
    const legacyMoonbeamAddress = '5DDYKUgyHe2Sx8a9oTZPAXrgFaTiGnYZXrecNdeC9bG7TbtX';

    expect(result.ss58Prefix42Address).not.toBe(legacyMoonbeamAddress);
    expect(result.legacyMoonbeamMismatchWarning).toBe(true);
  });

  it('correctly handles address 0x0...0 (Genesis endowment address)', () => {
    const zeroEvm = '0x0000000000000000000000000000000000000000';
    const result = deriveReviveAccountId(zeroEvm);

    expect(result.isValidEvmAddress).toBe(true);
    expect(result.paddedAccountId32Hex).toBe('0x0000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeee');
    expect(result.ss58Prefix42Address).toBe('5C4hrfjw9DjXZTzV3MwzrrAr9P1MLDHajjSidz9bR544LEq1');
  });

  it('verifies all authoritative REVIVE_MAPPING_TEST_VECTORS', () => {
    expect(REVIVE_MAPPING_TEST_VECTORS.length).toBeGreaterThanOrEqual(4);
    for (const vector of REVIVE_MAPPING_TEST_VECTORS) {
      const result = deriveReviveAccountId(vector.evm);
      expect(result.isValidEvmAddress).toBe(true);
      expect(result.paddedAccountId32Hex?.toLowerCase()).toBe(vector.paddedHex.toLowerCase());
      expect(result.ss58Prefix42Address).toBe(vector.ss58);
      expect(result.isDeterministicDerivation).toBe(true);
      expect(result.isProofOfOwnership).toBe(false);
      expect(result.crossVmTransferSupported).toBe(false);
      expect(result.ownershipWarning).toContain('Does NOT establish account ownership');
    }
  });

  it('rejects invalid or malformed EVM addresses gracefully', () => {
    const shortAddr = deriveReviveAccountId('0x1234');
    expect(shortAddr.isValidEvmAddress).toBe(false);
    expect(shortAddr.paddedAccountId32Hex).toBeNull();
    expect(shortAddr.ss58Prefix42Address).toBeNull();

    const nonHexAddr = deriveReviveAccountId('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
    expect(nonHexAddr.isValidEvmAddress).toBe(false);
  });

  it('is case-insensitive for checksummed or uppercase EVM addresses', () => {
    const lower = deriveReviveAccountId('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    const upper = deriveReviveAccountId('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045');

    expect(lower.isValidEvmAddress).toBe(true);
    expect(upper.isValidEvmAddress).toBe(true);
    expect(lower.paddedAccountId32Hex).toBe(upper.paddedAccountId32Hex);
    expect(lower.ss58Prefix42Address).toBe(upper.ss58Prefix42Address);
  });

  it('throws when attempting to encode invalid byte length in encodeSS58Prefix42', () => {
    const wrongLength = new Uint8Array(20);
    expect(() => encodeSS58Prefix42(wrongLength)).toThrow(/must be exactly 32 bytes/);
  });
});
