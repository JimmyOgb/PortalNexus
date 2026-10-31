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
import { SubstrateSignerPayloadJSON } from '../lib/substrateUtils';

export const SUBSTRATE_PREF_EXTENSION_KEY = 'portalnexus_preferred_sub_ext';
export const SUBSTRATE_PREF_ADDRESS_KEY = 'portalnexus_preferred_sub_addr';

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

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(SUBSTRATE_PREF_EXTENSION_KEY, targetExt);
          window.localStorage.setItem(SUBSTRATE_PREF_ADDRESS_KEY, primary.address);
        } catch {
          // Ignore storage errors
        }
      }

      // Bind accounts subscription if provider supports it for real-time account switching
      if (injectedInstance.accounts && typeof injectedInstance.accounts.subscribe === 'function') {
        try {
          injectedInstance.accounts.subscribe((newAccounts: any[]) => {
            if (!newAccounts || newAccounts.length === 0) {
              this.disconnect();
            } else {
              const updatedAccounts: InjectedAccount[] = newAccounts.map((a: any) => ({
                address: a.address,
                name: a.name || 'Account',
                source: targetExt
              }));
              const current = this.state.selectedAccount;
              const nextAccount = current
                ? updatedAccounts.find(a => a.address === current.address) || updatedAccounts[0]
                : updatedAccounts[0];

              this.updateState({
                accounts: updatedAccounts,
                selectedAccount: nextAccount
              });
              this.refreshBalance(nextAccount.address);
            }
          });
        } catch {
          // Ignore subscription setup errors
        }
      }

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
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(SUBSTRATE_PREF_ADDRESS_KEY, account.address);
      } catch {
        // Ignore storage errors
      }
    }
    this.refreshBalance(account.address);
  }

  /**
   * Safely attempts to restore an existing Substrate wallet authorization after page reload.
   * Only attempts connection if a preferred extension was previously authorized by the user.
   * If authorization is revoked, locked, or unavailable, cleanly resets to disconnected state.
   */
  public async autoReconnect(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    let savedExt: string | null = null;
    let savedAddress: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        savedExt = window.localStorage.getItem(SUBSTRATE_PREF_EXTENSION_KEY);
        savedAddress = window.localStorage.getItem(SUBSTRATE_PREF_ADDRESS_KEY);
      } catch {
        return false;
      }
    }

    if (!savedExt) return false;

    const injected = (window as any).injectedWeb3;
    if (!injected || typeof injected !== 'object' || !injected[savedExt]) {
      return false;
    }

    const provider = injected[savedExt];
    if (!provider || typeof provider.enable !== 'function') {
      return false;
    }

    try {
      const injectedInstance = await provider.enable('PortalNexus');
      this.injectedInstance = injectedInstance;
      this.signer = injectedInstance.signer || null;

      let accountsList: any[] = [];
      if (injectedInstance.accounts && typeof injectedInstance.accounts.get === 'function') {
        accountsList = await injectedInstance.accounts.get();
      }

      if (!accountsList || accountsList.length === 0) {
        this.disconnect();
        return false;
      }

      const formattedAccounts: InjectedAccount[] = accountsList.map((a: any) => ({
        address: a.address,
        name: a.name || 'Account',
        source: savedExt!
      }));

      const matchedAccount = savedAddress
        ? formattedAccounts.find(a => a.address === savedAddress) || formattedAccounts[0]
        : formattedAccounts[0];

      const available = Object.keys(injected);

      this.updateState({
        isConnected: true,
        selectedAccount: matchedAccount,
        accounts: formattedAccounts,
        availableExtensions: available,
        isConnecting: false,
        error: null
      });

      // Bind accounts subscription if provider supports it for real-time account switching
      if (injectedInstance.accounts && typeof injectedInstance.accounts.subscribe === 'function') {
        try {
          injectedInstance.accounts.subscribe((newAccounts: any[]) => {
            if (!newAccounts || newAccounts.length === 0) {
              this.disconnect();
            } else {
              const updatedAccounts: InjectedAccount[] = newAccounts.map((a: any) => ({
                address: a.address,
                name: a.name || 'Account',
                source: savedExt!
              }));
              const current = this.state.selectedAccount;
              const nextAccount = current
                ? updatedAccounts.find(a => a.address === current.address) || updatedAccounts[0]
                : updatedAccounts[0];

              this.updateState({
                accounts: updatedAccounts,
                selectedAccount: nextAccount
              });
              this.refreshBalance(nextAccount.address);
            }
          });
        } catch {
          // Ignore subscription setup errors
        }
      }

      await this.refreshBalance(matchedAccount.address);
      return true;
    } catch {
      // Permission revoked or wallet locked: clean up preference and fail closed
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(SUBSTRATE_PREF_EXTENSION_KEY);
          window.localStorage.removeItem(SUBSTRATE_PREF_ADDRESS_KEY);
        } catch {}
      }
      return false;
    }
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

  public getRpcClient(): SubstrateRpcClient | null {
    return this.substrateRpc;
  }

  /**
   * Returns true only if the connected wallet extension exposes the standard
   * extrinsic signer method `signPayload`.
   */
  public isExtrinsicSignerAvailable(): boolean {
    return Boolean(this.signer && typeof this.signer.signPayload === 'function');
  }

  /**
   * Prompts the connected Substrate wallet to sign a genuine extrinsic payload.
   */
  public async signPayload(payload: SubstrateSignerPayloadJSON): Promise<{ id: number; signature: string }> {
    if (!this.signer || typeof this.signer.signPayload !== 'function' || !this.state.selectedAccount) {
      throw new Error(
        'Connected Substrate wallet extension does not support extrinsic signing (signPayload unavailable). Genuine on-chain transfers are unavailable with this adapter.'
      );
    }

    try {
      const res = await this.signer.signPayload(payload);
      if (!res || !res.signature) {
        throw new Error('Wallet returned an empty signature for extrinsic payload.');
      }
      return { id: res.id ?? 1, signature: res.signature };
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('reject') || msg.includes('denied') || msg.includes('cancel') || err?.code === 4001) {
        throw new Error('Extrinsic signing request was rejected by user in Substrate wallet.');
      }
      throw new Error(err?.message || 'Failed to sign extrinsic payload with Substrate wallet.');
    }
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
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(SUBSTRATE_PREF_EXTENSION_KEY);
        window.localStorage.removeItem(SUBSTRATE_PREF_ADDRESS_KEY);
      } catch {
        // Ignore storage errors
      }
    }
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
