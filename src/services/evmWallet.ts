/**
 * EVM Wallet Connector for Portaldot V3 Testnet
 *
 * Manages injected Ethereum provider (MetaMask, Rabby, etc.)
 * Strictly enforces Portaldot V3 EVM Testnet (Chain ID 420420777 / 0x190f1ca9)
 * Read-only state management with zero unauthorized transactions.
 */

export const PORTALDOT_CHAIN_ID_DEC = 420420777;
export const PORTALDOT_CHAIN_ID_HEX = '0x190f1ca9';
export const PORTALDOT_RPC_URL = 'https://test-evm-rpc-v3.portaldot.dev';
export const PORTALDOT_EXPLORER_URL = 'https://node-console.portaldot.dev/';
export const EVM_PREF_CONNECTED_KEY = 'portalnexus_evm_connected';

export interface EvmWalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  balanceWei: string | null;
  balancePot: string | null;
  error: string | null;
  isConnecting: boolean;
}

export interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on?(event: string, handler: (...args: any[]) => void): void;
  removeListener?(event: string, handler: (...args: any[]) => void): void;
}

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EthereumProvider;
}

export class EvmWalletService {
  private provider: EthereumProvider | null = null;
  private providerExplicitlySelected: boolean = false;
  private discoveredProviders: Map<string, EIP6963ProviderDetail> = new Map();
  private onAnnounceProviderBound: ((event: Event) => void) | null = null;
  private onEthereumInitializedBound: (() => void) | null = null;
  private accountsChangedHandler: ((accounts: string[]) => void) | null = null;
  private chainChangedHandler: ((chainIdHex: string) => void) | null = null;

  private state: EvmWalletState = {
    isConnected: false,
    address: null,
    chainId: null,
    isCorrectNetwork: false,
    balanceWei: null,
    balancePot: null,
    error: null,
    isConnecting: false,
  };
  private listeners: ((state: EvmWalletState) => void)[] = [];
  private listenersInitialized: boolean = false;

  constructor(customProvider?: EthereumProvider) {
    if (customProvider) {
      this.provider = customProvider;
      this.providerExplicitlySelected = true;
    }
    this.setupDiscoveryListeners();
    if (!this.provider) {
      this.discoverProvider();
    }
  }

  private setupDiscoveryListeners(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    this.onAnnounceProviderBound = (event: Event) => {
      const customEvent = event as CustomEvent<EIP6963ProviderDetail>;
      if (customEvent.detail && customEvent.detail.info && customEvent.detail.provider) {
        const { info, provider } = customEvent.detail;
        const key = info.rdns || info.uuid || info.name;
        this.discoveredProviders.set(key, { info, provider });
        if (!this.providerExplicitlySelected && !this.state.isConnected) {
          this.discoverProvider();
        }
      }
    };

    window.addEventListener('eip6963:announceProvider', this.onAnnounceProviderBound);

    this.onEthereumInitializedBound = () => {
      if (!this.providerExplicitlySelected && !this.state.isConnected) {
        this.discoverProvider();
      }
    };
    window.addEventListener('ethereum#initialized', this.onEthereumInitializedBound);

    this.requestProviders();
  }

  public requestProviders(): void {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new Event('eip6963:requestProvider'));
      } catch {
        // Ignore errors during dispatch in restrictive contexts
      }
    }
  }

  public getDiscoveredProviders(): EIP6963ProviderDetail[] {
    return Array.from(this.discoveredProviders.values());
  }

  public selectProvider(providerOrKey: EthereumProvider | string): void {
    if (typeof providerOrKey === 'string') {
      const found = this.discoveredProviders.get(providerOrKey);
      if (found) {
        this.setProvider(found.provider);
      } else {
        throw new Error(`Provider with key ${providerOrKey} not found.`);
      }
    } else {
      this.setProvider(providerOrKey);
    }
  }

  public discoverProvider(): EthereumProvider | null {
    if (this.provider && this.providerExplicitlySelected) return this.provider;

    const eipProviders = Array.from(this.discoveredProviders.values());
    if (eipProviders.length > 1) {
      this.provider = null;
      this.updateState({
        error: 'Multiple EVM wallet providers detected. Please select a wallet provider.',
        isConnecting: false
      });
      return null;
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      if (Array.isArray(eth.providers) && eth.providers.length > 1) {
        this.provider = null;
        this.updateState({
          error: 'Multiple EVM wallet providers detected in window.ethereum. Please select a wallet provider.',
          isConnecting: false
        });
        return null;
      }
    }

    if (eipProviders.length === 1) {
      this.provider = eipProviders[0].provider;
      return this.provider;
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.provider = (window as any).ethereum;
      return this.provider;
    }

    return null;
  }

  public setProvider(provider: EthereumProvider | null): void {
    this.cleanupListeners();
    this.provider = provider;
    this.providerExplicitlySelected = provider !== null;
  }

  public getState(): EvmWalletState {
    return { ...this.state };
  }

  public subscribe(listener: (state: EvmWalletState) => void): () => void {
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

  private updateState(partial: Partial<EvmWalletState>): void {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  public initListeners(): void {
    if (!this.provider?.on || this.listenersInitialized) return;
    this.listenersInitialized = true;

    this.accountsChangedHandler = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        this.disconnect();
      } else {
        this.updateState({ address: accounts[0] });
        this.refreshBalance();
      }
    };

    this.chainChangedHandler = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      const isCorrect = chainId === PORTALDOT_CHAIN_ID_DEC;
      this.updateState({
        chainId,
        isCorrectNetwork: isCorrect,
        error: isCorrect ? null : `Wrong network. Please switch to Portaldot V3 (${PORTALDOT_CHAIN_ID_DEC})`
      });
      if (this.state.address) {
        this.refreshBalance();
      }
    };

    this.provider.on('accountsChanged', this.accountsChangedHandler);
    this.provider.on('chainChanged', this.chainChangedHandler);
  }

  public cleanupListeners(): void {
    if (this.provider?.removeListener) {
      if (this.accountsChangedHandler) {
        try {
          this.provider.removeListener('accountsChanged', this.accountsChangedHandler);
        } catch {
          // Ignore removal errors
        }
        this.accountsChangedHandler = null;
      }
      if (this.chainChangedHandler) {
        try {
          this.provider.removeListener('chainChanged', this.chainChangedHandler);
        } catch {
          // Ignore removal errors
        }
        this.chainChangedHandler = null;
      }
    }
    this.listenersInitialized = false;
  }

  public destroy(): void {
    this.cleanupListeners();
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (this.onAnnounceProviderBound) {
        window.removeEventListener('eip6963:announceProvider', this.onAnnounceProviderBound);
        this.onAnnounceProviderBound = null;
      }
      if (this.onEthereumInitializedBound) {
        window.removeEventListener('ethereum#initialized', this.onEthereumInitializedBound);
        this.onEthereumInitializedBound = null;
      }
    }
    this.discoveredProviders.clear();
    this.listeners = [];
  }

  public async connect(): Promise<boolean> {
    if (!this.provider) {
      this.requestProviders();
      this.discoverProvider();
    }

    if (!this.provider) {
      if (!this.state.error) {
        this.updateState({
          error: 'No EVM wallet detected. Install MetaMask or Rabby to connect.',
          isConnecting: false
        });
      }
      return false;
    }

    this.updateState({ isConnecting: true, error: null });

    try {
      const accounts: string[] = await this.provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet.');
      }

      const chainIdHex: string = await this.provider.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      const isCorrect = chainId === PORTALDOT_CHAIN_ID_DEC;

      this.updateState({
        isConnected: true,
        address: accounts[0],
        chainId,
        isCorrectNetwork: isCorrect,
        isConnecting: false,
        error: isCorrect ? null : `Connected to Chain ID ${chainId}. Switch to Portaldot V3 (${PORTALDOT_CHAIN_ID_DEC})`
      });

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(EVM_PREF_CONNECTED_KEY, 'true');
        } catch {
          // Ignore storage quota or access errors
        }
      }

      this.initListeners();
      await this.refreshBalance();
      return true;
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect EVM wallet';
      this.updateState({
        isConnected: false,
        address: null,
        isConnecting: false,
        error: msg
      });
      return false;
    }
  }

  /**
   * Performs non-intrusive, passive EVM wallet discovery using eth_accounts.
   * Never triggers a wallet popup or prompts unauthorized accounts.
   */
  public async checkExistingConnection(): Promise<boolean> {
    if (!this.provider) {
      this.requestProviders();
      this.discoverProvider();
    }
    if (!this.provider) return false;

    let wasPreviouslyConnected = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        wasPreviouslyConnected = window.localStorage.getItem(EVM_PREF_CONNECTED_KEY) === 'true';
      } catch {
        wasPreviouslyConnected = false;
      }
    }

    try {
      const accounts: string[] = await this.provider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        if (wasPreviouslyConnected) {
          this.disconnect();
        }
        return false;
      }

      const chainIdHex: string = await this.provider.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      const isCorrect = chainId === PORTALDOT_CHAIN_ID_DEC;

      this.updateState({
        isConnected: true,
        address: accounts[0],
        chainId,
        isCorrectNetwork: isCorrect,
        isConnecting: false,
        error: isCorrect ? null : `Connected to Chain ID ${chainId}. Switch to Portaldot V3 (${PORTALDOT_CHAIN_ID_DEC})`
      });

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(EVM_PREF_CONNECTED_KEY, 'true');
        } catch {}
      }

      this.initListeners();
      await this.refreshBalance();
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to check existing wallet connection';
      console.warn('EVM wallet checkExistingConnection error:', err);
      if (wasPreviouslyConnected) {
        this.updateState({
          error: `Wallet reconnection failed: ${errMsg}`
        });
      }
      return false;
    }
  }

  public async switchOrAddNetwork(): Promise<boolean> {
    if (!this.provider) {
      this.updateState({ error: 'No EVM wallet provider available' });
      return false;
    }

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: PORTALDOT_CHAIN_ID_HEX }]
      });
      this.updateState({ isCorrectNetwork: true, chainId: PORTALDOT_CHAIN_ID_DEC, error: null });
      await this.refreshBalance();
      return true;
    } catch (switchError: any) {
      // 4902 error code indicates chain has not been added yet
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: PORTALDOT_CHAIN_ID_HEX,
              chainName: 'Portaldot V3 Testnet',
              nativeCurrency: { name: 'Portaldot', symbol: 'POT', decimals: 18 },
              rpcUrls: [PORTALDOT_RPC_URL],
              blockExplorerUrls: [PORTALDOT_EXPLORER_URL]
            }]
          });
          this.updateState({ isCorrectNetwork: true, chainId: PORTALDOT_CHAIN_ID_DEC, error: null });
          await this.refreshBalance();
          return true;
        } catch (addError: any) {
          this.updateState({ error: addError?.message || 'Failed to add Portaldot network' });
          return false;
        }
      }
      this.updateState({ error: switchError?.message || 'Failed to switch network' });
      return false;
    }
  }

  public async refreshBalance(): Promise<void> {
    if (!this.provider || !this.state.address) return;

    // Fail-safe: do not query or display foreign network balance as Portaldot POT
    if (!this.state.isCorrectNetwork) {
      this.updateState({ balanceWei: null, balancePot: null });
      return;
    }

    try {
      const balanceHex: string = await this.provider.request({
        method: 'eth_getBalance',
        params: [this.state.address, 'latest']
      });

      const balanceWei = BigInt(balanceHex).toString();
      const weiBig = BigInt(balanceHex);
      const whole = weiBig / 10n ** 18n;
      const fraction = (weiBig % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
      const balancePot = `${whole}.${fraction}`;

      this.updateState({ balanceWei, balancePot });
    } catch (err: any) {
      // Fail safely without throwing
      console.warn('Failed to query EVM balance:', err);
    }
  }

  public getProvider(): EthereumProvider | null {
    return this.provider;
  }

  /**
   * Prompts user wallet to sign and broadcast an EVM transaction.
   * Strictly enforces chain ID 420420777 before prompting.
   */
  public async sendTransaction(params: {
    to?: string;
    data?: string;
    value?: string;
    gas?: string;
  }): Promise<string> {
    if (!this.provider || !this.state.address) {
      throw new Error('EVM wallet not connected. Connect your wallet first.');
    }
    if (!this.state.isCorrectNetwork) {
      throw new Error(`Wrong network. Please switch to Portaldot V3 Testnet (${PORTALDOT_CHAIN_ID_DEC}) first.`);
    }

    const txPayload: any = {
      from: this.state.address,
    };
    if (params.to) txPayload.to = params.to;
    if (params.data) txPayload.data = params.data;
    if (params.value) txPayload.value = params.value;
    if (params.gas) txPayload.gas = params.gas;

    try {
      const txHash: string = await this.provider.request({
        method: 'eth_sendTransaction',
        params: [txPayload]
      });
      if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
        throw new Error('Wallet did not return a valid transaction hash.');
      }
      return txHash;
    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.toLowerCase().includes('reject') || err?.message?.toLowerCase().includes('denied')) {
        throw new Error('Transaction was rejected by user in wallet.');
      }
      throw new Error(err?.message || 'Transaction submission failed.');
    }
  }

  /**
   * Polls for transaction receipt on the Portaldot V3 network.
   */
  public async waitForReceipt(txHash: string, timeoutMs: number = 60000): Promise<{
    status: string;
    blockNumber: string;
    gasUsed: string;
    contractAddress?: string | null;
    transactionHash: string;
  }> {
    if (!this.provider) throw new Error('No provider available to poll receipt.');
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.provider.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash]
        });
        if (receipt) {
          return {
            status: receipt.status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            contractAddress: receipt.contractAddress ?? null,
            transactionHash: receipt.transactionHash || txHash
          };
        }
      } catch {
        // Ignore polling error, retry
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Transaction receipt polling timed out after ${timeoutMs / 1000}s for hash: ${txHash}`);
  }

  public disconnect(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(EVM_PREF_CONNECTED_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    this.updateState({
      isConnected: false,
      address: null,
      chainId: null,
      isCorrectNetwork: false,
      balanceWei: null,
      balancePot: null,
      error: null,
      isConnecting: false
    });
  }
}
