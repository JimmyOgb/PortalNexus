# PortalNexus V3.0 — Real Wallet-Connected dApp Implementation Audit
**Phase A Audit Report**

- **Date:** October 29, 2026
- **Workspace:** `C:\Users\NO GO NO\PortalNexus`
- **Target Network:** Portaldot V3.0 Testnet (`Chain ID: 420420777`)
- **EVM JSON-RPC:** `https://test-evm-rpc-v3.portaldot.dev`
- **Substrate WebSocket:** `wss://test-node-v3.portaldot.dev`
- **Current Production URL:** `https://portalnexus-two.vercel.app`
- **Git Commit Baseline:** `99cfc02` (Clean working tree)

---

## 1. Executive Summary & Runtime Baseline

PortalNexus was launched as a dual-VM observability terminal, deterministic address-mapping calculator, and constant-product AMM preview for Portaldot V3.0 testnet. In its prior release (`99cfc02`), on-chain data reads, block-cadence synchronization, and contract queries were live, but write transactions were guarded by a global flag (`TX_SUBMISSION_ENABLED = false`).

This audit evaluates the live Portaldot V3.0 runtime capabilities, verifies on-chain contract bytecode, audits the `reviveMapper` algorithm, and establishes the blueprint for upgrading PortalNexus into a full, user-operated Web3 dApp with real wallet execution.

### Live Runtime Verification (Live Node Probe)
A live probe to `https://test-evm-rpc-v3.portaldot.dev` confirmed the active execution environment:
- **Client Version (`web3_clientVersion`):** `eth-rpc/main-fddd431/x86_64-unknown-linux-gnu/rustc1.98.0`
- **EVM Chain ID (`eth_chainId`):** `0x190f1ca9` (Decimal: `420420777`)
- **Current Block Height (`eth_blockNumber`):** `#239125+`
- **Gas Price (`eth_gasPrice`):** `0x6b6c` (27,500 wei / ~0.0000275 Gwei)
- **Deployed Contracts Status:**
  - `TestUSDCMin` at `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`: Code size 2,966 hex chars (1,483 bytes), verified on-chain at block `#237279`. Total supply: `0 pUSDC`.
  - `NexusAMMNative` at `0x407A2609dfd5336a38D6274B1EFc1804930f160A`: Code size 6,612 hex chars (3,306 bytes), verified on-chain at block `#237284`. Reserves: `(0 POT, 0 pUSDC)`.

---

## 2. Feature Capability & Readiness Matrix

| Feature Domain | Current State (`99cfc02`) | Desired Real dApp State | Runtime / Contract Feasibility | Implementation Plan |
| :--- | :--- | :--- | :--- | :--- |
| **EVM Wallet Connection** | Read-only balance check via `window.ethereum` | Interactive connect, account switch, network enforcement, signing provider | ✅ Supported by standard EIP-1193 | Expose `request({ method: 'eth_sendTransaction' })` with prompt handling, tx tracking, and rejection handling |
| **Substrate Wallet Connection** | Account discovery via `window.injectedWeb3` | Interactive account selection, balance reads, extrinsic signing | ✅ Supported by Polkadot{.js}, Talisman, SubWallet | Capture `injected.signer` and wire extrinsic submission with confirmation modals |
| **Contract Deployment** | Multi-step preflight in modal; mocked execution | Real user-authorized deployment via connected wallet | ✅ Supported via EVM bytecode submission | Support `TestUSDCMin`, `WPotToken`, and `NexusAMMNative`, estimate costs, send deployment tx, poll receipt, verify on-chain |
| **Testnet Token Faucet** | Generates calldata preview | Real `faucetMint(recipient, amount)` execution | ✅ Supported by `TestUSDCMin` (cap: 10,000 pUSDC/call) | Connect user wallet to execute real faucet claims directly to their address |
| **Token Transfer (pUSDC)** | Read balance only | Real `transfer(recipient, amount)` | ✅ Standard ERC-20 in `TestUSDCMin` | Input recipient & amount, balance check, prompt wallet, track receipt |
| **Token Approval (pUSDC)** | Preview exact allowance | Real `approve(spender, amount)` | ✅ Standard ERC-20 in `TestUSDCMin` | Exact amount approval for AMM router with allowance refresh |
| **AMM Liquidity Seeding** | Preview initial deposit (`0.5 POT + 10 pUSDC`) | Real `addLiquidity(minPot, minUsdc, deadline)` with msg.value | ✅ Supported by `NexusAMMNative` | Checks allowance, requests approval if needed, prompts payable tx, tracks LP receipt |
| **AMM Token Swapping** | Disabled when reserves are 0; calldata preview | Real swaps (`swapExactPOTForTokens` / `swapExactTokensForPOT`) | ⚠️ Requires non-zero pool liquidity | If pool is empty, UI blocks swap quotes and guides user to seed liquidity; if seeded, executes real swap |
| **Native POT Transfer (EVM)** | Read balance only | Real native POT transfer between EVM addresses | ✅ Standard EVM `eth_sendTransaction` | Native value transfer with fee estimation and destination verification |
| **Native POT Transfer (Substrate)** | Read balance only | Real native tPOT transfer between SS58 addresses | ✅ Standard Substrate `balances.transferKeepAlive` | Injected extension signer submits signed extrinsic to Substrate node |
| **Cross-VM Teleport (Bridge)** | Disabled with explanation | Remains disabled with detailed architectural notice | 🛑 Runtime limitation: No public single-step client bridge extrinsic | Retain honest fail-closed gate and technical documentation |

---

## 3. Cross-VM Account Mapping In-Depth Audit

### 3.1 Background & Algorithm
In Polkadot SDK's `pallet_revive`, the runtime maps between 20-byte EVM (`H160`) addresses and 32-byte Substrate (`AccountId32`) addresses.

There are two distinct mapping concepts:
1. **Deterministic Fallback (`AccountId32Mapper`):**
   $$\text{AccountId32} = \text{H160 (20 bytes)} \;\|\; [0x\text{EE}; 12]$$
   Encoded with Substrate SS58 Prefix `42` and a 2-byte Blake2b-512 checksum (`"SS58PRE"` prefix).
2. **Stateful Account Registration (`Revive::OriginalAccount`):**
   When an existing Substrate account registers with `pallet-revive`, its EVM address is derived as:
   $$\text{H160} = \text{keccak256}(\text{AccountId32})[12..32]$$

### 3.2 Key Safety Truths Required in Production
- **Derivation $\neq$ Ownership:** Calculating `deriveReviveAccountId(0x...)` generates the mathematical fallback `AccountId32`. It does **not** grant the EVM private key holder control over a Substrate account unless `pallet-revive`'s runtime rules or dual-key schemes are explicitly verified.
- **Legacy Frontier Trap:** Older Polkadot EVM chains (e.g. Moonbeam, Frontier) derived Substrate accounts via `blake2_256("evm:" + H160)`. Transferring funds to this legacy derived address on Portaldot V3 results in **permanent loss**.
- **Cross-VM Transfer Limitation:** An account mapping is **not** a transfer bridge. Merely knowing the mapped SS58 address does not mean a user can send tokens across VMs without an active runtime pallet call (e.g. `revive.call` or cross-pallet deposit).

### 3.3 Verified Test Vectors
| EVM Address (H160) | Padded AccountId32 (Hex) | Expected SS58 (Prefix 42) | Tested Status |
| :--- | :--- | :--- | :--- |
| `0x1111111111111111111111111111111111111111` | `0x1111111111111111111111111111111111111111eeeeeeeeeeeeeeeeeeeeeeee` | `5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j` | ✅ Verified in `tests/reviveMapper.test.ts` |
| `0x0000000000000000000000000000000000000000` | `0x0000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeee` | `5C4hrfjw9DjXZTzV3MwzrrAr9P1MLDHajjSidz9bR544LEq1` | ✅ Verified in `tests/reviveMapper.test.ts` |
| `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A` (Deployer) | `0xdc7f5c7813a5f0e3f51c2fe569de6c5577768a2aeeeeeeeeeeeeeeeeeeeeeeee` | `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu` | ✅ Verified against on-chain receipt |

---

## 4. Deployed Smart Contract Architecture & State Rent

### 4.1 Architecture A (Deployed on Testnet)
- **`TestUSDCMin.sol` (`0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`):**
  - Minimal state-rent optimized ERC-20 simulation token (6 decimals).
  - Contains public `faucetMint(address to, uint256 amount)` capped at 10,000 pUSDC per call.
  - Standard `transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`.
- **`NexusAMMNative.sol` (`0x407A2609dfd5336a38D6274B1EFc1804930f160A`):**
  - Direct Native POT / pUSDC pair (eliminates WPOT wrapping step to save ~350 POT in state rent).
  - Built-in ERC-721 position receipt NFT authority (`ownerOf`, `getPosition`).
  - Swaps: `swapExactPOTForTokens` (payable), `swapExactTokensForPOT`.
  - Liquidity: `addLiquidity` (payable), `removeLiquidity`.

### 4.2 State Rent Economics under `pallet-revive`
Under `pallet-revive`, EVM gas estimation incorporates Substrate refundable storage deposits:
- Bytecode storage deposit: $\approx 0.0589\text{ POT per byte}$
- Base contract trie deposit: $\approx 18.32\text{ POT}$
- New mapping storage slot: $\approx 3.92 - 7.82\text{ POT}$
- Faucet minting to an uninitialized address or initial liquidity seeding incurs higher first-time gas limits because `pallet-revive` reserves storage deposits for the new account slot.

---

## 5. Implementation Roadmap (Phase B)

1. **Wallet Layer Enhancements:**
   - Upgrade `EvmWalletService`: Add `sendTransaction(txParams)`, `signMessage()`, track tx lifecycle, catch user rejections (Code `4001`), chain switches.
   - Upgrade `SubstrateWalletService`: Hold `injectedSigner`, add extrinsic signing for native transfers, handle disconnects and account changes.
2. **Contract Interaction Service:**
   - Create `ContractTransactionService`: Unified module handling token operations (`faucetMint`, `transfer`, `approve`), AMM operations (`addLiquidity`, `removeLiquidity`, `swap`), and native transfers.
   - Granular feature controls replacing global `TX_SUBMISSION_ENABLED = false`.
3. **Contract Deployment Service:**
   - Upgrade `DeploymentService`: Support user-selected deployment of verified artifacts (`TestUSDCMin`, `WPotToken`, `NexusAMMNative`), input validation, constructor encoding, gas estimation, user wallet approval, receipt polling, and on-chain verification.
4. **UI Upgrades:**
   - Real interactive action buttons in `AmmPanel` with approval check and confirmation modal.
   - Dedicated "Transfers & Faucet" panel for token and native currency operations.
   - Unified Transaction Status Drawer (Pending, Confirmed, Reverted) with explorer links.
   - Revive Mapper ownership warnings and test vector inspector.
5. **Testing & Verification:**
   - Comprehensive Vitest unit & integration tests for all wallet states, rejection paths, and contract calls.
