/**
 * PortalNexus — Real Transaction Execution & Lifecycle Service
 *
 * Coordinates user-approved on-chain transactions on Portaldot V3 Testnet:
 * - Pre-flight verification (network, balance, inputs)
 * - Explicit user wallet prompts (zero automated or silent signing)
 * - Real-time state tracking (Wallet Approval -> Submitting -> Mining -> Confirmed/Reverted)
 * - Accurate receipt verification via RPC
 * - Duplicate submission prevention
 */

import { EvmWalletService, PORTALDOT_EXPLORER_URL } from './evmWallet';
import { PreparedTx } from './ammService';
import { checkFeaturePermission, FeatureFlagsConfig } from './featureFlags';

export type TxLifecycleStatus =
  | 'IDLE'
  | 'VALIDATING'
  | 'PROMPTING_WALLET'
  | 'SUBMITTING'
  | 'MINING'
  | 'CONFIRMED'
  | 'REVERTED'
  | 'REJECTED'
  | 'ERROR';

export interface TrackedTransaction {
  id: string;
  label: string;
  status: TxLifecycleStatus;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  contractAddress?: string | null;
  error?: string | null;
  timestamp: number;
  explorerUrl?: string;
}

export class TransactionService {
  private activeTx: TrackedTransaction | null = null;
  private history: TrackedTransaction[] = [];
  private isBusy: boolean = false;
  private listeners: ((active: TrackedTransaction | null, history: TrackedTransaction[]) => void)[] = [];

  public getActiveTx(): TrackedTransaction | null {
    return this.activeTx ? { ...this.activeTx } : null;
  }

  public getHistory(): TrackedTransaction[] {
    return [...this.history];
  }

  public subscribe(listener: (active: TrackedTransaction | null, history: TrackedTransaction[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getActiveTx(), this.getHistory());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const active = this.getActiveTx();
    const hist = this.getHistory();
    this.listeners.forEach(l => l(active, hist));
  }

  private updateActive(partial: Partial<TrackedTransaction>): void {
    if (!this.activeTx) return;
    this.activeTx = { ...this.activeTx, ...partial };
    this.notify();
  }

  /**
   * Executes a user-approved EVM transaction through the connected wallet.
   * Prevents accidental duplicate submissions while an existing transaction is in-flight.
   */
  public async executeEvmTx(
    featureId: keyof FeatureFlagsConfig,
    tx: PreparedTx,
    evmWallet: EvmWalletService,
    context?: { hasLiquidity?: boolean }
  ): Promise<TrackedTransaction> {
    if (this.isBusy) {
      throw new Error('A transaction is already being processed. Please wait for confirmation.');
    }

    const walletState = evmWallet.getState();
    const perm = checkFeaturePermission(featureId, {
      isWalletConnected: walletState.isConnected,
      isCorrectNetwork: walletState.isCorrectNetwork,
      hasLiquidity: context?.hasLiquidity
    });

    if (!perm.allowed) {
      throw new Error(perm.reason || 'Operation not permitted by safety controls.');
    }

    this.isBusy = true;
    const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    this.activeTx = {
      id: txId,
      label: tx.label,
      status: 'VALIDATING',
      timestamp: Date.now()
    };
    this.notify();

    try {
      // Step 1: Prompt wallet for approval
      this.updateActive({ status: 'PROMPTING_WALLET' });

      const txParams: any = {
        to: tx.to,
        data: tx.data
      };
      if (tx.value > 0n) {
        txParams.value = tx.valueHex;
      }

      this.updateActive({ status: 'SUBMITTING' });
      const txHash = await evmWallet.sendTransaction(txParams);

      const explorerUrl = `${PORTALDOT_EXPLORER_URL}`;
      this.updateActive({
        status: 'MINING',
        txHash,
        explorerUrl
      });

      // Step 2: Poll receipt to verify on-chain finality
      const receipt = await evmWallet.waitForReceipt(txHash, 60000);

      const isSuccess = receipt.status === '0x1' || receipt.status === '1';
      const finalStatus: TxLifecycleStatus = isSuccess ? 'CONFIRMED' : 'REVERTED';
      const blockNumber = parseInt(receipt.blockNumber, 16);
      const gasUsed = parseInt(receipt.gasUsed, 16).toString();

      this.updateActive({
        status: finalStatus,
        blockNumber: isNaN(blockNumber) ? undefined : blockNumber,
        gasUsed,
        contractAddress: receipt.contractAddress,
        error: isSuccess ? null : 'Transaction reverted on-chain during execution.'
      });

      // Add to completed history
      const completed = { ...this.activeTx! };
      this.history.unshift(completed);
      this.isBusy = false;
      this.notify();

      // Refresh wallet balance post-tx
      await evmWallet.refreshBalance();
      return completed;
    } catch (err: any) {
      this.isBusy = false;
      const isRejection = err?.message?.toLowerCase().includes('reject') || err?.message?.toLowerCase().includes('denied');
      const failStatus: TxLifecycleStatus = isRejection ? 'REJECTED' : 'ERROR';

      this.updateActive({
        status: failStatus,
        error: err?.message || 'Transaction failed.'
      });

      const failed = { ...this.activeTx! };
      this.history.unshift(failed);
      this.notify();
      throw err;
    }
  }

  /**
   * Clears the current active transaction notice from UI after user dismissal.
   */
  public clearActive(): void {
    if (!this.isBusy) {
      this.activeTx = null;
      this.notify();
    }
  }
}

export const globalTxService = new TransactionService();
