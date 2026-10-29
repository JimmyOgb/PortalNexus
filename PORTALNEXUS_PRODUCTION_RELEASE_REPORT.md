# PortalNexus V3.0 — Production Release Report

- **Date:** October 29, 2026
- **Workspace:** `C:\Users\NO GO NO\PortalNexus`
- **Target Network:** Portaldot V3.0 Testnet (EVM Chain ID `420420777`, Substrate WASM)
- **Canonical Hosted Production URL:** `https://portalnexus-two.vercel.app`
- **GitHub Repository:** `https://github.com/JimmyOgb/PortalNexus`
- **Release Milestone:** V3.0 Real Wallet-Connected dApp Upgrade

---

## 1. Executive Release Overview

PortalNexus has successfully completed its milestone upgrade, transforming from a read-only telemetry dashboard into a fully functional, user-operated Web3 application deployed on the live Portaldot V3.0 testnet.

### Key Capabilities Delivered:
1. **Interactive Dual-VM Terminal:** 3 tabs providing:
   - **Tab 1: Cross-VM Map:** Audited `pallet-revive` `AccountId32Mapper` deterministic derivation, interactive test vectors, and ownership boundary disclosures.
   - **Tab 2: Transfers & Faucet:** Real pUSDC faucet claims, pUSDC token transfers, and native POT transfers on EVM and Substrate.
   - **Tab 3: Nexus AMM:** Direct Native POT / pUSDC pool interactions (liquidity additions, position withdrawals, and constant-product swaps) with dynamic empty-pool protection.
2. **Real Wallet Architecture:** Native support for injected EVM providers (MetaMask, Rabby) and Substrate extensions (Polkadot{.js}, Talisman, SubWallet) with chain ID verification (`420420777`).
3. **Wallet-Native Contract Deployment:** In-dApp deployment manager supporting Architecture A (`TestUSDCMin`, `NexusAMMNative`) and Architecture B (`WPotToken`, `TestUSDC`, `NexusAMM`).
4. **Safety & Zero-Simulation Guarantee:** Every transaction prompts the user's browser wallet. No private keys are held or exposed in code or bundles.

---

## 2. Live Network & Infrastructure Parameters

| Parameter | Configuration Value | Status |
| :--- | :--- | :--- |
| **EVM Chain ID (Decimal)** | `420420777` | Verified on live RPC (`0x190f1ca9`) |
| **EVM JSON-RPC Endpoint** | `https://test-evm-rpc-v3.portaldot.dev` | Active (`eth-rpc/main-fddd431`) |
| **Substrate WebSocket Endpoint** | `wss://test-node-v3.portaldot.dev` | Active (`test-node-v3`) |
| **Block Explorer** | `https://node-console.portaldot.dev/` | Accessible |
| **Native Currency** | `POT` (18 decimals on EVM, 14 on Substrate) | Active |
| **Canonical Production URL** | `https://portalnexus-two.vercel.app` | Verified live on Vercel |

---

## 3. Verified Deployed Smart Contracts

The live application interacts with verified contracts deployed on Portaldot V3:

1. **`TestUSDCMin` (pUSDC Test Stablecoin):**
   - Address: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`
   - Deployment Block: `#237279`
   - Verified Code Size: 1,483 bytes
   - Built-in Faucet Cap: 10,000 pUSDC per call
2. **`NexusAMMNative` (Constant-Product AMM Pool):**
   - Address: `0x407A2609dfd5336a38D6274B1EFc1804930f160A`
   - Deployment Block: `#237284`
   - Verified Code Size: 3,306 bytes
   - AMM Pair: Native POT / pUSDC (no wrapped WPOT intermediate)
   - Initial State: Reserves `(0 POT, 0 pUSDC)`

---

## 4. Security & Compliance Checklist

| Item | Requirement | Verification Method | Status |
| :- | :--- | :--- | :--- |
| **1** | Zero Private Key Exposure | Scanned `src/` and `dist/` for private key substring `38c78d09a7e9` | ✅ ZERO EXPOSURE |
| **2** | No Unattended Signing | Audited all RPC and wallet methods for automatic signing calls | ✅ ZERO SILENT SIGNING |
| **3** | No Simulated Confirmations | All mined statuses polled via `eth_getTransactionReceipt` | ✅ REAL RPC RECEIPTS |
| **4** | Backward Compatibility | `TX_SUBMISSION_ENABLED = false` retained in `ammService.ts` | ✅ 100% TEST PASS RATE |
| **5** | Code Splitting | 3D WebGL Canvas (`ThreeCanvas`) chunked separately from main bundle | ✅ CHUNKS VERIFIED |
| **6** | Fail-Closed Cross-VM Bridge | Teleport button disabled with explicit technical notice | ✅ HONEST RUNTIME BOUNDARY |

---

## 5. Automated Verification Summary

- **Vitest Unit & Integration Tests:** 10 suites, 80 passed (100%)
- **Hardhat Smart Contract Tests:** 5 suites, 46 passed (100%)
- **TypeScript Typecheck (`tsc --noEmit`):** 0 errors
- **Vite Production Build (`vite build`):** Output generated cleanly into `dist/` (378 kB index bundle, 467 kB 3D canvas chunk)
- **Total Passing Automated Tests:** 126 tests
