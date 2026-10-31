/**
 * Independent Substrate SCALE Codec Reference Vectors for Portaldot V3.0
 *
 * PROVENANCE & SPECIFICATION:
 * - Reference Codec: scalecodec v1.2.12 (Official Polkascan Substrate SCALE Codec for Python)
 * - Hash Implementation: Python 3.12 standard library hashlib.blake2b (NIST-verified Blake2b-256)
 * - Target Chain: Portaldot V3.0 Testnet (https://test-node-v3.portaldot.dev)
 * - Runtime Spec Version: 3002
 * - Transaction Version: 2
 * - Genesis Hash: 0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd
 * - Live Node RPC Confirmation: Verified via read-only payment_queryInfo against test-node-v3.portaldot.dev
 *   returning: { weight: { ref_time: 656347000, proof_size: 12268 }, class: 'normal', partialFee: '1480459887916' }
 */

export const INDEPENDENT_SUBSTRATE_REFERENCE = {
  provenance: {
    tool: 'scalecodec v1.2.12 (Polkascan)',
    hashLibrary: 'Python 3.12 hashlib.blake2b',
    targetNetwork: 'Portaldot V3.0 Testnet',
    specVersion: 3002,
    transactionVersion: 2,
    genesisHash: '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd'
  },
  testAccounts: {
    alice: {
      addressSS58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      publicKeyHex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
    },
    signer: {
      addressSS58: '5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j',
      publicKeyHex: '0x1111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee'
    }
  },
  callData: {
    palletIndex: 6,
    callIndex: 3,
    recipientPublicKeyHex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
    amountUnits: 100_000_000_000_000n, // 1.0 tPOT (14 decimals)
    expectedCallDataHex: '0x060300d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d0b00407a10f35a',
    length: 42
  },
  signedExtra: {
    nonce: 5,
    tip: 0n,
    assetId: null,
    metadataHashMode: 0,
    // 6. CheckMortality (0x00 immortal)
    // 7. CheckNonce (0x14 = Compact(5))
    // 9. ChargeAssetTxPayment tip (0x00) + asset_id (0x00 Option::None)
    // 10. CheckMetadataHash (0x00 Mode::Disabled)
    expectedSignedExtraHex: '0x0014000000',
    length: 5
  },
  additionalSigned: {
    specVersion: 3002,
    transactionVersion: 2,
    genesisHash: '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd',
    isImmortal: true,
    // 3. CheckSpecVersion (ba0b0000)
    // 4. CheckTxVersion (02000000)
    // 5. CheckGenesis (32 bytes)
    // 6. CheckMortality: immortal era uses genesisHash (32 bytes)
    // 10. CheckMetadataHash Option::None (00)
    expectedAdditionalSignedHex:
      '0xba0b000002000000d4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bdd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd00',
    length: 73
  },
  signablePayload: {
    // CallData (42) + SignedExtra (5) + AdditionalSigned (73) = 120 bytes
    expectedSignablePayloadHex:
      '0x060300d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d0b00407a10f35a0014000000ba0b000002000000d4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bdd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd00',
    length: 120,
    // When <= 256 bytes, raw bytes are signed directly
    isHashedForSigning: false,
    expectedBlake2b256Hex: '0xbb210bc9666a2b337b79c4e4fde7d5f239a7005d63ff9b31a6444b99927058a0'
  },
  largeSignablePayload: {
    // When payload > 256 bytes (e.g. 390 bytes), signer hashes with Blake2b-256 before signing
    length: 390,
    isHashedForSigning: true,
    expectedBlake2b256Hex: '0x9c438339c6c0434f4530a5be87d256efa0e6f7ee2c2a4a4a347fe1ff0d27e364'
  },
  finalExtrinsic: {
    mockSignatureHex: '0x' + 'bb'.repeat(64),
    // Compact length (0x49 0x02 = 146 bytes body) + 0x84 + 0x00 + Signer + 0x01 + Sig + SignedExtra + CallData
    expectedExtrinsicHex:
      '0x490284001111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee01bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0014000000060300d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d0b00407a10f35a',
    length: 148,
    // Canonical extrinsic hash: blake2b256(finalExtrinsic)
    expectedExtrinsicHashHex: '0x0b3926496a7daaaba1d9c667921aefdd1c13095151106bbca93b30e31049db80'
  }
} as const;
