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

### Step 4 — Inspect Live AMM Contract State & Calldata Preparation (`2. Nexus AMM (native POT)` Tab)
- **What to click:**
  - Switch to Tab 2 (**`2. Nexus AMM (native POT)`**).
- **What appears on screen (Live RPC Reads):**
  - Verified deployed contract addresses and deployment blocks (`NexusAMMNative` at `0x407A2609dfd5336a38D6274B1EFc1804930f160A` `#237284`, `TestUSDCMin` at `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` `#237279`).
  - Live `getReserves()` result: `0.00 POT` and `0.00 pUSDC`, `0` LP shares, and `0.00 pUSDC` total supply on-chain.
  - Honest empty-pool disclosure: *"The pool has zero reserves. Trading is unavailable until liquidity is added."*
- **Interactive Calldata & Math Preview (No Wallet or Broadcast Required):**
  1. Click **`Preview Initial Liquidity Calldata (0.5 POT + 10 pUSDC) →`**.
  2. The panel switches to **`Add`** mode with `0.5` POT and `10` pUSDC pre-filled.
  3. Inspect the live confirmation breakdown:
     - First-deposit share calculation: $\lfloor\sqrt{0.5 \times 10^{18} \times 10 \times 10^6}\rfloor - 1000 = \mathbf{2,236,067,976,499\text{ shares}}$ (`1000` shares permanently locked).
     - **Tx 1:** Exact-amount `approve(0x407A...160A, 10000000)` on `pUSDC` (`0x6C3B...4002`), selector `0x095ea7b3`.
     - **Tx 2:** Payable `addLiquidity(10000000, 0, 0, deadline)` on `NexusAMMNative` (`0x407A...160A`), `value: 0x6f05b59d3b20000` (`0.5 POT`), selector `0xaebf3e41`.
  4. Switch to **`Faucet`** and enter `100` to inspect the prepared `faucetMint(recipient, 100000000)` calldata (`0xa5c51274...`).
  5. Confirm that the submit button remains safely disabled (*"Transaction submission disabled in this build — preparation only"*).

---

## 2. Concise 2.5-Minute Demo Video Script (≤ 3:00 Official Limit)

> **Status:** Outstanding deliverable — must be recorded and uploaded by the user before the November 5, 2026 final submission deadline.

| Timecode | Visual on Screen | Narration / Talking Points |
| :--- | :--- | :--- |
| **0:00 – 0:30** | Title slide / Hero view of PortalNexus (`http://localhost:5173`) showing the 3D Dual-VM Singularity and live block heights. | *"PortalNexus is a Dual-VM observability and native Constant-Product AMM terminal built for Portaldot V3.0. Moving from Polkadot Frontier to `pallet-revive` introduces two critical challenges for builders and users: completely different SS58↔H160 address mapping rules, and Substrate state-rent deposits bundled into EVM gas."* |
| **0:30 – 1:15** | Expand **Deep Diagnostics** drawer; then demonstrate Tab 1 (**`1. Cross-VM Map`**) toggling between `0x1111...1111` and Deployer `0xdC7f...8A2A`. | *"First, PortalNexus connects directly to Portaldot V3's Substrate WebSocket and `pallet-revive` EVM RPC in lockstep. Our audited `reviveMapper` derives the exact `AccountId32Mapper` 12-byte `0xEE`-padded SS58 address, preventing permanent fund loss caused by legacy Frontier hashing."* |
| **1:15 – 2:10** | Switch to Tab 2 (**`2. Nexus AMM (native POT)`**). Point out the deployed contract addresses, live `getReserves()` read, and click **`Preview Initial Liquidity Calldata`**. | *"Second, we engineered Architecture A specifically for `pallet-revive` state-rent economics. By pairing native POT directly with `pUSDC` and embedding ERC-721 LP receipts inside `NexusAMMNative`, we cut deployment state rent from 1,090 POT down to 407.81 POT. Both contracts are deployed and verified on Portaldot V3 Testnet at blocks 237,279 and 237,284. Here you can see live on-chain reserve reads and our exact two-step `approve` and `addLiquidity` calldata generator."* |
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
   - `NexusAMMNative.sol`: Direct Native POT / `pUSDC` constant-product pool with unified ERC-721 LP receipts (`62.6%` state-rent reduction).
4. **Slide 4 — Architecture Diagram:** Embed the diagram from [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
5. **Slide 5 — On-Chain Proof & Test Verification:**
   - `TestUSDCMin`: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Block `#237279`, tx `0x45346086...`)
   - `NexusAMMNative`: `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Block `#237284`, tx `0x48cd0859...`)
   - 112 Automated Tests Passing (46 Hardhat + 66 Vitest).
6. **Slide 6 — Honest Current State & `pallet-revive` Economics:**
   - Contracts deployed & live reads active; pool reserves currently `0 / 0` because initial storage-slot creation (`balanceOf`, `allowance`, `_positions[1]`) requires ~25–30 POT in state rent vs `13.088 POT` remaining in deployer wallet.
7. **Slide 7 — Post-Hackathon Roadmap & Ecosystem Impact:** Reusable MIT-licensed `reviveMapper`, RPC clients, and compact DeFi primitives for all Portaldot V3 builders.
