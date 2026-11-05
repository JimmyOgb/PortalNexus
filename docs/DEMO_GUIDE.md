# PortalNexus — Judge Demo Guide & Video/Deck Production Checklist

This guide provides:
1. **Reproducible Local Walkthrough:** Exact steps a hackathon judge or reviewer can execute today on a clean clone.
2. **2.5-Minute Demo Video Script:** Structured for the official Portaldot Hacker House 2026 limit (**≤ 3 minutes**).
3. **Pitch Deck Outline & Production Checklist:** Ready to export to PDF for final DoraHacks submission.

---

## 1. Reproducible Judge Walkthrough (Works Today, Zero Gas Required)

### Step 1 — Start the Application Locally
```bash
git clone https://github.com/JimmyOgb/PortalNexus.git
cd PortalNexus
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Step 2 — Verify Live Dual-VM Telemetry (Top Bar & Hero Cards)
- **What appears on screen:**
  - Top status bar connects live to `wss://test-node-v3.portaldot.dev` (Substrate L0) and `https://test-evm-rpc-v3.portaldot.dev` (EVM Chain ID `420420777`).
  - Rolling block height cards show live Substrate height, EVM height, and the paired disparity offset ($\Delta = \text{Substrate} - \text{EVM}$, typically `0` or `±1` confirming lockstep block production).
  - Click **▼ Expand** on **"Deep Diagnostics, Cadence Offset Table & Blake2b Converter"** at the bottom to inspect the last 15 paired block observations, runtime version (`portaldot-v3 v3002`), and RPC latency in milliseconds.

### Step 3 — Inspect Cross-VM Account Derivation (`1. Cross-VM Map` Tab)
- **What to click:**
  - In Tab 1 (**`1. Cross-VM Map`**), click **`Preset: Verified Deployer (0xdC7f…8A2A)`**.
- **What appears on screen:**
  - The deterministic `pallet-revive` fallback SS58 address (`5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`) is computed in real time using `H160 || [0xEE; 12]` with SS58 Prefix `42` and a 2-byte `blake2b-512` checksum.
  - Click **`Preset: Reference Vector (0x1111…1111)`** to see the canonical test vector `5CT5jwBEAhveEjgiSCQbkaKcKcUyGT47FQKa1yyuvLR62v8j`.

### Step 4 — Inspect the Active V2 AMM (`3. Nexus AMM` Tab)
- Switch to **`3. Nexus AMM`**. The active registry entry is **NexusAMMNativeV2**, deployed at `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df`. V1 at `0x407A2609dfd5336a38D6274B1EFc1804930f160A` is legacy and must not be used for liquidity.
- Read reserves, token balances, LP position, and allowance from live RPC responses. If a live read is unavailable, report it as unavailable; a historical empty-pool snapshot does not establish current state.
- V2 source defines payable `addLiquidity(uint256 amountUSDCDesired,uint256 minAmountPOT,uint256 minAmountUSDC,uint256 deadline)`. Initial deposits require both minimums to be nonzero. The provider chooses the initial price by choosing the POT/pUSDC ratio. The frontend preview derives minimums from the selected slippage tolerance and sets a deadline. Never substitute zero minimums or reuse a stale quote.
- If approval is needed, the frontend prepares exact-amount `approve(V2, amountUSDC)` before `addLiquidity`; it does not request unlimited allowance. AMM submissions are disabled in this release, so neither prepared call can be submitted through the AMM UI.
- V2 also defines payable `swapExactPOTForTokens(uint256 minAmountOut,address to,uint256 deadline)`, `swapExactTokensForPOT(uint256 amountIn,uint256 minAmountOut,address to,uint256 deadline)`, and `removeLiquidity(uint256 tokenId,uint256 minAmountPOT,uint256 minAmountUSDC,address to,uint256 deadline)`. The frontend derives swap minimum output from its quote and selected slippage tolerance. Deadlines and minimums must be respected.
- Unsigned calldata and math are preparation only, not wallet confirmation, broadcast, receipt, or evidence of a completed swap. No successful liquidity or swap is claimed.
---

## 2. Concise 2.5-Minute Demo Video Script (≤ 3:00 Official Limit)

> **Status:** Outstanding deliverable — must be recorded and uploaded by the user before the November 5, 2026 final submission deadline.

| Timecode | Visual on Screen | Narration / Talking Points |
| :--- | :--- | :--- |
| **0:00 – 0:30** | Title slide / Hero view of PortalNexus (`http://localhost:5173`) showing the 3D Dual-VM Singularity and live block heights. | *"PortalNexus is a Dual-VM observability and native Constant-Product AMM terminal built for Portaldot V3.0. Moving from Polkadot Frontier to `pallet-revive` introduces two critical challenges for builders and users: completely different SS58↔H160 address mapping rules, and Substrate state-rent deposits bundled into EVM gas."* |
| **0:30 – 1:15** | Expand **Deep Diagnostics** drawer; then demonstrate Tab 1 (**`1. Cross-VM Map`**) toggling between `0x1111...1111` and Deployer `0xdC7f...8A2A`. | *"First, PortalNexus connects directly to Portaldot V3's Substrate WebSocket and `pallet-revive` EVM RPC in lockstep. Our audited `reviveMapper` derives the exact `AccountId32Mapper` 12-byte `0xEE`-padded SS58 address, preventing permanent fund loss caused by legacy Frontier hashing."* |
| **1:15 – 2:10** | Switch to Tab 3 (**`3. Nexus AMM`**). Identify V2, show current live reserve-read status, then inspect unsigned transaction preparation with the submission control disabled. | *"PortalNexus pairs native POT with pUSDC through the V2 constant-product AMM at `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df`. V2 enforces nonzero liquidity minimums and a deadline. Its 0.3% swap fee is applied by the contract. AMM writes remain disabled; no liquidity or successful swap is claimed. The older V1 deployment is retained as legacy and is not the liquidity route."* |
| **2:10 – 2:30** | Show terminal running `npm test` (66 Vitest passing) and `npm run test:contracts` (46 Hardhat passing). | *"Every math invariant, ABI selector, and RPC parser is backed by 112 automated tests across Hardhat and Vitest. Transaction submission is fail-closed while the deployer wallet awaits additional `tPOT` for post-deployment state deposits. Thank you!"* |

---

## 3. Pitch Deck Checklist (Outstanding Deliverable)

Create a 7-slide PDF deck using the verified data in this repository:
1. **Slide 1 — Title & One-Line Pitch:** PortalNexus — Dual-VM Observability & Native POT AMM for Portaldot V3 (`pallet-revive`).
2. **Slide 2 — The Problem on Portaldot V3:**
   - Legacy Frontier address converters (`evmToAddress`) burn funds on `pallet-revive`.
   - Naive multi-contract DeFi suites cost >1,000 POT in `pallet-revive` bytecode state rent (`0.0589 POT/byte`).
3. **Slide 3 — Our Solution (PortalNexus + Architecture A):**
   - Deterministic `AccountId32Mapper` (`H160 || 0xEE...12`) inspector + real-time Dual-VM block cadence monitor.
   - `NexusAMMNativeV2.sol`: Active native POT / `pUSDC` constant-product AMM with nonzero initial minimums, deadlines, and unified LP position receipts. Legacy V1 remains historical.
4. **Slide 4 — Architecture Diagram:** Embed the diagram from [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
5. **Slide 5 — On-Chain Proof & Test Verification:**
   - `TestUSDCMin`: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Block `#237279`, tx `0x45346086...`)
   - `NexusAMMNativeV2`: `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df` (Block `#333609`; see deployment receipt in `contracts/deployment-receipt-amm-v2.json`)
   - `NexusAMMNative` V1 is legacy at `0x407A2609dfd5336a38D6274B1EFc1804930f160A`; its deployed code ignores initial minimum amounts.
   - 112 Automated Tests Passing (46 Hardhat + 66 Vitest).
6. **Slide 6 — Honest Current State & `pallet-revive` Economics:**
   - V2 is deployed and its deployment record is historical evidence only. Current pool reserves, deployer balance, and storage-deposit estimates require fresh read-only RPC results; do not present earlier values as current. No faucet, approval, liquidity, or swap transaction is claimed.
7. **Slide 7 — Post-Hackathon Roadmap & Ecosystem Impact:** Reusable MIT-licensed `reviveMapper`, RPC clients, and compact DeFi primitives for all Portaldot V3 builders.
