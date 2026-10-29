# PortalNexus — Testing, On-Chain Evidence & Verification Matrix

This document strictly separates **local unit tests**, **mocked frontend tests**, **build/type-check verification**, **live read-only chain verification**, **wallet connection testing**, and **on-chain transaction testing**.

---

## 1. Verification Categories Summary

| Verification Category | Execution Status | Runner / Method | Result | What It Proves | What It Does NOT Prove |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Smart Contract Unit & Invariant Tests** | ✅ **EXECUTED** | Hardhat (`npm run test:contracts`) | **46 passing** (`0` failing) | Solidity logic for `NexusAMMNative`, `TestUSDCMin`, `NexusAMM`, `NexusLPReceipt`, and `WPotToken` on local Hardhat EVM (math, fees, $k$-growth, slippage, deadlines, access control). | Does not execute against the remote Portaldot `pallet-revive` node. |
| **2. Frontend Unit & Mocked RPC Tests** | ✅ **EXECUTED** | Vitest (`npm test`) | **66 passing** (`0` failing) | ABI selector equality against compiled Hardhat artifacts, calldata encoding/decoding, constant-product quote math, `reviveMapper` SS58 derivation, rolling block monitor, and mocked RPC/wallet state handling. | Uses mocked RPC/provider callbacks inside tests; does not broadcast transactions. |
| **3. TypeScript & Production Bundle** | ✅ **EXECUTED** | `npm run typecheck` & `npm run build` | **Exit 0** (`0` errors) | Strict TypeScript type safety across all `.ts`/`.tsx` files and clean Vite production asset bundling. | Does not test runtime network availability. |
| **4. Live Read-Only Portaldot V3 RPC Checks** | ✅ **EXECUTED** | Direct JSON-RPC & Headless Chromium against `https://test-evm-rpc-v3.portaldot.dev` | **Verified at Block `#237615` & `#238047`** | Chain ID `420420777`, deployed bytecode sizes (`1,482` and `3,305` bytes), deployment transaction receipts (`status: 0x1`), live getters (`getReserves() = (0,0)`, `usdc()`, `receiptContract()`, `decimals() = 6`, `totalSupply() = 0`), and live deployer balance (`13.088472 POT`). | Read-only calls only; no state-changing transactions sent. |
| **5. Real Browser Wallet Extension Connection** | ⚠️ **UNTESTED (Mocked Only)** | Playwright injected `window.ethereum` stub | **Simulated Only** | Connected, wrong-network (`Chain ID 1`), and user-rejection (`4001`) UI flows work against a stub provider. | A live human session with an installed MetaMask/Rabby/Polkadot.js browser extension has **not** been manually executed in this environment. |
| **6. Live End-to-End Write Transactions (Faucet / Approve / Add / Swap / Remove)** | 🛑 **NOT EXECUTED (Disabled by Safety Gate)** | `TX_SUBMISSION_ENABLED = false` | **Not Broadcast** | Live `eth_estimateGas` proved `faucetMint` requires `~7.82 POT` and `approve` requires `~3.92 POT` in `pallet-revive` state deposits. | Actual post-deployment state writes have not been broadcast because cumulative state rent (~25–35 POT) exceeds the deployer's remaining `13.088472 POT`. |

---

## 2. Exact Commands & Verified Outputs

### A. Smart Contract Test Suite (`46 passing`)
```bash
npm run test:contracts
```
- **`ArchitectureA.test.ts` (14 tests):**
  - `TestUSDCMin`: 6 decimals, `"Portal Test USD"` name, `"pUSDC"` symbol, `faucetMint` up to `MAX_MINT_PER_CALL` (`10,000 pUSDC`), cap/zero-amount/zero-address reverts, standard `transfer` and `approve`/`transferFrom`.
  - `NexusAMMNative`: Locks `MINIMUM_LIQUIDITY` (`1000`) and mints receipt `#1` on first deposit, refunds excess native `POT` when ratio favors lower `POT`, removes liquidity and burns receipt `#1`, prevents double-redemption and non-owner removal, swaps exact `POT` for `pUSDC` and `pUSDC` for `POT` with 0.3% fee and strict $k_{\text{after}} > k_{\text{before}}$ growth, enforces slippage and deadlines, and rejects accidental direct `POT` transfers.
- **Original Architecture B Reference Suite (`32 tests`):**
  - `NexusAMM.test.ts` (11 tests), `WPotToken.test.ts` (8 tests), `NexusLPReceipt.test.ts` (7 tests), `TestUSDC.test.ts` (6 tests).

### B. Frontend & Integration Test Suite (`66 passing`)
```bash
npm test
```
- **`tests/liveIntegration.test.ts` (16 tests):**
  - Verifies every selector in `src/contracts/abi.ts` (`getReserves`, `totalLiquidityShares`, `addLiquidity`, `removeLiquidity`, `swapExactPOTForTokens`, `swapExactTokensForPOT`, `getPosition`, `ownerOf`, `usdc`, `receiptContract`, `faucetMint`, `approve`, `allowance`, `balanceOf`, `totalSupply`, and `LiquidityAdded` topic0) against the compiled Hardhat artifact ABIs.
  - Round-trip decodes prepared calldata using `ethers.Interface.decodeFunctionData`.
  - Tests live-read parsers (`readReserves`, `readPusdcBalance`, `readPusdcTotalSupply`, `readLpPositions` log discovery + `ownerOf`/`getPosition` verification), zero-reserve detection, RPC error surfacing, strict input parsing, first/subsequent liquidity quotes, exact-allowance checks (`needsPusdcApproval`), deployment receipt consistency, and `TX_SUBMISSION_ENABLED === false`.
- **`tests/contractMath.test.ts` (10 tests):** Constant-product output, 0.3% fee, slippage bounds, price impact, and 18/6 decimal formatting.
- **`tests/deploymentService.test.ts` (10 tests):** Bytecode deployment service guards and receipt verification.
- **`tests/walletIntegrations.test.ts` (9 tests):** EVM (`window.ethereum`) and Substrate (`window.injectedWeb3`) connector state machines.
- **`tests/reviveMapper.test.ts` (7 tests):** `H160 || [0xEE; 12]` padding, SS58 Prefix 42 checksums, and rejection of legacy Frontier `evmToAddress()`.
- **`tests/blockMonitor.test.ts` (6 tests):** Rolling 15-sample window and lockstep offset calculation.
- **`tests/rpcParsers.test.ts` (6 tests):** Hex chain ID, block height, and wei/Gwei conversions.
- **`tests/uiSafetyGuards.test.ts` (4 tests):** Network configuration and contract registry invariants.

---

## 3. Live On-Chain Verification Evidence (Block `#238047`)

Queried directly from `https://test-evm-rpc-v3.portaldot.dev` on `2026-10-29`:

| Check / Method | Target | Raw / Decoded Result | Verification |
| :--- | :--- | :--- | :--- |
| `eth_chainId` | Network | `0x190f1ca9` (`420420777`) | Matches `NETWORK_CONFIG.chainIdDec` |
| `eth_blockNumber` | Network | `0x3a1df` (`238047`) | Live advancing chain |
| `eth_getTransactionReceipt` | `0x4534608666225d9fba0f8c69a28dd29c4130825b06a5160c33e6beec1b225152` | `status: "0x1"`, `blockNumber: 237279`, `contractAddress: 0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | Genuine `TestUSDCMin` deployment receipt |
| `eth_getTransactionReceipt` | `0x48cd085966cc570984aa4883d05ed3c26de9ade7d4296f909cc47f6ae0e9ba54` | `status: "0x1"`, `blockNumber: 237284`, `contractAddress: 0x407A2609dfd5336a38D6274B1EFc1804930f160A` | Genuine `NexusAMMNative` deployment receipt |
| `eth_getCode` | `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | `1,482 bytes` | Matches `deployment-receipt-arch-a.json` |
| `eth_getCode` | `0x407A2609dfd5336a38D6274B1EFc1804930f160A` | `3,305 bytes` | Matches `deployment-receipt-arch-a.json` |
| `NexusAMMNative.usdc()` | `0x407A...160A` (`0x3e413bee`) | `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | Verified immutable token link |
| `NexusAMMNative.receiptContract()` | `0x407A...160A` (`0xd435b3a3`) | `0x407A2609dfd5336a38D6274B1EFc1804930f160A` | Verified unified receipt authority |
| `NexusAMMNative.getReserves()` | `0x407A...160A` (`0x0902f1ac`) | `reservePOT = 0`, `reserveUSDC = 0` | Pool is unseeded (empty) |
| `NexusAMMNative.totalLiquidityShares()` | `0x407A...160A` (`0x87cd5b20`) | `0` | No LP positions minted yet |
| `TestUSDCMin.name()` / `symbol()` / `decimals()` | `0x6C3B...4002` | `"Portal Test USD"` / `"pUSDC"` / `6` | Matches contract source |
| `TestUSDCMin.totalSupply()` | `0x6C3B...4002` (`0x18160ddd`) | `0` | No faucet mints executed yet |
| `eth_getBalance(deployer)` | `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A` | `13,088,472,552,168,753,000 wei` (`13.088472 POT`) | Matches post-deployment receipt |
