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

export class EvmWalletService {
  private provider: EthereumProvider | null = null;
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

  constructor(customProvider?: EthereumProvider) {
    if (customProvider) {
      this.provider = customProvider;
    } else if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.provider = (window as any).ethereum;
    }
  }

  public setProvider(provider: EthereumProvider | null): void {
    this.provider = provider;
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
    if (!this.provider?.on) return;

    this.provider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        this.disconnect();
      } else {
        this.updateState({ address: accounts[0] });
        this.refreshBalance();
      }
    });

    this.provider.on('chainChanged', (chainIdHex: string) => {
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
    });
  }

  public async connect(): Promise<boolean> {
    if (!this.provider) {
      this.updateState({
        error: 'No EVM wallet detected. Install MetaMask or Rabby to connect.',
        isConnecting: false
      });
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
