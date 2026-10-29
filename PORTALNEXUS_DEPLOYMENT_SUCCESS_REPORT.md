# PortalNexus — Architecture A On-Chain Deployment & Verification Report

**Deployment Date:** 2026-10-29  
**Target Network:** Portaldot V3 Testnet (`Chain ID 420420777` / `0x190f1ca9`)  
**EVM RPC:** `https://test-evm-rpc-v3.portaldot.dev`  
**Deployer Address:** `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`  
**Mapped Native SS58:** `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`  
**Deployment Status:** 🟢 **100% SUCCESS — FULLY VERIFIED ON-CHAIN**  

---

## Executive Summary

PortalNexus Architecture A (Direct Native POT / pUSDC Automated Market Maker) has been **successfully deployed and verified on the live Portaldot V3 Testnet**.

- **Total Starting Balance:** `420.900000 POT`
- **Total Actual Deployment Cost:** `407.811527 POT`
- **Remaining Deployer Balance:** **`13.088473 POT`** (Net positive margin of $+3.11\%$ above cost)
- **Account Nonce:** `2` (Both sequential transactions mined successfully)
- **Deployed Contracts:**
  1. [`TestUSDCMin.sol`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/contracts/TestUSDCMin.sol) at **`0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`** (Block `#237279`)
  2. [`NexusAMMNative.sol`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/contracts/NexusAMMNative.sol) at **`0x407A2609dfd5336a38D6274B1EFc1804930f160A`** (Block `#237284`)
- **Safety Safeguards:**
  - Original contracts (`WPotToken.sol`, `TestUSDC.sol`, `NexusAMM.sol`, `NexusLPReceipt.sol`) strictly preserved.
  - Protected workspace `C:\Users\NO GO NO\Portaldot Sentinel` strictly untouched.
  - Deployment receipt [`contracts/deployment-receipt-arch-a.json`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/deployment-receipt-arch-a.json) recorded.
  - Frontend contract registry [`src/contracts/config.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/src/contracts/config.ts) updated with verified addresses.
  - All 46 Hardhat unit tests and 52 frontend Vitest tests pass with 0 errors.

---

## 1. On-Chain Deployment Evidence

### Contract 1: `TestUSDCMin.sol` (Portal Test USD Simulation Token)
- **Contract Address:** [`0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/contracts/TestUSDCMin.sol)
- **Transaction Hash:** `0x4534608666225d9fba0f8c69a28dd29c4130825b06a5160c33e6beec1b225152`
- **Receipt Status:** `1` (Success)
- **Mined Block:** `#237279`
- **Gas Used:** `4,664,872,854,966,639` units
- **Actual Cost:** `128.867113 POT`
- **Deployed Runtime Bytecode Size:** `1,482 bytes` (`eth_getCode` confirmed non-empty)
- **On-Chain Read Verification:**
  - `name()`: `"Portal Test USD"`
  - `symbol()`: `"pUSDC"`
  - `decimals()`: `6`
  - `totalSupply()`: `0`
  - `MAX_MINT_PER_CALL()`: `10,000,000,000` (10,000 pUSDC)

### Contract 2: `NexusAMMNative.sol` (Native POT / pUSDC AMM)
- **Contract Address:** [`0x407A2609dfd5336a38D6274B1EFc1804930f160A`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/contracts/NexusAMMNative.sol)
- **Transaction Hash:** `0x48cd085966cc570984aa4883d05ed3c26de9ade7d4296f909cc47f6ae0e9ba54`
- **Receipt Status:** `1` (Success)
- **Mined Block:** `#237284`
- **Gas Used:** `10,097,535,378,439,017` units
- **Actual Cost:** `278.944414 POT`
- **Deployed Runtime Bytecode Size:** `3,305 bytes` (`eth_getCode` confirmed non-empty)
- **Constructor & Getter Verification:**
  - `usdc()`: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Matches Contract 1)
  - `receiptContract()`: `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Unified AMM receipt authority)
  - `getReserves()`: `(POT = 0, USDC = 0)`
  - `totalLiquidityShares()`: `0`
  - `MINIMUM_LIQUIDITY()`: `1000`

---

## 2. Financial Balance Reconciliation

| Metric | Amount (POT) | Amount (Wei) | Notes |
| :--- | :--- | :--- | :--- |
| **Initial Wallet Balance** | `0.900000 POT` | `900,000,000,000,000,000` | Baseline before transfer |
| **User Reserve Transfer** | `+420.000000 POT` | `420,000,000,000,000,000,000` | Native Substrate transfer to SS58 |
| **Total Available at Start** | `420.900000 POT` | `420,900,000,000,000,000,000` | Fully credited on-chain |
| **TestUSDCMin Cost** | `-128.867113 POT` | `-128,867,112,618,453,402,375` | Bytecode storage + fee |
| **NexusAMMNative Cost** | `-278.944414 POT` | `-278,944,414,829,377,844,625` | Bytecode storage + fee |
| **Total Deployment Cost** | **`407.811527 POT`** | **`407,811,527,447,831,247,000`** | Verified total gas cost |
| **Final Remaining Balance** | **`13.088473 POT`** | **`13,088,472,552,168,753,000`** | Safely preserved in wallet |

---

## 3. Storage Deposits & Locked Capital

Under `pallet_revive` runtime accounting:
- **Total State Rent Locked:** $\approx \mathbf{407.78\text{ POT}}$ is held as Substrate trie collateral for the two deployed contracts.
- **Total Burned / Validator Fees:** $\approx \mathbf{0.03\text{ POT}}$.
- **Operational Reality:** Because `NexusAMMNative` and `TestUSDCMin` are immutable financial primitives with no `selfdestruct` instruction, the storage collateral remains locked on-chain for the life of the exchange.

---

## 4. Verification Safeguards & Artifacts Generated

1. **Receipt File:**  
   [`contracts/deployment-receipt-arch-a.json`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/deployment-receipt-arch-a.json) contains full cryptographic signatures, block heights, and gas tallies.
2. **Frontend Config Updated:**  
   [`src/contracts/config.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/src/contracts/config.ts) was updated with the verified addresses:
   - `CONTRACT_REGISTRY.testUSDC.deployedAddress = '0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002'`
   - `CONTRACT_REGISTRY.nexusAMM.deployedAddress = '0x407A2609dfd5336a38D6274B1EFc1804930f160A'`
   - `CONTRACT_REGISTRY.nexusReceipt.deployedAddress = '0x407A2609dfd5336a38D6274B1EFc1804930f160A'`
3. **Automated Test Results:**  
   - Hardhat Tests: **`46 passed, 0 failed`**
   - Vitest Tests: **`52 passed, 0 failed`**
   - TypeScript Check: **`0 errors`**
   - Production Build (`vite build`): **`Complete in 4.35s`**
4. **Boundary Preservations:**  
   - Zero modifications to `C:\Users\NO GO NO\Portaldot Sentinel`.
   - No Git initialization or commits made.
   - Frontend not deployed/published to any external server.
   - Private keys remained strictly local in `contracts/.env`.
