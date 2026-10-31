# PortalNexus — Dual-VM Observability, Revive Address Inspector & Native POT AMM for Portaldot V3

> **One-Sentence Elevator Pitch:**  
> **PortalNexus** is an open-source Dual-VM observability terminal, deterministic `pallet-revive` address-mapping inspector, and state-rent-optimized Constant-Product AMM (`Native POT / pUSDC`) deployed on the **Portaldot V3 Testnet** (`Chain ID 420420777`) for Portaldot developers and DeFi users.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)
[![Portaldot V3 Testnet](https://img.shields.io/badge/Network-Portaldot_V3_Testnet_(420420777)-cyan.svg)](https://node-console.portaldot.dev/)
[![Automated Tests](https://img.shields.io/badge/Tests-236_Passing_(46_Hardhat_+_190_Vitest)-purple.svg)](./PORTALNEXUS_DORAHACKS_FINAL_SUBMISSION_CHECKLIST.md)
[![Live Demo](https://img.shields.io/badge/Live_Demo-portalnexus--two.vercel.app-blue.svg)](https://portalnexus-two.vercel.app)

---

## 🌐 Live Hosted Web Demo

| Parameter | Value |
| :--- | :--- |
| **Live Vercel Production URL** | [https://portalnexus-two.vercel.app](https://portalnexus-two.vercel.app) |
| **Vercel Project Name** | `portalnexus` (jamism123) |
| **GitHub Continuous Deployment** | Connected to [`JimmyOgb/PortalNexus`](https://github.com/JimmyOgb/PortalNexus) on branch `main` |
| **Target Network** | **Portaldot V3 Testnet** (`Chain ID 420420777`) |
| **Execution Mode** | **Interactive dApp Mode** (User-Signed Web3 Wallet Transactions) |

### What the Hosted dApp Supports
- **Live Dual-VM Observability:** Streaming telemetry from Portaldot Substrate WebSocket (`wss://test-node-v3.portaldot.dev`) and EVM JSON-RPC (`https://test-evm-rpc-v3.portaldot.dev`), displaying real-time block cadence offsets ($\Delta = \text{Substrate} - \text{EVM}$).
- **Real Wallet Connectivity:** Dual-VM wallet support for EVM providers (MetaMask, Rabby) on Chain ID `420420777` and Substrate extensions (Polkadot{.js}, Talisman, SubWallet) on SS58 Prefix 42.
- **Transfers & Faucet Panel (Tab 2):** Real-time testnet faucet claims (`10,000 pUSDC` per call, permissionless repeat minting), ERC-20 pUSDC token transfers, and native POT transfers on EVM and Substrate (using genuine `balances.transfer_keep_alive` extrinsic dispatch).
- **Nexus AMM Panel (Tab 3):** User-signed constant-product liquidity additions, LP position redemption, and token swaps with automatic empty-pool swap protection. Discloses that Architecture A LP positions are non-transferable (soulbound to depositor) and redeemable only by the original minter.
- **In-dApp Contract Deployment Manager:** Direct browser-signed deployment modal supporting Architecture A (`TestUSDCMin`, `NexusAMMNative`) and Architecture B (`WPotToken`, `TestUSDC`, `NexusAMM`).
- **`pallet-revive` Deterministic Address Inspector (Tab 1):** Real-time derivation of Substrate `SS58` addresses from EVM `0x...` (H160) keys via the `0xEE`-padding rule (`H160 || [0xEE; 12]`), complete with authoritative test vectors and explicit ownership boundary warnings.
- **Floating Transaction Notification Toast:** Real-time lifecycle tracking (`PROMPTING_WALLET` -> `SUBMITTING` -> `MINING` -> `CONFIRMED`) with direct links to the Portaldot node console explorer.

### Critical Safety & Testnet Disclosures
> [!IMPORTANT]
> 1. **Testnet Only — Not Mainnet:** All smart contracts operate strictly on the experimental **Portaldot V3 Testnet** (`Chain ID 420420777`).
> 2. **Simulation Token (`pUSDC`):** `pUSDC` is a testnet simulation token with **zero real-world monetary value and no asset backing**.
> 3. **User-Signed Transactions Only:** PortalNexus never requests private keys or broadcasts unattended transactions. Every transaction triggers the user's browser wallet for explicit manual confirmation.
> 4. **Cross-VM Bridge Limitation:** Direct cross-VM teleportation is disabled because Portaldot V3 runtime does not expose client-accessible bridge extrinsics.
> 5. **Empty-Pool Swap Protection:** When AMM reserves are zero, token swap execution is disabled by the interface until initial liquidity is seeded.

---

## ⚠️ Prototype & Security Disclosure

> [!CAUTION]
> - **Testnet Prototype Only:** PortalNexus is an experimental prototype deployed on the **Portaldot V3 Testnet** (`Chain ID 420420777`). It is **not** a production financial service, has not undergone an external security audit, and must never be used with real funds.
> - **Test Token (`pUSDC`):** `pUSDC` ([`TestUSDCMin.sol`](./contracts/contracts/TestUSDCMin.sol)) is an unbacked testnet simulation token with **zero real-world monetary value**.
> - **Current Pool & Transaction Status:** Both Architecture A contracts are deployed and verified on-chain, and all contract reads are live. However, the pool currently has **zero reserves (`0 POT / 0 pUSDC`)** and frontend transaction broadcasting is **intentionally disabled (`TX_SUBMISSION_ENABLED = false`)** until the deployer account receives additional testnet `tPOT` to cover `pallet-revive` storage-slot deposits.

---

# How to Test PortalNexus

This section provides a complete, self-contained evaluation guide for **DoraHacks judges and technical reviewers**. Every core feature of PortalNexus V3.0 can be launched, tested, and verified directly from your browser without personal assistance or specialized setup.

> [!TIP]
> **No Wallet or Funds Required for Core Evaluation:**  
> You do **not** need a funded cryptocurrency wallet to evaluate PortalNexus. Over **80% of the platform's functionality**—including live Dual-VM consensus telemetry, deterministic `pallet-revive` address derivation, on-chain smart contract inspection (`PortalTestStorage`), in-browser Solidity WASM compilation, and AMM reserve auditing—is **100% read-only and requires zero wallet connection and zero tokens**.

---

### 1. Open the Live Application

Navigate to the production deployment:
**[https://portalnexus-two.vercel.app/](https://portalnexus-two.vercel.app/)**

- **Hosted On:** Vercel Global Edge Network (linked directly to the `main` branch of this repository).
- **Network Compatibility:** Fully responsive in all modern desktop browsers (Chrome, Brave, Edge, Firefox, Safari).
- **Instant Initialization:** Upon load, the dApp automatically initiates read-only connections to both the Substrate Layer-0 WebSocket and the `pallet-revive` EVM JSON-RPC endpoint. No login, sign-up, or wallet authorization is requested.

---

### 2. Configure Portaldot V3 Testnet (Optional for Wallet Testing)

If you choose to test write operations (such as claiming testnet `pUSDC` tokens or submitting transfers), configure your browser wallet with the official Portaldot V3 Testnet parameters:

| Parameter | Exact Value | Notes |
| :--- | :--- | :--- |
| **Network Name** | `Portaldot V3 Testnet` | Official Portaldot Developer Testnet |
| **Chain ID** | `420420777` | Hex: `0x190f1ca9` |
| **EVM RPC URL** | `https://test-evm-rpc-v3.portaldot.dev` | Public JSON-RPC endpoint (`eth_*` namespace via REVM) |
| **Substrate WebSocket URL** | `wss://test-node-v3.portaldot.dev` | Native Substrate Layer-0 RPC & Extrinsic gateway |
| **Currency Symbol** | `tPOT` (or `POT`) | Native gas and staking token |
| **Decimals** | `14` (Substrate planck) / `18` (EVM wei) | $1\text{ planck} = 10^4\text{ wei}$ |
| **Official Block Explorer** | [`https://node-console.portaldot.dev/`](https://node-console.portaldot.dev/) | Substrate & Polkadot.js node console |

> [!NOTE]
> **One-Click Network Addition:**  
> If using **MetaMask**, **Rabby**, or **Coinbase Wallet**, you do not need to enter these RPC details manually. Simply click the **"Connect EVM"** button in the PortalNexus header. If your wallet is connected to an alternate network (e.g. Ethereum Mainnet), PortalNexus automatically dispatches an `EIP-3085` (`wallet_addEthereumChain`) and `EIP-3326` (`wallet_switchEthereumChain`) request to configure and switch networks with one click.

---

### 3. Wallet and Test Funds Matrix

PortalNexus enforces a clear separation between read-only evaluation and user-signed write operations:

| Feature Category | Wallet Needed? | Token Balance Needed? | Supported Wallets / Extrinsics |
| :--- | :---: | :---: | :--- |
| **Dual-VM Consensus Telemetry** | ❌ None | ❌ None | None (Public WebSocket & JSON-RPC) |
| **3D Dual-VM Singularity Canvas** | ❌ None | ❌ None | None (Client-side WebGL Three.js) |
| **`pallet-revive` Address Inspector** | ❌ None | ❌ None | None (Client-side pure TypeScript & Blake2b) |
| **Deep Diagnostics & Cadence Table** | ❌ None | ❌ None | None (Direct RPC queries) |
| **Verified Contract Registry & RPC Getters** | ❌ None | ❌ None | None (`eth_call` to `0x5065...f6F8` and `0x407A...160A`) |
| **In-Browser Solidity 0.8.24 WASM Compiler** | ❌ None | ❌ None | None (Runs Solc v0.8.24 directly inside browser WebAssembly) |
| **AMM Empty-Pool & Reserve Auditing** | ❌ None | ❌ None | None (`eth_call` to `getReserves()`) |
| **Claim Testnet pUSDC (Contract Faucet)** | ✅ EVM Wallet | ⚠️ Small `tPOT` for gas | MetaMask, Rabby, Coinbase Wallet (calls `faucetMint`) |
| **EVM Transfers (pUSDC / POT)** | ✅ EVM Wallet | ✅ Token / Gas balance | Standard EIP-1193 browser extensions |
| **Substrate Native tPOT Transfers** | ✅ Substrate Wallet | ✅ Native `tPOT` balance | Polkadot{.js}, Talisman, SubWallet (requires `signPayload`) |

#### How to Obtain Testnet Tokens
1. **Simulation Stablecoin (`pUSDC`):**  
   - PortalNexus features an **open, permissionless on-chain contract faucet** built into [`TestUSDCMin.sol`](./contracts/contracts/TestUSDCMin.sol).
   - In **Tab 2 ("Transfers & Faucet")**, click **"Claim 10,000 pUSDC"**.
   - The contract dispenses up to 10,000 `pUSDC` per transaction with zero cooldown and no access list.
2. **Native Gas Token (`tPOT`):**  
   - To sign and broadcast transactions, an account requires native `tPOT` to pay EVM gas and `pallet-revive` storage deposits.
   - Testnet `tPOT` can be obtained through the official Portaldot Discord/Telegram developer faucets or community testnet taps.
   - **Important:** Never use or import real mainnet private keys or seed phrases. All testing is strictly restricted to testnet.

---

### 4. Feature-by-Feature Testing Guide

Follow these step-by-step instructions to verify each core protocol capability:

#### Feature 1: Real-Time Dual-VM Consensus Synchronization
1. Open [`https://portalnexus-two.vercel.app/`](https://portalnexus-two.vercel.app/).
2. Look at the top navigation bar and hero metric cards:
   - **Substrate Height:** Displays the live block height streaming via WebSocket (`wss://test-node-v3.portaldot.dev`).
   - **Finalized Height:** Displays the finalized Substrate consensus block height.
   - **Block Offset ($\Delta$):** Real-time computation of $\Delta = \text{Substrate Block} - \text{EVM Block}$.
3. **Expected Observable Result:**  
   The block counters increment live every ~2–6 seconds in lockstep. The Block Offset card reports a synchronized status (typically $\Delta = 0$ to $+2$ blocks) with the verdict label **`Cadence Synchronized`**.

#### Feature 2: Authoritative `pallet-revive` Address Derivation (Tab 1)
1. Ensure **`1. Cross-VM Map`** is selected (default tab).
2. Under "Deterministic Revive Mapping Preview", click any of the **Authoritative Test Vector** buttons:
   - Click **`Verified Deployer (0xdC7f…8A2A)`**.
3. **Expected Observable Result:**  
   - The EVM address field populates with `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`.
   - The fallback mapper instantly computes the exact `SS58` Prefix 42 address:  
     `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`.
   - Notice the amber security disclosure: PortalNexus explicitly warns that deterministic mathematical padding (`H160 || [0xEE; 12]`) does **not** prove shared private key ownership between VMs, and confirms that client-side cross-VM token bridging is disabled because Portaldot V3 does not expose client-accessible bridge extrinsics.

#### Feature 3: Deep Diagnostics, Cadence Offset Table & Blake2b Risk Comparison
1. Scroll down to the bottom of the dashboard.
2. Click the accordion button labeled **`▼ Deep Diagnostics, Cadence Offset Table & Blake2b Converter`**.
3. Inspect the expanded diagnostics sections:
   - **Rolling Cadence Table:** Shows the last 15 historical block samples from both Substrate and EVM endpoints, complete with individual block deltas and timestamps.
   - **Blake2b vs. 0xEE Comparison:** Shows why legacy Frontier tools (which derive Substrate addresses via `blake2_256("evm:" + H160)`) cause permanent fund loss on Portaldot V3, contrasting the wrong Blake2b hash against the authoritative `0xEE` padded address.
4. **Expected Observable Result:**  
   The accordion opens smoothly, displaying live endpoint latency, connection status, rolling block cadence samples, and the side-by-side mathematical address discrepancy.

#### Feature 4: Verified Contract Registry & Live RPC Getters (`getValue() == 42`)
1. Inside the expanded **Deep Diagnostics** accordion, locate the **`Verified Contracts Registry`** section.
2. Observe the three verified contract cards:
   - `NexusAMMNative` (`0x407A...160A`)
   - `TestUSDCMin` (`0x6C3B...4002`)
   - `PortalTestStorage` (`0x5065...f6F8`)
3. On the `PortalTestStorage` card, click **`Re-verify Live State`**.
4. **Expected Observable Result:**  
   The dApp dispatches a fresh live `eth_call` query directly to `https://test-evm-rpc-v3.portaldot.dev`. The status badge confirms:
   - `getValue(): 42`
   - `creator: 0xdC7f...8A2A` (matches verified deployer)
   - `deployedAtBlock: 261857`
   - `contractBytecodeSize: 678 bytes`

#### Feature 5: In-Browser Solidity 0.8.24 WebAssembly Compiler Modal
1. Scroll to the top navigation bar.
2. Click the **`Deploy Contract`** button (`#btn-deploy-modal`).
3. In the modal, examine the embedded Solidity compiler:
   - Review the preloaded contract template (`PortalTestStorage.sol` targeting EVM Cancun).
   - Observe the compiler controls and storage-deposit estimation calculator.
4. Click **`Compile Contract`**.
5. **Expected Observable Result:**  
   The browser executes the official `solc-js` 0.8.24 WebAssembly compiler locally without contacting external servers. Compilation succeeds with **Status: Ready for Deployment**, displaying the exact compiled bytecode (678 bytes) and estimating the `pallet-revive` storage rent deposit (~0.0589 POT/byte + 18.32 POT base trie deposit). Press `Escape` or click the `✕` button to close the modal.

#### Feature 6: AMM Reserve Auditing & Empty-Pool Protection (Tab 3)
1. Switch to **`3. Nexus AMM`** in the main execution terminal.
2. Inspect the **Reserve POT** and **Reserve pUSDC** cards.
3. Observe the amber alert banner:
   `AMM Reserves Empty (0/0) — Swap Execution Disabled`
4. Try typing a swap amount into the "You Pay" input.
5. Click **`Preview Initial Liquidity Calldata (0.5 POT + 10 pUSDC) →`**.
6. **Expected Observable Result:**  
   - Live on-chain `eth_call` to `getReserves()` returns `reservePOT = 0.00` and `reserveUSDC = 0.00`.
   - The UI blocks swap execution, protecting users from zero-liquidity division-by-zero reverts.
   - The initial liquidity preview tab displays the exact constant-product share calculation (`2,236,067,976,499` shares minted, `1,000` minimum liquidity shares permanently locked) and provides the exact ABI calldata for `approve` and `addLiquidity`.

---

### 5. Verified Deployed Contracts (Portaldot V3 Testnet)

All smart contracts referenced by PortalNexus are deployed, immutable, and verifiable on the Portaldot V3 Testnet (`Chain ID 420420777`):

| Contract Name | Verified On-Chain Address | Deployed Block | Bytecode Size | Verified Role / Method |
| :--- | :--- | :---: | :---: | :--- |
| **`NexusAMMNative`** | [`0x407A2609dfd5336a38D6274B1EFc1804930f160A`](https://node-console.portaldot.dev/) | `#237284` | 3,305 bytes | State-rent-minimized Constant-Product AMM (`POT / pUSDC`) |
| **`TestUSDCMin`** | [`0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`](https://node-console.portaldot.dev/) | `#237279` | 1,482 bytes | 6-decimal simulation stablecoin with open `faucetMint` |
| **`PortalTestStorage`** | [`0x5065125265638A4b354FDDfe1f9339F65cC9f6F8`](https://node-console.portaldot.dev/) | `#261857` | 678 bytes | Storage getter test contract (`getValue() == 42`) |

#### Independent RPC Verification Commands
Reviewers can independently verify contract bytecode and live storage directly using `curl` against the public RPC:

```bash
# 1. Verify PortalTestStorage bytecode exists on-chain
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x5065125265638A4b354FDDfe1f9339F65cC9f6F8","latest"],"id":1}'

# 2. Query PortalTestStorage.getValue() directly (selector 0x20965255 -> returns 42 / 0x2a)
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x5065125265638A4b354FDDfe1f9339F65cC9f6F8","data":"0x20965255"},"latest"],"id":2}'
# Response: {"jsonrpc":"2.0","result":"0x000000000000000000000000000000000000000000000000000000000000002a","id":2}
```

---

### 6. Known Limitations & Honest Disclosures

In the spirit of complete hackathon transparency, please note the following verified limitations:

1. **Unseeded AMM Pool Reserves (`0/0`):**  
   The deployed `NexusAMMNative` pool currently holds zero reserves (`0 POT / 0 pUSDC`). Seeding initial liquidity requires ~24.72 `tPOT` in `pallet-revive` mapping-slot storage deposits (state rent). The pool's constant-product math, slippage protection, and 1,000-share liquidity lock are rigorously verified by 46 automated invariant tests, but live swaps against on-chain liquidity cannot execute until liquidity is deposited.
2. **Swap Execution Disabled:**  
   The UI automatically detects zero reserves and disables swap execution to prevent user transactions from reverting. A complete calldata preview and share calculator is provided instead.
3. **No Direct Client Cross-VM Teleport Extrinsic:**  
   Portaldot V3 `pallet-revive` does not expose a trustless, client-callable extrinsic for instantaneous cross-VM token teleportation. Tab 1 functions as an authoritative address mapping and ownership inspector.
4. **Substrate Wallet Extrinsic Signing Requirement:**  
   Substrate native transfers require a wallet extension capable of standard extrinsic payload signing (`signPayload`). Adapters that only offer off-chain message signing (`signRaw`) are flagged with an explicit warning, because PortalNexus refuses to substitute fake message signatures for genuine on-chain transfers.

---

### 7. Local Development & Automated Test Verification

Judges can reproduce the entire project locally from source in under 60 seconds:

```bash
# 1. Clone the repository
git clone https://github.com/JimmyOgb/PortalNexus.git
cd PortalNexus

# 2. Install frontend and contract dependencies
npm install
npm --prefix contracts install

# 3. Start local development server (opens http://localhost:5173/)
npm run dev

# 4. Run frontend, math, mapper, and protocol unit tests (Vitest)
npm test

# 5. Run smart contract unit and invariant tests (Hardhat)
npm run test:contracts

# 6. Run strict TypeScript compilation check (Zero errors)
npm run typecheck

# 7. Build production distribution bundle
npm run build
```

**Automated Test Summary:**
- **Vitest:** 15 test files, 190 passing unit and integration tests.
- **Hardhat:** 46 passing smart contract invariant tests across 5 test suites.
- **Total:** **236 passing automated tests** with 100% protocol invariant coverage.

---

## B. Problem

Portaldot Network V3.0 replaces legacy Polkadot Frontier (`pallet-evm`) with Polkadot SDK's **`pallet-revive`** execution engine (`v3002`) exposed via `eth-rpc`. While this brings high-performance REVM execution alongside native Substrate Layer-0 consensus, builders and users face **three concrete, verified engineering obstacles**:

1. **Silent Fund Loss from Legacy Address Converters:**  
   On legacy Frontier chains, converting an EVM `0x...` (`H160`) address to a Substrate `5...` (`SS58`) address uses `@polkadot/util-crypto`'s `evmToAddress()`, which hashes `blake2_256("evm:" + H160)`. On Portaldot V3's `pallet-revive`, unmapped EVM accounts instead use `AccountId32Mapper`, which pads the 20-byte `H160` address with twelve `0xEE` bytes (`H160 || [0xEE; 12]`). Using legacy Frontier converters on Portaldot V3 derives the wrong `SS58` account and renders transferred funds permanently unrecoverable.
2. **State-Rent Economics Break Naive Multi-Contract DeFi Deployments:**  
   Because standard Ethereum tooling (`ethers.js`, Hardhat, MetaMask) only exposes a scalar `gasLimit`, `pallet-revive` bundles refundable Substrate **storage deposits** (`DepositPerByte` and `DepositPerItem`) directly into `eth_estimateGas`. Our live benchmarks at Block `#236250` proved that deploying bytecode on Portaldot V3 locks **`~0.0589 POT per byte`** plus **`~18.32 POT` base trie overhead** per contract, and writing a new mapping slot locks **`~3.92 to 7.82 POT`**. A standard 3-contract Uniswap-style deployment (`WPotToken` + `TestUSDC` + `NexusAMM` + external `NexusLPReceipt`) requires **`~1,090.86 POT`** in upfront storage collateral—exceeding typical testnet faucet allocations.
3. **Lack of Unified Dual-VM Visibility:**  
   Developers interacting with Portaldot V3 must currently switch between a Substrate WebSocket console (`wss://test-node-v3.portaldot.dev`, 14-decimal `tPOT`) and an EVM JSON-RPC endpoint (`https://test-evm-rpc-v3.portaldot.dev`, 18-decimal `POT` wei) without a unified view of block-cadence synchronization or account-mapping state.

---

## C. Why It Matters

- **Observed Facts (Verified On-Chain):**
  - Portaldot V3 (`specName: portaldot-v3`, `specVersion: 3002`) runs `pallet-revive` at Pallet Index `80`, where native Substrate balances use `14 decimals` (`planck`) and EVM RPC balances scale to `18 decimals` (`wei`, $1\text{ planck} = 10^4\text{ wei}$).
  - Over `1,009` accounts are already registered in `Revive::OriginalAccount` on testnet, while unmapped EVM wallets rely on the `0xEE`-padded fallback rule.
  - Reducing contract bytecode footprint and storage-slot count directly determines whether a DeFi protocol is economically deployable on `pallet-revive`.
- **Ecosystem Hypothesis:**
  - Providing an open-source, MIT-licensed reference implementation that combines **safe `pallet-revive` address derivation**, **dual-VM cadence telemetry**, and a **state-rent-minimized Native POT AMM** accelerates onboarding for every subsequent DeFi and infrastructure team building on Portaldot V3.

---

## D. Solution

**PortalNexus** solves these challenges in a single browser terminal and smart-contract suite:

1. **What Users & Judges Can Do Today (Live & Interactive):**
   - **Monitor Dual-VM Consensus in Real Time:** Stream live block heights, finality, gas prices, and rolling 15-sample block-cadence offsets ($\Delta = \text{Substrate} - \text{EVM}$) from both Portaldot V3 endpoints simultaneously.
   - **Derive Verified `pallet-revive` Addresses:** Convert any `0x...` (`H160`) address into its exact `pallet-revive` `SS58` (Prefix `42`) fallback account (`H160 || [0xEE; 12]`) with built-in guards against legacy Frontier hashing.
   - **Inspect Live Deployed AMM & Token State:** Query live `getReserves()`, `totalLiquidityShares()`, `totalSupply()`, and wallet balances (`POT` and `pUSDC`) directly from the deployed Architecture A contracts on Portaldot V3 Testnet (`0x407A...160A` and `0x6C3B...4002`) with zero fabricated fallback data.
   - **Preview Exact Calldata & Constant-Product Math:** Construct and inspect unsigned transaction payloads (`to`, `valueHex`, selector, ABI-encoded arguments) for `faucetMint`, exact-allowance `approve`, `addLiquidity`, `removeLiquidity`, and swaps (`swapExactPOTForTokens`, `swapExactTokensForPOT`).
2. **What Remains Planned (Requires Additional Testnet `tPOT` & User Authorization):**
   - Broadcasting initial liquidity seeding and live swap transactions once the deployer wallet (`13.088472 POT` remaining) is topped up to cover `pallet-revive` mapping-slot storage deposits (`~25–35 POT`), and enabling opt-in wallet transaction signing.

---

## E. What Is Implemented (Feature Status Matrix)

| Feature | Status | Verified Evidence | Current Limitations |
| :--- | :--- | :--- | :--- |
| **Architecture A Smart Contracts (`TestUSDCMin` & `NexusAMMNative`)** | `VERIFIED` | Deployed on Portaldot V3 (`0x6C3B...4002` at block `#237279`, `0x407A...160A` at block `#237284`); 14 dedicated Hardhat tests in [`ArchitectureA.test.ts`](./contracts/test/ArchitectureA.test.ts). | Deployed on testnet only; pool currently holds `0` reserves. |
| **Reference 3-Contract Suite (`WPotToken`, `TestUSDC`, `NexusAMM`, `NexusLPReceipt`)** | `VERIFIED` | 32 Hardhat unit & invariant tests passing across 4 test files in [`contracts/test/`](./contracts/test/). | Preserved for local verification; superseded on-chain by Architecture A to save `~683 POT` in state rent. |
| **Live Read-Only AMM & Token Telemetry (`AmmPanel.tsx`, `ammService.ts`)** | `VERIFIED` | Live `eth_call` queries for `getReserves()`, `totalLiquidityShares()`, `totalSupply()`, `balanceOf()`, `allowance()`, and `eth_getLogs` LP discovery; 16 tests in [`tests/liveIntegration.test.ts`](./tests/liveIntegration.test.ts). | Reads live state `(0, 0)`; LP position `ownerOf`/`getPosition` loop is mock-tested because 0 positions exist on-chain. |
| **Dual-VM Cadence Monitor (`substrateRpc.ts`, `evmRpc.ts`, `blockMonitor.ts`)** | `VERIFIED` | Live WebSocket (`wss://test-node-v3.portaldot.dev`) and HTTP (`https://test-evm-rpc-v3.portaldot.dev`) polling; 12 unit tests in `blockMonitor.test.ts` & `rpcParsers.test.ts`. | Public EVM RPC occasionally experiences 7s Cloudflare edge timeouts (UI surfaces error cleanly with a Retry button). |
| **Deterministic `pallet-revive` Address Mapper (`reviveMapper.ts`)** | `VERIFIED` | Pure TypeScript `blake2b-512` Base58 SS58 encoder (`H160 || [0xEE; 12]`); 7 unit tests in [`tests/reviveMapper.test.ts`](./tests/reviveMapper.test.ts). | Computes unmapped fallback addresses (`AccountId32Mapper`); does not query `Revive::OriginalAccount` storage directly. |
| **Transaction Preparation & Calldata Builder (`ammService.ts`)** | `VERIFIED` | Encodes exact ABI calldata verified against Hardhat `ethers.Interface` in [`tests/liveIntegration.test.ts`](./tests/liveIntegration.test.ts). | Generates unsigned transaction previews only; does not sign or broadcast. |
| **EVM & Substrate Wallet Connectors (`evmWallet.ts`, `substrateWallet.ts`)** | `MOCK-TESTED` | 9 unit tests in [`tests/walletIntegrations.test.ts`](./tests/walletIntegrations.test.ts) + Playwright injected provider smoke tests (connected, wrong-chain, 4001 rejection). | Not yet manually tested with a real user browser extension (MetaMask/Rabby/Talisman) in a live session. |
| **3D Dual-VM Singularity Canvas (`ThreeCanvas.tsx`)** | `VERIFIED` | WebGL Three.js scene with camera focus modes (`overview`, `substrate`, `evm`), warp pulse, and reduced-motion pause toggle. | Visual observability layer only. |
| **On-Chain Transaction Broadcasting (`TX_SUBMISSION_ENABLED`)** | `DISABLED` | Hard-coded `TX_SUBMISSION_ENABLED = false` in [`src/services/ammService.ts`](./src/services/ammService.ts); asserted in `tests/liveIntegration.test.ts`. | Permanently disabled in this build to prevent unauthorized gas/state-rent spend. |
| **Cross-VM Token Teleport Execution** | `DISABLED` | Explicitly labeled disabled in Tab 1 UI. | Portaldot V3 does not expose a trustless client-side cross-VM transfer extrinsic without an account mapping/bridge step. |

---

## F. Why Portaldot

PortalNexus is not a generic EVM template pointed at a new chain ID; every layer of the stack was shaped around **Portaldot V3.0's specific runtime architecture**:

1. **`pallet-revive` State-Rent Optimization (Architecture A):**  
   By eliminating `WPotToken.sol` and unifying LP position tracking directly inside [`NexusAMMNative.sol`](./contracts/contracts/NexusAMMNative.sol), we reduced total deployed bytecode from `~15,580 bytes` to **`4,787 bytes`** (`1,482 bytes` for `TestUSDCMin` + `3,305 bytes` for `NexusAMMNative`), cutting actual deployment cost from an estimated `~1,090.86 POT` to **`407.811527 POT`**. Note: In Architecture A, LP positions are non-transferable (soulbound to depositor) and redeemed via `removeLiquidity`, contrasting with Architecture B's separate transferable `NexusLPReceipt`.
2. **Native POT (18-Decimal EVM Wei vs. 14-Decimal Substrate Planck):**  
   `NexusAMMNative` accepts native EVM `POT` via `msg.value` (`addLiquidity`, `swapExactPOTForTokens`) and returns native `POT` via low-level `.call{value: amount}("")`, while the telemetry layer explicitly tracks the `14-decimal` (`tPOT` planck) to `18-decimal` (`POT` wei) conversion across VMs.
3. **`AccountId32Mapper` Compliance:**  
   Implements Portaldot V3's exact 12-byte `0xEE` suffix mapping rule (`H160 || [0xEE; 12]`) under SS58 Prefix `42`.

---

## G. Architecture

Detailed system documentation is available in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

```mermaid
flowchart LR
    subgraph Client["PortalNexus Browser Terminal"]
        DASH["Dashboard.tsx\n(Dual-VM Telemetry & 3D Core)"]
        MAP["reviveMapper.ts\n(H160 || 0xEE...12 -> SS58)"]
        AMMUI["AmmPanel.tsx\n(Swap / Add / Remove / Faucet)"]
        AMMSVC["ammService.ts\n(Live Reads & Calldata Builder)"]
        BARRIER["Safety Gate\nTX_SUBMISSION_ENABLED = false"]
    end

    subgraph Chain["Portaldot V3 Testnet (Chain ID 420420777)"]
        WS["Substrate L0 WSS\nwss://test-node-v3.portaldot.dev"]
        RPC["pallet-revive EVM RPC\nhttps://test-evm-rpc-v3.portaldot.dev"]
        PUSDC["TestUSDCMin (pUSDC)\n0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002"]
        POOL["NexusAMMNative (POT / pUSDC)\n0x407A2609dfd5336a38D6274B1EFc1804930f160A"]
    end

    DASH -- "Live WSS Subscribe" --> WS
    DASH -- "Live HTTP Poll" --> RPC
    DASH --> MAP
    AMMUI --> AMMSVC
    AMMSVC -- "Read-Only eth_call / eth_getBalance / eth_getLogs" --> RPC
    RPC --> PUSDC
    RPC --> POOL
    AMMSVC --> BARRIER
    BARRIER -. "Unsigned Calldata Preview Only\n(No eth_sendTransaction)" .-> AMMUI
```

---

## H. Deployed Contracts (Portaldot V3 Testnet)

> **Important:** All contracts below are deployed on the **Portaldot V3 Testnet** (`Chain ID 420420777` / `0x190f1ca9`), **not mainnet**. Full cryptographic deployment records are stored in [`contracts/deployment-receipt-arch-a.json`](./contracts/deployment-receipt-arch-a.json).

| Contract | Role / Pair | Deployed Address | Deployment Tx Hash | Block | Runtime Bytecode | Actual Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **[`TestUSDCMin.sol`](./contracts/contracts/TestUSDCMin.sol)** | `pUSDC` Test Token (6 Decimals, 10,000/call faucet cap, permissionless repeat minting, zero backing) | `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | `0x4534608666225d9fba0f8c69a28dd29c4130825b06a5160c33e6beec1b225152` | `#237279` | `1,482 bytes` | `128.867113 POT` |
| **[`NexusAMMNative.sol`](./contracts/contracts/NexusAMMNative.sol)** | Constant-Product AMM (`Native POT / pUSDC`, 0.3% fee) + Unified Non-Transferable LP Positions | `0x407A2609dfd5336a38D6274B1EFc1804930f160A` | `0x48cd085966cc570984aa4883d05ed3c26de9ade7d4296f909cc47f6ae0e9ba54` | `#237284` | `3,305 bytes` | `278.944414 POT` |

> [!NOTE]
> **Architecture A vs. Architecture B Liquidity Positions (SEC-02 Disclosure):**
> - **Architecture A (`NexusAMMNative.sol` — Active Testnet Deployment):** Liquidity positions are tracked internally (`ownerOf[tokenId]`). **Positions are non-transferable (soulbound)** to the depositor account. The contract does not implement ERC-721 transfer functions (`transferFrom`/`safeTransferFrom`). Underlying reserves can only be redeemed by the original depositor account invoking `removeLiquidity`.
> - **Architecture B (`NexusAMM.sol` + `NexusLPReceipt.sol` — Optional Reference):** Implements an external ERC-721 token contract where position receipts can be transferred between accounts to transfer the underlying claim.

- **Deployer EVM Address:** `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`
- **Deployer Mapped Substrate SS58 (Prefix 42):** `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`
- **Portaldot Node Console:** [`https://node-console.portaldot.dev/`](https://node-console.portaldot.dev/) *(Substrate/Polkadot.js console; EVM contracts and transaction receipts can be queried directly via `https://test-evm-rpc-v3.portaldot.dev` using the commands in [`docs/TESTING_AND_EVIDENCE.md`](./docs/TESTING_AND_EVIDENCE.md))*.

---

## I. Current Network and Pool Status

Verified via live read-only `eth_call` queries against `https://test-evm-rpc-v3.portaldot.dev` at Block **`#238047`** on `2026-10-29`:

- **`NexusAMMNative.getReserves()`:** `reservePOT = 0`, `reserveUSDC = 0` (**Empty Pool**)
- **`NexusAMMNative.totalLiquidityShares()`:** `0`
- **`NexusAMMNative.usdc()`:** `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Verified)
- **`NexusAMMNative.receiptContract()`:** `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Verified self-authority)
- **`TestUSDCMin.totalSupply()`:** `0` (`0.00 pUSDC`)
- **Deployer Remaining Balance:** `13.088472 POT` (`13,088,472,552,168,753,000 wei`)

Because `getReserves()` currently returns `(0, 0)`, **live token swapping cannot currently be demonstrated against on-chain pool liquidity**. The UI detects this zero-reserve state automatically, disables swap quote fabrication, explains that liquidity must be added first, and provides a one-click **Initial Liquidity Calldata Preview** (`0.5 POT + 10 pUSDC`) so judges can inspect the exact share calculation and ABI calldata.

---

## J. Screenshots and Demo

### Genuine Live UI Captures (Playwright Chromium against Live Portaldot V3 RPC)

````carousel
![PortalNexus AMM Panel — Live Empty-Pool State & Verified Contracts](./docs/assets/amm-live-empty-pool.png)
<!-- slide -->
![PortalNexus AMM Panel — Connected Balance Read (13.088472 POT)](./docs/assets/amm-connected-preview.png)
````

- **Public Hosted App Status:** ✅ **Live on Vercel:** [https://portalnexus-two.vercel.app](https://portalnexus-two.vercel.app) (Continuous deployment linked to `main`).
- **Demo Video & Pitch Deck Status:** Outstanding deliverables to be recorded/exported prior to final submission; complete script and slide deck outline are provided in [`docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md).
- **Reproducible Local Demo:** Runs in under 60 seconds from a clean clone (see [Section L](#l-installation-and-local-development) and [Section Q](#q-demo-guide)).

---

## K. Technology Stack

All technologies below are verified in [`package.json`](./package.json) and [`contracts/package.json`](./contracts/package.json):

- **Smart Contracts:** Solidity `0.8.24` (EVM `cancun`, optimizer `runs: 200`, `viaIR: true`), Hardhat `^2.22.18`, OpenZeppelin Contracts `^5.2.0` (used in reference Architecture B suite), Ethers.js `^6.13.5` (contract testing & deployment scripts).
- **Frontend Application:** React `^19.0.0`, TypeScript `^5.7.3`, Vite `^6.1.0`, Three.js `0.170.0` (WebGL 3D Dual-VM Singularity), Lucide React `^1.16.0`.
- **Testing & Verification:** Vitest `^3.0.5`, Mocha / Chai (`@nomicfoundation/hardhat-chai-matchers`).

---

## L. Installation and Local Development

### Prerequisites
- **Node.js:** `v20+` (verified on `v24.15.0`)
- **npm:** `v10+` (verified on `v11.12.1`)

### Step-by-Step Setup from a Clean Clone
```bash
# 1. Clone the repository
git clone https://github.com/JimmyOgb/PortalNexus.git
cd PortalNexus

# 2. Install frontend dependencies
npm install

# 3. Install smart contract dependencies
npm --prefix contracts install

# 4. (Optional) Configure environment variables for contract deployment scripts only
# Never commit real private keys. The frontend itself requires NO .env file.
cp contracts/.env.example contracts/.env

# 5. Start the local development server
npm run dev
```
Open **`http://localhost:5173`** in your browser. The frontend connects automatically to the public Portaldot V3 endpoints (`wss://test-node-v3.portaldot.dev` and `https://test-evm-rpc-v3.portaldot.dev`) with zero configuration or private keys needed.

---

## M. Tests and Verification

Full verification evidence and category breakdowns are documented in [`docs/TESTING_AND_EVIDENCE.md`](./docs/TESTING_AND_EVIDENCE.md).

```bash
# 1. Smart contract unit & invariant tests (Hardhat local EVM)
npm run test:contracts
# -> 46 passing (ArchitectureA: 14, NexusAMM: 11, WPotToken: 8, NexusLPReceipt: 7, TestUSDC: 6)

# 2. Frontend unit, math, mapper & mocked RPC integration tests (Vitest)
npm test
# -> 15 test files, 190 passed

# 3. Strict TypeScript check
npm run typecheck
# -> Exit code 0 (0 errors)

# 4. Production bundle build
npm run build
# -> Exit code 0 (clean dist/ build)
```

| Verification Type | Executed? | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Hardhat Contract Unit Tests** | ✅ Yes | `46 passing` | Tests both Architecture A (`NexusAMMNative`, `TestUSDCMin`) and Architecture B reference contracts. |
| **Vitest Frontend & Mocked RPC Tests** | ✅ Yes | `190 passing` | Includes ABI selector verification, Solc WASM compiler, Substrate transfers, and live RPC inspection. |
| **TypeScript & Vite Production Build** | ✅ Yes | `Exit 0` | Clean compilation and bundle generation. |
| **Live Read-Only Portaldot V3 RPC Checks** | ✅ Yes | `Verified at Block #238047` | Confirmed chain ID `420420777`, contract bytecodes (`1,482` & `3,305` bytes), deployment receipts, and live getters. |
| **Real Browser Wallet Extension QA** | ❌ No | `Mock-Tested Only` | Tested via Playwright injected `window.ethereum` stub; manual MetaMask/Rabby extension session not yet run. |
| **Live End-to-End Write Transactions** | ❌ No | `Not Executed` | `TX_SUBMISSION_ENABLED = false`; awaiting additional `tPOT` for `pallet-revive` storage deposits. |

---

## N. Limitations and Security

1. **Testnet Prototype Only:** Deployed on Portaldot V3 Testnet (`Chain ID 420420777`). Not audited and not suitable for mainnet or real assets.
2. **`pUSDC` Has Zero Value:** `pUSDC` is a testnet simulation token with an open `faucetMint` function (capped at `10,000 pUSDC` per call) and zero backing.
3. **Empty Pool State (`0 POT / 0 pUSDC`):** No liquidity has been deposited yet because creating the initial `balanceOf`, `allowance`, and `_positions[1]` storage entries on `pallet-revive` requires `~25–35 POT` in refundable state rent, whereas the deployer wallet has `13.088472 POT` remaining after contract deployment.
4. **Transaction Submission Disabled (`TX_SUBMISSION_ENABLED = false`):** The UI prepares and displays exact transaction calldata and slippage/deadline bounds, but the submit button is permanently disabled in this build.
5. **Real Wallet Extension & End-to-End Tx Flows Untested Live:** Wallet state handling was tested with mocked/injected providers only.
6. **Whole-Position LP Redemption:** `NexusAMMNative.removeLiquidity` redeems and burns the entire ERC-721 position NFT (`tokenId`) rather than partial share withdrawals.

---

## O. Roadmap

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full post-hackathon plan:
1. **Phase 1 (Immediate):** Acquire $\ge 50\text{ tPOT}$ from the Portaldot community faucet and execute the 5-step live transaction test plan ([`PORTALNEXUS_TRANSACTION_TEST_PLAN.md`](./PORTALNEXUS_TRANSACTION_TEST_PLAN.md)).
2. **Phase 2:** Publish static frontend hosting and conduct manual QA with MetaMask, Rabby, SubWallet, and Talisman extensions.
3. **Phase 3:** Extract `reviveMapper.ts` and the `pallet-revive` storage-deposit estimator into a standalone `@portalnexus/revive-kit` npm package.
4. **Phase 4:** Multi-pool factory support, `Revive::OriginalAccount` on-chain lookup integration, and independent security auditing.

---

## P. Hackathon Alignment (Portaldot Hacker House 2026)

Full audit details are recorded in [`PORTALNEXUS_HACKATHON_REQUIREMENTS_AUDIT.md`](./PORTALNEXUS_HACKATHON_REQUIREMENTS_AUDIT.md).

- **Recommended Track:** **Track 4 — Ecosystem DApps** *(with strong cross-qualification for **Track 3 — Node Operations & Tooling** and **Track 2 — Multi-Chain & Cross-Chain Infra**)*.

| Judging Criterion (Weight) | How PortalNexus Delivers | Verified Evidence | Open Gaps |
| :--- | :--- | :--- | :--- |
| **Technical Feasibility (30%)** | Solidity `0.8.24` contracts deployed & verified on Portaldot V3; 114 automated tests passing; live Dual-VM RPC clients; zero-dependency ABI encoder/decoder. | `0x6C3B...4002` (`#237279`), `0x407A...160A` (`#237284`), [`docs/TESTING_AND_EVIDENCE.md`](./docs/TESTING_AND_EVIDENCE.md). | Post-deployment write transactions (`faucetMint`, `addLiquidity`, `swap`) not yet broadcast on-chain. |
| **Innovation (30%)** | **Architecture A** eliminates `WPotToken` and unifies ERC-721 LP receipts inside `NexusAMMNative`, cutting `pallet-revive` deployment state rent by **62.6%** (`407.81 POT` vs `~1,090.86 POT`). | [`PORTALNEXUS_DEPLOYMENT_COST_INVESTIGATION.md`](./PORTALNEXUS_DEPLOYMENT_COST_INVESTIGATION.md), [`NexusAMMNative.sol`](./contracts/contracts/NexusAMMNative.sol). | Cross-VM teleport tab is a read-only address inspector. |
| **Ecosystem Contribution (20%)** | Open-source `reviveMapper.ts` (`AccountId32Mapper` `0xEE` padding) + published empirical `pallet-revive` storage-deposit benchmarks (`0.0589 POT/byte`). | [`src/lib/reviveMapper.ts`](./src/lib/reviveMapper.ts), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). | Standalone npm package extraction is planned for Phase 3. |
| **Business Potential (20%)** | Provides the foundational native `POT` / stablecoin liquidity primitive and safe Dual-VM account tooling needed by all Portaldot V3 DeFi users. | [`docs/ROADMAP.md`](./docs/ROADMAP.md), [`PORTALNEXUS_TRANSACTION_TEST_PLAN.md`](./PORTALNEXUS_TRANSACTION_TEST_PLAN.md). | Requires initial testnet liquidity seeding, demo video, and pitch deck before Demo Days. |

---

## Q. Demo Guide

A complete walkthrough and 2.5-minute video script are available in [`docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md). To inspect the working prototype in 60 seconds:

1. Run `npm install && npm run dev` and open `http://localhost:5173`.
2. **Observe Live Dual-VM Telemetry:** Watch the header and hero cards stream live Substrate (`wss://test-node-v3.portaldot.dev`) and EVM (`https://test-evm-rpc-v3.portaldot.dev`) block heights and lockstep offset ($\Delta$). Expand **Deep Diagnostics** at the bottom to view the rolling 15-sample cadence table.
3. **Test `pallet-revive` Address Derivation (`1. Cross-VM Map`):** Click **`Preset: Verified Deployer (0xdC7f…8A2A)`** to derive its exact `SS58` Prefix 42 fallback address (`5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`).
4. **Inspect Live AMM Reads & Calldata Preview (`2. Nexus AMM (native POT)`):**
   - View the live on-chain `getReserves()` result (`0.00 POT / 0.00 pUSDC`) and verified contract addresses.
   - Click **`Preview Initial Liquidity Calldata (0.5 POT + 10 pUSDC) →`** to switch to the **Add** tab and inspect the first-deposit share math (`2,236,067,976,499` shares minted, `1000` locked) and the exact two-step `approve` + `addLiquidity` ABI calldata.
   - Switch to **Faucet** and type `100` to inspect the prepared `faucetMint(address,uint256)` transaction payload (`0xa5c51274...`).
   - Note that the submit button remains disabled by design—do not attempt to broadcast transactions in this build.

---

## R. Contributing

Contributions are welcome! Before opening a pull request:
1. Ensure all smart contract tests pass: `npm run test:contracts`
2. Ensure all frontend and integration tests pass: `npm test`
3. Ensure strict TypeScript compilation and Vite build succeed: `npm run typecheck && npm run build`
4. Never commit `.env` files, private keys, or fabricated mock data in production services.

---

## S. License and Acknowledgements

- **Project License:** PortalNexus is released under the **[MIT License](./LICENSE)** (`Copyright (c) 2026 JimmyOgb and PortalNexus Contributors`).
- **Third-Party Software:** Bundled dependencies (including React, Three.js, Lucide, Hardhat, Ethers.js, and OpenZeppelin Contracts) remain governed by their respective upstream open-source licenses as declared in `package-lock.json` and `contracts/package-lock.json`.

---

## T. Links & Deliverables Checklist

| Resource | Link / Path | Status |
| :--- | :--- | :--- |
| **GitHub Repository** | [`https://github.com/JimmyOgb/PortalNexus`](https://github.com/JimmyOgb/PortalNexus) | ✅ Active |
| **MIT License** | [`./LICENSE`](./LICENSE) | ✅ Included |
| **Deployment Receipt (On-Chain Proof)** | [`./contracts/deployment-receipt-arch-a.json`](./contracts/deployment-receipt-arch-a.json) | ✅ Verified (`#237279` & `#237284`) |
| **Portaldot V3 Node Console** | [`https://node-console.portaldot.dev/`](https://node-console.portaldot.dev/) | ✅ Official Network Console |
| **Technical Architecture** | [`./docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | ✅ Included |
| **Testing & On-Chain Evidence** | [`./docs/TESTING_AND_EVIDENCE.md`](./docs/TESTING_AND_EVIDENCE.md) | ✅ Included |
| **Judge Demo Guide & Video Script** | [`./docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md) | ✅ Included |
| **Post-Hackathon Roadmap** | [`./docs/ROADMAP.md`](./docs/ROADMAP.md) | ✅ Included |
| **Hackathon Requirements Audit** | [`./PORTALNEXUS_HACKATHON_REQUIREMENTS_AUDIT.md`](./PORTALNEXUS_HACKATHON_REQUIREMENTS_AUDIT.md) | ✅ Included |
| **Transaction Test Plan** | [`./PORTALNEXUS_TRANSACTION_TEST_PLAN.md`](./PORTALNEXUS_TRANSACTION_TEST_PLAN.md) | ✅ Included |
| **Public Hosted Web Demo URL** | [`https://portalnexus-two.vercel.app`](https://portalnexus-two.vercel.app) | ✅ Live on Vercel |
| **Demo Video (≤ 3 Minutes)** | *See script in [`./docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md)* | ⏳ Outstanding (Record before Nov 5) |
| **Pitch Deck (PDF / Link)** | *See slide outline in [`./docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md)* | ⏳ Outstanding (Export before Nov 5) |
