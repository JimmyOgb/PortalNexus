import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from '../src/services/transactionService';
import { EvmWalletService } from '../src/services/evmWallet';
import { PreparedTx } from '../src/services/ammService';

describe('TransactionService — User-Approved Transaction Manager', () => {
  let txService: TransactionService;
  let mockEvmWallet: EvmWalletService;

  const sampleTx: PreparedTx = {
    label: 'Mint 100 pUSDC',
    to: '0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002',
    data: '0xa5c51274...',
    value: 0n,
    valueHex: '0x0'
  };

  beforeEach(() => {
    txService = new TransactionService();
    mockEvmWallet = new EvmWalletService();
  });

  it('rejects execution if feature permission is not granted (e.g. Disconnected)', async () => {
    // Wallet is disconnected by default
    await expect(
      txService.executeEvmTx('faucetClaim', sampleTx, mockEvmWallet)
    ).rejects.toThrow(/Connect wallet to proceed/);
  });

  it('rejects cross-VM bridge execution as disabled by safety controls', async () => {
    // Mock connected state
    vi.spyOn(mockEvmWallet, 'getState').mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: '0x1111111111111111111111111111111111111111',
      chainId: 420420777,
      isCorrectNetwork: true,
      balancePot: '10.0',
      balanceWei: '10000000000000000000',
      error: null
    });

    await expect(
      txService.executeEvmTx('crossVmBridge', sampleTx, mockEvmWallet)
    ).rejects.toThrow(/Portaldot V3 testnet does not expose/);
  });

  it('successfully completes transaction lifecycle on user wallet approval', async () => {
    vi.spyOn(mockEvmWallet, 'getState').mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: '0x1111111111111111111111111111111111111111',
      chainId: 420420777,
      isCorrectNetwork: true,
      balancePot: '10.0',
      balanceWei: '10000000000000000000',
      error: null
    });

    const dummyTxHash = '0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';
    vi.spyOn(mockEvmWallet, 'sendTransaction').mockResolvedValue(dummyTxHash);
    vi.spyOn(mockEvmWallet, 'waitForReceipt').mockResolvedValue({
      transactionHash: dummyTxHash,
      status: '0x1',
      blockNumber: '0x3a4b',
      gasUsed: '0x5208'
    });

    const statesRecorded: string[] = [];
    txService.subscribe((active) => {
      if (active) statesRecorded.push(active.status);
    });

    const result = await txService.executeEvmTx('faucetClaim', sampleTx, mockEvmWallet);

    expect(result.status).toBe('CONFIRMED');
    expect(result.txHash).toBe(dummyTxHash);
    expect(result.blockNumber).toBe(14923);
    expect(result.gasUsed).toBe('21000');
    expect(txService.getHistory().length).toBe(1);
    expect(txService.getHistory()[0].txHash).toBe(dummyTxHash);
    expect(statesRecorded).toContain('PROMPTING_WALLET');
    expect(statesRecorded).toContain('SUBMITTING');
    expect(statesRecorded).toContain('MINING');
  });

  it('handles user rejection (EIP-1193 code 4001) cleanly', async () => {
    vi.spyOn(mockEvmWallet, 'getState').mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: '0x1111111111111111111111111111111111111111',
      chainId: 420420777,
      isCorrectNetwork: true,
      balancePot: '10.0',
      balanceWei: '10000000000000000000',
      error: null
    });

    const rejectionError = new Error('User rejected the request.');
    (rejectionError as any).code = 4001;
    vi.spyOn(mockEvmWallet, 'sendTransaction').mockRejectedValue(rejectionError);

    await expect(
      txService.executeEvmTx('faucetClaim', sampleTx, mockEvmWallet)
    ).rejects.toThrow(/User rejected the request/);

    expect(txService.getHistory().length).toBe(1);
    expect(txService.getHistory()[0].status).toBe('REJECTED');
  });

  it('marks transaction REVERTED if on-chain receipt status is 0x0', async () => {
    vi.spyOn(mockEvmWallet, 'getState').mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: '0x1111111111111111111111111111111111111111',
      chainId: 420420777,
      isCorrectNetwork: true,
      balancePot: '10.0',
      balanceWei: '10000000000000000000',
      error: null
    });

    const dummyTxHash = '0xreverted1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    vi.spyOn(mockEvmWallet, 'sendTransaction').mockResolvedValue(dummyTxHash);
    vi.spyOn(mockEvmWallet, 'waitForReceipt').mockResolvedValue({
      transactionHash: dummyTxHash,
      status: '0x0', // reverted
      blockNumber: '0x3a4c',
      gasUsed: '0x5208'
    });

    const result = await txService.executeEvmTx('faucetClaim', sampleTx, mockEvmWallet);

    expect(result.status).toBe('REVERTED');
    expect(result.error).toContain('Transaction reverted on-chain');
    expect(txService.getHistory().length).toBe(1);
    expect(txService.getHistory()[0].status).toBe('REVERTED');
  });
});
