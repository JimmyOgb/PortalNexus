/**
 * Substrate Extension Wallet Connector for Portaldot V3 Testnet
 *
 * Interacts with standard Substrate injected extensions (window.injectedWeb3):
 * - polkadot-js
 * - talisman
 * - subwallet-js
 *
 * Reads real SS58 accounts and queries live balance from SubstrateRpcClient.
 */

import { SubstrateRpcClient } from './substrateRpc';

export interface InjectedAccount {
  address: string; // SS58 address
  name?: string;
  source: string;
}

export interface SubstrateWalletState {
  isConnected: boolean;
  selectedAccount: InjectedAccount | null;
  accounts: InjectedAccount[];
  availableExtensions: string[];
  balanceRaw: string | null;
  balanceFormatted: string | null;
  isConnecting: boolean;
  error: string | null;
}

export class SubstrateWalletService {
  private substrateRpc: SubstrateRpcClient | null = null;
  private injectedInstance: any = null;
  private signer: any = null;
  private state: SubstrateWalletState = {
    isConnected: false,
    selectedAccount: null,
    accounts: [],
    availableExtensions: [],
    balanceRaw: null,
    balanceFormatted: null,
    isConnecting: false,
    error: null,
  };
  private listeners: ((state: SubstrateWalletState) => void)[] = [];

  constructor(substrateRpc?: SubstrateRpcClient) {
    if (substrateRpc) {
      this.substrateRpc = substrateRpc;
    }
  }

  public setRpcClient(client: SubstrateRpcClient): void {
    this.substrateRpc = client;
  }

  public getState(): SubstrateWalletState {
    return { ...this.state };
  }

  public subscribe(listener: (state: SubstrateWalletState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(): void {
    const currentState = this.getState();
    this.listeners.forEach(l => l(currentState));
  }

  private updateState(partial: Partial<SubstrateWalletState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  public detectExtensions(): string[] {
    if (typeof window === 'undefined') return [];
    const injected = (window as any).injectedWeb3;
    if (!injected || typeof injected !== 'object') return [];
    const exts = Object.keys(injected);
    this.updateState({ availableExtensions: exts });
    return exts;
  }

  public async connect(extensionName?: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const injected = (window as any).injectedWeb3;
    if (!injected || typeof injected !== 'object') {
      this.updateState({
        error: 'No Substrate wallet extension detected (e.g. Polkadot{.js}, Talisman, SubWallet).',
        isConnecting: false
      });
      return false;
    }

    const available = Object.keys(injected);
    if (available.length === 0) {
      this.updateState({
        error: 'No Substrate extensions found in window.injectedWeb3.',
        isConnecting: false
      });
      return false;
    }

    const targetExt = extensionName || available[0];
    const provider = injected[targetExt];

    if (!provider || typeof provider.enable !== 'function') {
      this.updateState({
        error: `Extension "${targetExt}" does not support enable().`,
        isConnecting: false
      });
      return false;
    }

    this.updateState({ isConnecting: true, error: null });

    try {
      const injectedInstance = await provider.enable('PortalNexus');
      this.injectedInstance = injectedInstance;
      this.signer = injectedInstance.signer || null;
      const accountsList = await injectedInstance.accounts.get();

      if (!accountsList || accountsList.length === 0) {
        throw new Error(`Extension "${targetExt}" authorized, but returned 0 accounts. Please create or import an account in your wallet.`);
      }

      const formattedAccounts: InjectedAccount[] = accountsList.map((a: any) => ({
        address: a.address,
        name: a.name || 'Account',
        source: targetExt
      }));

      const primary = formattedAccounts[0];

      this.updateState({
        isConnected: true,
        selectedAccount: primary,
        accounts: formattedAccounts,
        availableExtensions: available,
        isConnecting: false,
        error: null
      });

      await this.refreshBalance(primary.address);
      return true;
    } catch (err: any) {
      this.updateState({
        isConnected: false,
        selectedAccount: null,
        accounts: [],
        isConnecting: false,
        error: err?.message || 'Failed to connect Substrate wallet'
      });
      return false;
    }
  }

  public selectAccount(account: InjectedAccount): void {
    this.updateState({ selectedAccount: account });
    this.refreshBalance(account.address);
  }

  public async refreshBalance(address?: string): Promise<void> {
    const targetAddress = address || this.state.selectedAccount?.address;
    if (!targetAddress || !this.substrateRpc) return;

    try {
      const balanceData = await this.substrateRpc.queryAccountBalance(targetAddress);
      if (balanceData) {
        this.updateState({
          balanceRaw: balanceData.free,
          balanceFormatted: balanceData.formatted
        });
      }
    } catch (err: any) {
      console.warn('Failed to query Substrate balance:', err);
    }
  }

  public getSigner(): any {
    return this.signer;
  }

  public getInjectedInstance(): any {
    return this.injectedInstance;
  }

  /**
   * Prompts connected Substrate wallet to sign a raw payload or message.
   */
  public async signRaw(data: string): Promise<string> {
    if (!this.signer || !this.signer.signRaw || !this.state.selectedAccount) {
      throw new Error('Substrate wallet signer unavailable. Connect a compatible extension first.');
    }
    try {
      const res = await this.signer.signRaw({
        address: this.state.selectedAccount.address,
        data,
        type: 'bytes'
      });
      return res.signature;
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('reject') || err?.message?.toLowerCase().includes('denied') || err?.code === 4001) {
        throw new Error('Signature request rejected by user in Substrate wallet.');
      }
      throw new Error(err?.message || 'Failed to sign payload with Substrate wallet.');
    }
  }

  public disconnect(): void {
    this.injectedInstance = null;
    this.signer = null;
    this.updateState({
      isConnected: false,
      selectedAccount: null,
      accounts: [],
      balanceRaw: null,
      balanceFormatted: null,
      isConnecting: false,
      error: null
    });
  }
}
