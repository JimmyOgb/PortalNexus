/**
 * PortalNexus — Substrate Real Balance Transfer Execution Engine
 *
 * Implements genuine on-chain native transfer dispatch on Portaldot V3 Testnet:
 * - Runtime metadata verified: Pallet Balances (Index 6), Call transfer_keep_alive (Index 3)
 * - Existential Deposit (ED): 0.1000 tPOT (10^13 units, 14 decimals)
 * - True recipient SS58 Prefix 42 decoding & checksum verification
 * - Wallet extension signPayload extrinsic authorization
 * - Concrete SCALE serialization and author_submitExtrinsic submission
 * - Block inclusion and finalization polling
 * - Dispatch verification (fails closed if dispatch fails)
 * - Mutex guard against duplicate submissions
 * - Zero signRaw or off-chain message stubs
 */

import { InjectedAccount, SubstrateWalletService } from './substrateWallet';
import { SubstrateRpcClient } from './substrateRpc';
import {
  PORTALDOT_SUBSTRATE_CONSTANTS,
  decodeSS58,
  parseSubstrateNativeUnits,
  formatSubstrateNativeUnits,
  encodeTransferKeepAliveCall,
  constructSignedExtrinsic,
  constructSignerPayload,
  bytesToHex,
  computeExtrinsicHash
} from '../lib/substrateUtils';

export interface SubstrateTransferParams {
  recipientSS58: string;
  amountStr: string;
  wallet: SubstrateWalletService;
  rpc: SubstrateRpcClient;
  onStatusUpdate?: (status: string) => void;
}

export interface SubstrateTransferResult {
  success: boolean;
  txHash: string;
  blockHash: string;
  finalizedBlockHash: string;
  blockNumber: number;
  extrinsicIndex?: number;
  recipient: string;
  amount: string;
  amountUnits: string;
  explorerUrl: string;
}

export class SubstrateTransferService {
  private isBusy: boolean = false;

  public getIsBusy(): boolean {
    return this.isBusy;
  }

  /**
   * Validates transfer inputs, recipient address, and existential deposit restrictions
   * before prompting the user's wallet.
   */
  public validateTransfer(
    recipientSS58: string,
    amountStr: string,
    senderAccount: InjectedAccount | null,
    currentBalanceRaw: string | null
  ): {
    isValid: boolean;
    error: string | null;
    recipientPubkey?: Uint8Array;
    amountUnits?: bigint;
    warning?: string;
  } {
    if (!senderAccount) {
      return { isValid: false, error: 'Substrate wallet is not connected. Connect an SS58 extension account first.' };
    }

    const cleanRecipient = recipientSS58.trim();
    if (!cleanRecipient) {
      return { isValid: false, error: 'Destination SS58 recipient address is required.' };
    }

    let decoded;
    try {
      decoded = decodeSS58(cleanRecipient, PORTALDOT_SUBSTRATE_CONSTANTS.ss58Prefix);
    } catch (err: any) {
      return { isValid: false, error: err?.message || 'Invalid Substrate recipient address format.' };
    }

    const cleanAmount = amountStr.trim();
    if (!cleanAmount || parseFloat(cleanAmount) <= 0) {
      return { isValid: false, error: 'Transfer amount must be a positive number greater than 0.' };
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseSubstrateNativeUnits(cleanAmount, PORTALDOT_SUBSTRATE_CONSTANTS.tokenDecimals);
    } catch (err: any) {
      return { isValid: false, error: err?.message || 'Invalid amount format.' };
    }

    if (amountUnits <= 0n) {
      return { isValid: false, error: 'Transfer amount must be greater than zero.' };
    }

    // Keep-alive and Existential Deposit checks
    let warning: string | undefined;
    if (currentBalanceRaw !== null) {
      const currentBalance = BigInt(currentBalanceRaw);
      const ed = PORTALDOT_SUBSTRATE_CONSTANTS.existentialDepositUnits;

      if (currentBalance < amountUnits) {
        return {
          isValid: false,
          error: `Insufficient tPOT balance. Available: ${formatSubstrateNativeUnits(currentBalance)}, Requested: ${formatSubstrateNativeUnits(amountUnits)}.`
        };
      }

      const balanceRemaining = currentBalance - amountUnits;
      if (balanceRemaining < ed) {
        return {
          isValid: false,
          error: `Transfer rejected by Keep-Alive safety guard: balances.transfer_keep_alive requires maintaining at least ${PORTALDOT_SUBSTRATE_CONSTANTS.existentialDepositFormatted} (Existential Deposit) in your account to prevent account reaping. Remaining balance would be ${formatSubstrateNativeUnits(balanceRemaining)}.`
        };
      }
    } else {
      warning = `Note: Existential deposit requirement is ${PORTALDOT_SUBSTRATE_CONSTANTS.existentialDepositFormatted}. Ensure your remaining balance stays above this threshold to keep your account active.`;
    }

    return {
      isValid: true,
      error: null,
      recipientPubkey: decoded.publicKey,
      amountUnits,
      warning
    };
  }

  /**
   * Executes a verified Substrate native transfer lifecycle:
   * 1. Validates inputs and wallet adapter capabilities
   * 2. Queries runtime state (genesis hash, spec version, account nonce)
   * 3. Assembles CallData for balances.transfer_keep_alive
   * 4. Prompts wallet extension for extrinsic signature (signPayload)
   * 5. Serializes signed extrinsic into standard SCALE format (V4)
   * 6. Submits extrinsic to Substrate node via RPC author_submitExtrinsic
   * 7. Polls for block inclusion and finalization
   * 8. Verifies dispatch success and returns finalized proof
   */
  public async executeTransfer(params: SubstrateTransferParams): Promise<SubstrateTransferResult> {
    if (this.isBusy) {
      throw new Error('A Substrate transfer is already in progress. Please wait for confirmation.');
    }

    const { recipientSS58, amountStr, wallet, rpc, onStatusUpdate } = params;
    const walletState = wallet.getState();
    const senderAccount = walletState.selectedAccount;

    // Step 1: Pre-flight validation
    const validation = this.validateTransfer(
      recipientSS58,
      amountStr,
      senderAccount,
      walletState.balanceRaw
    );

    if (!validation.isValid || !validation.recipientPubkey || !validation.amountUnits || !senderAccount) {
      throw new Error(validation.error || 'Pre-transfer validation failed.');
    }

    // Step 2: Adapter capability verification
    if (!wallet.isExtrinsicSignerAvailable()) {
      throw new Error(
        'Connected Substrate wallet extension does not support extrinsic signing (signPayload unavailable). Genuine on-chain transfers are unavailable with this adapter.'
      );
    }

    this.isBusy = true;
    try {
      onStatusUpdate?.('Fetching Substrate runtime metadata and nonce...');

      // Step 3: Fetch runtime metadata and nonce
      const [genesisHash, nonce, chainState] = await Promise.all([
        rpc.getGenesisHash(),
        rpc.getAccountNonce(senderAccount.address),
        Promise.resolve(rpc.getState())
      ]);

      const specVersion = chainState.specVersion ?? PORTALDOT_SUBSTRATE_CONSTANTS.specVersion;
      const transactionVersion = PORTALDOT_SUBSTRATE_CONSTANTS.transactionVersion;

      // Decode sender public key
      const senderDecoded = decodeSS58(senderAccount.address, PORTALDOT_SUBSTRATE_CONSTANTS.ss58Prefix);

      // Step 4: Construct call data for balances.transfer_keep_alive
      const callDataBytes = encodeTransferKeepAliveCall(
        validation.recipientPubkey,
        validation.amountUnits
      );
      const callDataHex = bytesToHex(callDataBytes);

      // Step 5: Construct SignerPayloadJSON conforming to Portaldot V3 runtime metadata
      // For immortal era ('0x00'), Substrate CheckMortality strictly requires genesisHash
      // as the mortality checkpoint in AdditionalSigned, and blockNumber must be 0.
      const signerPayload = constructSignerPayload({
        address: senderAccount.address,
        callDataHex,
        nonce,
        genesisHash,
        specVersion,
        transactionVersion,
        isImmortal: true
      });

      // Step 6: Request user wallet authorization
      onStatusUpdate?.('Prompting Substrate wallet to sign transfer extrinsic...');
      const signRes = await wallet.signPayload(signerPayload);
      const signatureHex = signRes.signature;

      // Step 7: Assemble complete SCALE-encoded signed extrinsic (Portaldot V3 12 SignedExtensions)
      onStatusUpdate?.('Constructing SCALE signed extrinsic and broadcasting to Substrate node...');
      const signedExtrinsicBytes = constructSignedExtrinsic({
        signerPublicKey: senderDecoded.publicKey,
        signatureHex,
        nonce,
        callData: callDataBytes,
        tip: 0n,
        assetId: null,
        metadataHashMode: 0
      });
      const extrinsicHex = bytesToHex(signedExtrinsicBytes);
      const expectedTxHash = computeExtrinsicHash(signedExtrinsicBytes);

      // Step 8: Submit extrinsic to node
      const submittedTxHash = await rpc.submitExtrinsic(extrinsicHex);
      const txHash = submittedTxHash || expectedTxHash;
      onStatusUpdate?.(`Extrinsic submitted: ${txHash.slice(0, 10)}… Waiting for inclusion in a finalized block...`);

      // Step 9: Poll for finalized block inclusion and match extrinsic hash & index
      const inclusion = await rpc.waitForExtrinsicInclusion(
        txHash,
        extrinsicHex,
        60000,
        onStatusUpdate
      );

      // Step 10: Verify dispatch result from System.Events at finalized block
      onStatusUpdate?.(`Verifying extrinsic dispatch status at block #${inclusion.blockNumber} (index ${inclusion.extrinsicIndex})...`);
      const dispatch = await rpc.verifyDispatchSuccess(inclusion.blockHash, inclusion.extrinsicIndex);
      if (!dispatch.success) {
        throw new Error(dispatch.error || 'Extrinsic dispatch failed on-chain.');
      }

      return {
        success: true,
        txHash,
        blockHash: inclusion.blockHash,
        finalizedBlockHash: inclusion.blockHash,
        blockNumber: inclusion.blockNumber,
        extrinsicIndex: inclusion.extrinsicIndex,
        recipient: recipientSS58,
        amount: amountStr,
        amountUnits: validation.amountUnits.toString(),
        explorerUrl: `https://node-console.portaldot.dev/#/explorer/query/${inclusion.blockHash}`
      };
    } finally {
      this.isBusy = false;
    }
  }
}

export const globalSubstrateTransferService = new SubstrateTransferService();
