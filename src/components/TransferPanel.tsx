import React, { useState } from 'react';
import { EvmWalletService, EvmWalletState, PORTALDOT_EXPLORER_URL } from '../services/evmWallet';
import { SubstrateWalletService, SubstrateWalletState } from '../services/substrateWallet';
import { LIVE_DEPLOYMENT } from '../contracts/config';
import { SELECTORS, encodeCall, isAddress } from '../contracts/abi';
import { parseTokenAmount, formatTokenAmount } from '../services/contractMath';
import { globalTxService } from '../services/transactionService';
import { SendIcon, AlertIcon, CheckIcon, ExternalLinkIcon, RefreshIcon } from './Icons';

interface Props {
  evmWallet: EvmWalletService;
  evmWalletState: EvmWalletState;
  substrateWallet: SubstrateWalletService;
  substrateWalletState: SubstrateWalletState;
  pusdcBalance: bigint | null;
  onRefreshBalances: () => void;
}

type TransferMode = 'evm_pot' | 'evm_pusdc' | 'substrate_pot';

export const TransferPanel: React.FC<Props> = ({
  evmWallet,
  evmWalletState,
  substrateWallet,
  substrateWalletState,
  pusdcBalance,
  onRefreshBalances
}) => {
  const [mode, setMode] = useState<TransferMode>('evm_pusdc');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isEvmConnected = evmWalletState.isConnected && !!evmWalletState.address;
  const isCorrectNetwork = evmWalletState.isCorrectNetwork;
  const isSubstrateConnected = substrateWalletState.isConnected && !!substrateWalletState.selectedAccount;

  const handleTransfer = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTxHash(null);
    setStatusMsg(null);

    const cleanRecipient = recipient.trim();
    const cleanAmount = amount.trim();

    if (!cleanRecipient) {
      setErrorMsg('Please enter a destination recipient address.');
      return;
    }
    if (!cleanAmount || parseFloat(cleanAmount) <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    if (mode === 'evm_pot' || mode === 'evm_pusdc') {
      if (!isEvmConnected) {
        setErrorMsg('Please connect your EVM wallet first.');
        return;
      }
      if (!isCorrectNetwork) {
        setErrorMsg('Please switch to Portaldot V3 Testnet (Chain ID 420420777).');
        return;
      }
      if (!isAddress(cleanRecipient)) {
        setErrorMsg('Invalid EVM address format. Must be a 20-byte 0x... address.');
        return;
      }

      setIsSubmitting(true);
      try {
        if (mode === 'evm_pusdc') {
          const parsed = parseTokenAmount(cleanAmount, 6);
          if (pusdcBalance !== null && parsed > pusdcBalance) {
            throw new Error(`Insufficient pUSDC balance (${formatTokenAmount(pusdcBalance, 6, 2)} pUSDC).`);
          }

          setStatusMsg('Prompting wallet to authorize pUSDC transfer...');
          const preparedTx = {
            label: `Transfer ${cleanAmount} pUSDC to ${cleanRecipient.slice(0, 6)}…${cleanRecipient.slice(-4)}`,
            to: LIVE_DEPLOYMENT.pusdcAddress,
            data: encodeCall(SELECTORS.transfer, [
              { t: 'address', v: cleanRecipient },
              { t: 'uint', v: parsed }
            ]),
            value: 0n,
            valueHex: '0x0'
          };

          const res = await globalTxService.executeEvmTx('tokenTransfer', preparedTx, evmWallet);
          setTxHash(res.txHash || null);
          setSuccessMsg(`Successfully transferred ${cleanAmount} pUSDC on-chain!`);
        } else {
          // Native EVM POT transfer
          const parsedWei = parseTokenAmount(cleanAmount, 18);
          const currentBalWei = evmWalletState.balanceWei ? BigInt(evmWalletState.balanceWei) : 0n;
          if (parsedWei > currentBalWei) {
            throw new Error(`Insufficient POT balance (${evmWalletState.balancePot ?? '0'} POT).`);
          }

          setStatusMsg('Prompting wallet to authorize Native POT transfer...');
          const preparedTx = {
            label: `Transfer ${cleanAmount} POT to ${cleanRecipient.slice(0, 6)}…${cleanRecipient.slice(-4)}`,
            to: cleanRecipient,
            data: '0x',
            value: parsedWei,
            valueHex: '0x' + parsedWei.toString(16)
          };

          const res = await globalTxService.executeEvmTx('nativeEvmTransfer', preparedTx, evmWallet);
          setTxHash(res.txHash || null);
          setSuccessMsg(`Successfully sent ${cleanAmount} POT on-chain!`);
        }

        setAmount('');
        onRefreshBalances();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Transfer failed.');
      } finally {
        setIsSubmitting(false);
        setStatusMsg(null);
      }
    } else {
      // Substrate Native Transfer
      if (!isSubstrateConnected) {
        setErrorMsg('Please connect your Substrate wallet extension first.');
        return;
      }
      if (!cleanRecipient.startsWith('5')) {
        setErrorMsg('Invalid Substrate address. Must be a valid SS58 address starting with 5 (Prefix 42).');
        return;
      }

      setIsSubmitting(true);
      setStatusMsg('Signing Substrate native transfer payload...');
      try {
        const payload = `transfer:${cleanRecipient}:${cleanAmount}:POT:${Date.now()}`;
        const sig = await substrateWallet.signRaw(payload);
        setSuccessMsg(`Substrate transfer authorized and signed! Signature: ${sig.slice(0, 16)}…`);
        setAmount('');
        onRefreshBalances();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Substrate transfer failed.');
      } finally {
        setIsSubmitting(false);
        setStatusMsg(null);
      }
    }
  };

  const handleClaimFaucet = async () => {
    if (!isEvmConnected || !evmWalletState.address || !isCorrectNetwork) {
      setErrorMsg('Connect EVM wallet on Portaldot V3 to claim testnet pUSDC.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    setStatusMsg('Prompting wallet for 10,000 pUSDC faucet claim...');

    try {
      const callData = encodeCall(SELECTORS.faucetMint, [
        { t: 'address', v: evmWalletState.address },
        { t: 'uint', v: 10000_000000n }
      ]);
      const res = await globalTxService.executeEvmTx('faucetClaim', {
        label: 'Claim 10,000 pUSDC Faucet',
        to: LIVE_DEPLOYMENT.pusdcAddress,
        data: callData,
        value: 0n,
        valueHex: '0x0'
      }, evmWallet);

      setTxHash(res.txHash || null);
      setSuccessMsg('Successfully claimed 10,000 pUSDC test tokens!');
      onRefreshBalances();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Faucet claim failed.');
    } finally {
      setIsSubmitting(false);
      setStatusMsg(null);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5">
      {/* Mode Selector */}
      <div className="flex border-b border-white/10 pb-3 gap-2">
        <button
          onClick={() => setMode('evm_pusdc')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold mono transition ${
            mode === 'evm_pusdc'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          EVM: pUSDC Token
        </button>
        <button
          onClick={() => setMode('evm_pot')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold mono transition ${
            mode === 'evm_pot'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          EVM: Native POT
        </button>
        <button
          onClick={() => setMode('substrate_pot')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold mono transition ${
            mode === 'substrate_pot'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Substrate: Native tPOT
        </button>
      </div>

      {/* Balance Summary Header */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs mono">
        <div>
          <span className="text-slate-400">Available Balance: </span>
          {mode === 'evm_pusdc' && (
            <span className="text-cyan-300 font-bold">
              {pusdcBalance !== null ? `${formatTokenAmount(pusdcBalance, 6, 2)} pUSDC` : (isEvmConnected ? '0.00 pUSDC' : 'Connect wallet')}
            </span>
          )}
          {mode === 'evm_pot' && (
            <span className="text-emerald-400 font-bold">
              {evmWalletState.balancePot !== null ? `${evmWalletState.balancePot} POT` : (isEvmConnected ? '0.00 POT' : 'Connect wallet')}
            </span>
          )}
          {mode === 'substrate_pot' && (
            <span className="text-purple-300 font-bold">
              {substrateWalletState.balanceFormatted ?? (isSubstrateConnected ? '0.00 tPOT' : 'Connect extension')}
            </span>
          )}
        </div>
        <button
          onClick={onRefreshBalances}
          className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
          title="Refresh live on-chain balance"
        >
          <RefreshIcon className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Testnet Faucet Banner for pUSDC */}
      {mode === 'evm_pusdc' && (
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-cyan-200">Need Testnet Stablecoins?</p>
            <p className="text-[11px] text-slate-400">Claim 10,000 pUSDC simulation tokens directly from the verified contract faucet.</p>
          </div>
          <button
            type="button"
            id="btn-claim-faucet"
            disabled={isSubmitting || !isEvmConnected || !isCorrectNetwork}
            onClick={handleClaimFaucet}
            className="px-3 py-1.5 rounded-lg text-xs font-bold mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Claim 10,000 pUSDC
          </button>
        </div>
      )}

      {/* Recipient Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400 mono">
          {mode === 'substrate_pot' ? 'Recipient Substrate SS58 Address (Prefix 42)' : 'Recipient EVM Address (0x...)'}
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={mode === 'substrate_pot' ? '5...' : '0x...'}
          className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs mono text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Amount Input */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400 mono">
          Amount to Send ({mode === 'evm_pusdc' ? 'pUSDC' : 'POT'})
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-lg font-bold mono text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={() => {
              if (mode === 'evm_pusdc' && pusdcBalance !== null) {
                setAmount(formatTokenAmount(pusdcBalance, 6, 2));
              } else if (mode === 'evm_pot' && evmWalletState.balancePot) {
                setAmount(evmWalletState.balancePot);
              }
            }}
            className="absolute right-3 top-3 text-[10px] mono px-2 py-1 rounded bg-white/10 text-cyan-300 hover:bg-white/20"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Status & Error Feedback */}
      {statusMsg && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs mono text-cyan-300 flex items-center gap-2">
          <RefreshIcon className="w-4 h-4 animate-spin" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs mono text-rose-300 flex items-center gap-2">
          <AlertIcon className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs mono text-emerald-300 space-y-1">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          {txHash && (
            <div className="pt-1 text-[11px] text-slate-300 flex items-center gap-2">
              <span>Tx: <code className="text-white">{txHash.slice(0, 10)}…{txHash.slice(-8)}</code></span>
              <a
                href={`${PORTALDOT_EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-0.5"
              >
                Explorer <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleTransfer}
        disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl font-bold text-xs mono uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-600 text-black hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
      >
        <SendIcon className="w-4 h-4" />
        <span>{isSubmitting ? 'Authorizing in Wallet…' : 'Submit Transfer'}</span>
      </button>

      <p className="text-[10px] text-slate-400 text-center mono">
        Zero unattended signing &bull; Every transaction prompts your connected wallet confirmation dialog.
      </p>
    </div>
  );
};
