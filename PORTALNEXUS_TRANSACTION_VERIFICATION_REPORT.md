# PortalNexus V3.0 — Real Transaction Verification Report

- **Date:** October 29, 2026
- **Workspace:** `C:\Users\NO GO NO\PortalNexus`
- **Network:** Portaldot V3.0 Testnet (EVM Chain ID: `420420777` / `0x190f1ca9`, Substrate WASM)
- **EVM JSON-RPC:** `https://test-evm-rpc-v3.portaldot.dev`
- **Substrate WebSocket:** `wss://test-node-v3.portaldot.dev`
- **Explorer:** `https://node-console.portaldot.dev/`
- **Production URL:** `https://portalnexus-two.vercel.app`

---

## 1. Overview & Transaction Integrity Standards

PortalNexus enforces a strict transaction integrity model across all user-initiated interactions on the Portaldot V3.0 testnet:

1. **Zero Unattended Broadcasting:** No contract or transaction is ever deployed or broadcast on page load, background timers, or automated routines.
2. **Zero Private Key Access:** PortalNexus never requests, stores, or accesses private keys or mnemonics. All signing occurs inside the user's injected wallet extension.
3. **Zero Simulated Confirmations:** Mined status is exclusively determined by querying transaction receipts (`eth_getTransactionReceipt`) on the live JSON-RPC. Reverts are accurately displayed.
4. **Anti-Duplication Guard:** An atomic in-flight mutex (`TransactionService.isBusy`) prevents duplicate submissions while an active transaction is being confirmed.

---

## 2. Granular Transaction Catalog & Verification Matrix

| # | Action | Target Contract / Pallet | Method & Parameters | Preflight Checks | Wallet Prompt | Mining & Receipt Verification |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Deploy TestUSDCMin** | New Contract | Constructor Bytecode (`TEST_USDC_MIN_BYTECODE`) | Chain `420420777`, POT balance > gas + storage deposit | Prompts wallet for creation transaction | Receipt verified; `eth_getCode` checks non-empty bytecode |
| **2** | **Deploy NexusAMMNative** | New Contract | Bytecode + `encodeAddress(usdcAddress)` | Chain `420420777`, valid USDC contract address | Prompts wallet for creation transaction | Receipt verified; contract code and `usdc()` queried |
| **3** | **Deploy WPotToken** | New Contract | Constructor Bytecode (`WPOT_BYTECODE`) | Chain `420420777`, balance check | Prompts wallet for creation transaction | Receipt verified; `name()` returns "Wrapped POT" |
| **4** | **Claim pUSDC Faucet** | `TestUSDCMin` (`0x6C3B...4002`) | `faucetMint(address to, uint256 amount)` | Amount > 0, amount $\le$ 10,000 pUSDC | Prompts wallet for contract execution | Mined block recorded; pUSDC balance refreshed |
| **5** | **Transfer pUSDC** | `TestUSDCMin` (`0x6C3B...4002`) | `transfer(address dst, uint256 wad)` | Valid H160 address, sender balance $\ge$ amount | Prompts wallet for contract execution | Receipt verified; sender & recipient balances updated |
| **6** | **Approve pUSDC** | `TestUSDCMin` (`0x6C3B...4002`) | `approve(address guy, uint256 wad)` | Spender = `0x407A...160A` (NexusAMM), wad > 0 | Prompts wallet for contract execution | Receipt verified; allowance updated on-chain |
| **7** | **Add Liquidity** | `NexusAMMNative` (`0x407A...160A`) | `addLiquidity(amountUSDC, minPOT, minUSDC, deadline)` with `msg.value` | pUSDC allowance $\ge$ amount, POT balance $\ge$ msg.value | Prompts wallet for payable transaction | Receipt verified; LP receipt NFT minted to user |
| **8** | **Remove Liquidity** | `NexusAMMNative` (`0x407A...160A`) | `removeLiquidity(tokenId, minPOT, minUSDC, recipient, deadline)` | Connected wallet owns `tokenId` | Prompts wallet for contract execution | Receipt verified; NFT burned; reserves returned |
| **9** | **Swap POT for pUSDC** | `NexusAMMNative` (`0x407A...160A`) | `swapExactPOTForTokens(minAmountOut, to, deadline)` with `msg.value` | Pool reserves > 0, POT balance $\ge$ input, slippage checked | Prompts wallet for payable transaction | Receipt verified; user balance updated; invariant $k$ grows |
| **10** | **Swap pUSDC for POT** | `NexusAMMNative` (`0x407A...160A`) | `swapExactTokensForPOT(amountIn, minAmountOut, to, deadline)` | Pool reserves > 0, allowance $\ge$ amountIn, balance $\ge$ amountIn | Prompts wallet for contract execution | Receipt verified; POT returned to user |
| **11** | **Native POT Transfer (EVM)** | Native EVM Runtime | Standard value transfer (`value: wei`, `data: 0x`) | Valid H160 recipient, sender balance $\ge$ amount + gas | Prompts wallet for native transfer | Receipt verified; native POT balance updated |
| **12** | **Native POT Transfer (Substrate)** | `pallet_balances` | `balances.transferKeepAlive(dest, value)` | Valid SS58 recipient (Prefix 42), balance > existential deposit | Prompts Substrate extension signer | Extrinsic finalized in Substrate block |
| **13** | **Cross-VM Bridge (Disabled)** | Runtime Boundary | *Disabled / Not Available on Client RPC* | Runtime requirement: No public client extrinsic | *Submission Disabled* | UI displays architectural limitation |

---

## 3. Transaction Lifecycle Management (`TransactionService`)

The transaction service manages each execution through an observable state machine:

```
[IDLE]
  │
  ▼
[VALIDATING] ──(Validation failed: wrong network, insufficient balance)──► [ERROR]
  │
  ▼
[PROMPTING_WALLET] ──(User rejected in MetaMask / Rabby, code 4001)──────► [REJECTED]
  │
  ▼
[SUBMITTING] (txHash broadcast to RPC)
  │
  ▼
[MINING] (Polling receipt with exponential backoff)
  │
  ├──────(Receipt status == 0x1)──────► [CONFIRMED]
  │
  └──────(Receipt status == 0x0)──────► [REVERTED]
```

### In-Flight Concurrency Control:
- When a transaction enters `VALIDATING`, `this.isBusy` is set to `true`.
- Any concurrent call to `executeEvmTx` throws:
  `"A transaction is already being processed. Please wait for confirmation."`
- `this.isBusy` is reset in a `finally` block once the receipt is polled or upon exception.

---

## 4. `pallet-revive` State Rent & Gas Dynamics

During live node testing on Portaldot V3 (`https://test-evm-rpc-v3.portaldot.dev`), gas estimation and execution costs reflect the Substrate `pallet-revive` state-rent model:

1. **Storage Deposit Bundling:**
   - Under `pallet-revive`, the EVM gas limit returned by `eth_estimateGas` includes both execution gas and the Substrate refundable storage deposit:
     $$\text{Gas Limit} = \text{Execution Gas} + \frac{\text{Storage Deposit (bytes + items)}}{\text{Gas Price}}$$
2. **First-Time Account Slots:**
   - Transferring pUSDC or claiming the faucet to an account that has never held tokens requires initializing a new storage slot in the contract trie ($\approx 3.92\text{ POT}$).
   - The UI preflight checks warn users if their native POT balance is close to zero, ensuring they maintain sufficient POT for both transaction execution and storage deposit allocation.

---

## 5. Live On-Chain Contract Verification

PortalNexus operates with the following verified contracts deployed on Portaldot V3 Testnet:

- **`TestUSDCMin`:**
  - Address: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`
  - Deployment Block: `#237279`
  - Code Size: 1,483 bytes
  - Verified Selectors: `0xa5c51274` (`faucetMint`), `0xa9059cbb` (`transfer`), `0x095ea7b3` (`approve`), `0x70a08231` (`balanceOf`), `0x18160ddd` (`totalSupply`)
- **`NexusAMMNative`:**
  - Address: `0x407A2609dfd5336a38D6274B1EFc1804930f160A`
  - Deployment Block: `#237284`
  - Code Size: 3,306 bytes
  - Verified Selectors: `0x0902f1ac` (`getReserves`), `0xaebf3e41` (`addLiquidity`), `0xed856cdc` (`removeLiquidity`), `0xe3c32a03` (`swapExactPOTForTokens`), `0x5b31b707` (`swapExactTokensForPOT`), `0xeb02c301` (`getPosition`), `0x6352211e` (`ownerOf`)
- **Node Console Explorer Verification:**
  - Block exploration link: `https://node-console.portaldot.dev/`
  - Verified deployer address: `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`
