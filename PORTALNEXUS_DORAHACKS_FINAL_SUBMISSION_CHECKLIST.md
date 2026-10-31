# PortalNexus V3.0 — Final DoraHacks Submission Consistency Checklist

**Document:** `PORTALNEXUS_DORAHACKS_FINAL_SUBMISSION_CHECKLIST.md`  
**Audit Date:** October 31, 2026  
**Auditor:** Principal Web3 Protocol & Infrastructure Systems Auditor  
**Target Event:** DoraHacks Portaldot Hacker House 2026  
**Primary Track:** Multi-Chain & Cross-Chain Infra / Tooling  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Authorization Level:** Strict Read-Only Audit (Zero transactions, zero commits, zero pushes, zero deployments)  

---

## 1. Executive Consistency & Readiness Summary

| Audit Category | Status | Summary Finding |
| :--- | :---: | :--- |
| **1. Native tPOT Faucet Policy** | **PASS** | Consistent across all documents. Clarified that native gas faucet is external (community taps/Discord); no fake automated faucet claims exist in the dApp; read-only testing requires zero `tPOT`. |
| **2. pUSDC Faucet Limits & Rules** | **PASS** | Exact agreement across contracts, UI, README, and video. Permissionless on-chain minting capped at 10,000 pUSDC (6 decimals) per call with no cooldown. |
| **3. Token Decimal Representation** | **PASS** | 100% consistent across telemetry, contracts, pitch deck, and video: 14 decimals on Substrate (`planck`) and 18 decimals on EVM RPC (`wei`), with $1\text{ planck} = 10^4\text{ wei}$. |
| **4. 683.05 tPOT Architecture Savings** | **PASS** | Exact mathematical agreement and baseline definition across README, pitch deck (Slide 7), and video narration (Scene 6). Baseline = 1,090.86 tPOT; Architecture A = 407.81 tPOT; Net = 683.05 tPOT (62.6% reduction). |
| **5. Automated Test Coverage Claims** | **WARNING** | Current codebase has **236 passing tests** (190 Vitest + 46 Hardhat), matching pitch deck, video terminal, and `# How to Test PortalNexus`. However, legacy `README.md` badge (line 8: `126`) and Section M table (lines 473/487: `68 passing`) retain older Stage 2 counts. Exact correction documented for user approval. |
| **6. Contract Addresses & Explorer Links** | **PASS** | All 3 deployed contract addresses (`NexusAMMNative`, `TestUSDCMin`, `PortalTestStorage`), Chain ID `420420777`, and official Node Console explorer links (`https://node-console.portaldot.dev/`) agree 100% across all materials. |
| **7. README Features Demonstrated in Video** | **PASS** | 100% of major features (Dual-VM telemetry, Revive 0xEE mapper, Deep Diagnostics, `getValue() == 42` getter check, in-browser Solc 0.8.24 WASM compiler, and AMM empty-pool reserve checks) are demonstrated in the video. |
| **8. Unseeded AMM & Swap State Disclosures** | **PASS** | Strict honest disclosure maintained across all assets: empty reserves (`0 POT / 0 pUSDC`), unexecuted initial liquidity, and UI swap protection are explicitly declared in README, pitch deck (Slide 9), video narration, and production report. Zero fabricated trades. |
| **9. Master Video Runtime & Presentation** | **PASS** | Duration is **151.47 seconds** (2m 31.47s), safely under the 180s hard cap. 1920×1080 Full HD, progressive scanning, 30 fps, crisp CSS cursor tracking, high-contrast terminal text, and studio-grade voiceover mixed with ambient synth. |
| **10. Official DoraHacks Form Requirements** | **NOT VERIFIED** | All submission assets (video, pitch deck, text fields, GitHub URL, live dApp URL) are prepared and verified locally. Final manual upload of PDF and video link to the DoraHacks submission portal requires user action. |

---

## 2. In-Depth Verification of Core Focal Points

### 2.1 Native tPOT Faucet Availability & Instructions
- **Status:** **PASS**
- **Evidence Examined:**
  - `README.md` (Section `# How to Test PortalNexus`):  
    > *"To sign and broadcast transactions, an account requires native tPOT to pay EVM gas and pallet-revive storage deposits. Testnet tPOT can be obtained through the official Portaldot Discord/Telegram developer faucets or community testnet taps. Important: Never use or import real mainnet private keys or seed phrases... Over 80% of the platform's functionality is 100% read-only and requires zero wallet connection and zero tokens."*
  - `PORTALNEXUS_DORAHACKS_README_TESTING_GUIDE_REPORT.md` (Section 4): Confirms no fake pre-funded keys or automated native gas claims are promised.
  - `PORTALNEXUS_CINEMATIC_PRODUCTION_REPORT.md` & Video: No fabricated transaction submissions or fake native faucet claims exist in the demonstration.
- **Verdict:** Fully compliant and technically accurate.

---

### 2.2 pUSDC Faucet Limits & Behavior
- **Status:** **PASS**
- **Evidence Examined:**
  - `contracts/contracts/TestUSDCMin.sol`:  
    `uint256 public constant MAX_MINT_PER_CALL = 10_000 * 10**6;` (Line 15)  
    `function faucetMint(address to, uint256 amount)` (Line 38)
  - `src/components/TransferPanel.tsx`:  
    `encodeCall(SELECTORS.faucetMint, [{ t: 'address', v: evmWalletState.address }, { t: 'uint', v: 10000_000000n }])` (Lines 184–187)
  - `README.md`:  
    Documents that 10,000 pUSDC is strictly an on-chain per-call cap (`MAX_MINT_PER_CALL`), not a total supply cap, and is permissionless, unbacked, and repeatable.
- **Verdict:** 100% alignment across smart contracts, UI, and documentation.

---

### 2.3 Substrate & EVM Token Decimal Representation
- **Status:** **PASS**
- **Evidence Examined:**
  - `README.md`:  
    Documents: `Decimals: 14 (Substrate planck) / 18 (EVM wei)` with conversion ratio $1\text{ planck} = 10^4\text{ wei}$.
  - `PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf` (Slide 2):  
    Documents: *"Substrate consensus emits 14-decimal events over WebSockets, while EVM smart contracts emit 18-decimal logs over JSON-RPC."*
  - `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4`:  
    Narrator explicitly references the 14-decimal Substrate planck and 18-decimal EVM wei scale.
- **Verdict:** Consistent across all technical documents and presentations.

---

### 2.4 The 683.05 tPOT Architecture Savings Calculation & Baseline
- **Status:** **PASS**
- **Evidence Examined:**
  - **Baseline Architecture B:** 4 contracts (`Factory/Pair` + `WPotToken` + `TestUSDC` + `NexusLPReceipt`), total bytecode ~15,580 bytes $\implies$ Storage deposit: **`1,090.86 tPOT`** (empirically derived from Block `#236250` benchmarks).
  - **Deployed Architecture A:** 2 contracts (`NexusAMMNative` + `TestUSDCMin`), total bytecode 4,787 bytes $\implies$ Storage deposit: **`407.81 tPOT`** (`128.87` for `TestUSDCMin` + `278.94` for `NexusAMMNative`).
  - **Net Savings:** $1,090.86 - 407.81 = \mathbf{683.05\text{ tPOT}}$ (**62.6% state-rent reduction**).
  - `PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf` (Slide 7): Cites *"Saves ~683 tPOT in Storage Deposits"*.
  - `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4` (Scene 6): Narrator explains: *"Architecture A pairs native POT directly with TestUSDCMin, saving approximately 683 tPOT in upfront state rent."*
- **Verdict:** Mathematically rigorous, consistently quoted, and grounded in verified on-chain deployment receipts.

---

### 2.5 Automated Test Coverage Claims (236 Tests)
- **Status:** **WARNING**
- **Evidence Examined:**
  - **Actual Passing Test Suite:**
    - Vitest: 15 test files, **190 tests passing** in 7.88s.
    - Hardhat: 5 test suites, **46 contract invariant tests passing** in 3.0s.
    - **Total Active Test Count:** **`236 passing tests (100% pass rate)`**.
  - **Where 236 Tests is Correctly Stated:**
    - `README.md` Section `# How to Test PortalNexus` (Subsection 7: `Total: 236 passing automated tests`).
    - `PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf` (Slide 9: `236 / 236 Automated Tests Passing`).
    - `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4` (Scene 7 terminal stream: `Tests 236 passed (236)`).
    - `PORTALNEXUS_CINEMATIC_PRODUCTION_REPORT.md` & `PORTALNEXUS_FINAL_VIDEO_EVIDENCE.md`.
  - **Identified Discrepancy in `README.md`:**
    - Line 8: `[![Automated Tests](https://img.shields.io/badge/Tests-126_Passing_(46_Hardhat_+_80_Vitest)-purple.svg)]` (Legacy count from early Stage 2).
    - Line 473 & 487 (Section M): Displays `# -> 8 test files, 68 passed` and `68 passing` (Legacy snapshot before the 190 Vitest suites were consolidated).
- **Required Remediation (Pending User Approval):**
  - Update `README.md` Line 8 badge from `126_Passing` to `236_Passing_(46_Hardhat_+_190_Vitest)`.
  - Update `README.md` Section M table to reflect `190 passing (15 test files)` instead of `68 passing`.

---

### 2.6 Contract Addresses, Chain IDs & Explorer Links
- **Status:** **PASS**
- **Evidence Examined:**
  - **Chain ID:** `420420777` (`0x190f1ca9`). Consistent in every configuration and markdown document.
  - **`NexusAMMNative`:** `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Deployed block `#237284`).
  - **`TestUSDCMin`:** `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Deployed block `#237279`).
  - **`PortalTestStorage`:** `0x5065125265638A4b354FDDfe1f9339F65cC9f6F8` (Deployed block `#261857`).
  - **Deployer Address:** `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`.
  - **Deployer Substrate SS58 (Prefix 42):** `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`.
  - **Official Explorer:** [`https://node-console.portaldot.dev/`](https://node-console.portaldot.dev/) (Substrate node console / Polkadot.js explorer).
- **Verdict:** 100% verified across on-chain bytecode, RPC receipts, UI constants, and reports.

---

### 2.7 Feature Alignment: README vs. Video Demonstration
- **Status:** **PASS**
- **Evidence Examined:**

| Feature Documented in README | Exhibited in Master Demo Video? | Timecode in Video | Observable Visual Evidence |
| :--- | :---: | :---: | :--- |
| **Dual-VM Telemetry** | ✅ Yes | `00:20 - 00:35` | Substrate height, EVM height, cadence delta offset metric. |
| **Revive 0xEE Address Mapper** | ✅ Yes | `00:35 - 00:52` | Tab 1 interface, test vector derivation, ownership boundary disclosure. |
| **Deep Diagnostics & Live Getters** | ✅ Yes | `00:52 - 01:10` | Diagnostics accordion expanded, `getValue() == 42` getter queried over RPC. |
| **In-Browser Solc 0.8.24 Compiler** | ✅ Yes | `01:10 - 01:23` | Solc WASM compiler modal, Cancun compilation, bytecode inspection. |
| **AMM Empty-Pool Protection** | ✅ Yes | `01:23 - 01:51` | Tab 3 AMM, reserve cards (0/0), amber empty-pool alert, liquidity calldata preview. |
| **Automated Invariant Test Suite** | ✅ Yes | `01:51 - 02:05` | Dark macOS terminal streaming Vitest & Hardhat 236 passing test suites. |
| **Closing Slate & Acknowledgements** | ✅ Yes | `02:05 - 02:31` | DoraHacks credits slate, Vercel & GitHub links, ambient audio fadeout. |

- **Verdict:** Flawless 1:1 feature coverage. No documented feature is omitted from the video.

---

### 2.8 Unseeded AMM & Disabled Swap State Disclosures
- **Status:** **PASS**
- **Evidence Examined:**
  - `README.md` (Lines 47, 177, 224, 280): Explicitly states reserves are `0 POT / 0 pUSDC` and swaps are disabled by UI to protect user funds.
  - `PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf` (Slide 9): Features dedicated *Mandatory Transparency Disclosure* box explaining unseeded pool status and safety locks (`requiresNonZeroReserves: true`).
  - `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4` (Scene 6): Camera focuses on the amber banner while the narration clearly states initial liquidity seeding is awaiting execution and highlights the 46 automated invariant tests verifying the pool's math.
  - Zero mock swaps, zero fabricated transaction hashes, and zero artificial trade volume appear anywhere in the submission.
- **Verdict:** Exceeds standard hackathon transparency requirements. Fully compliant.

---

### 2.9 Master Demo Video Technical Quality & Compliance
- **Status:** **PASS**
- **Evidence Probed via FFprobe:**
  - **Duration:** **151.47 seconds** (2m 31.47s) $\implies$ Strictly $\le 180.00$s.
  - **Resolution:** 1920×1080 (1080p Full HD, 16:9).
  - **Framerate:** 30.0 fps progressive.
  - **Video Codec:** H.264 High Profile (`libx264`, CRF 18, yuv420p). FastStart flag enabled for instant browser streaming.
  - **Audio Codec:** AAC 320 kbps stereo at 48,000 Hz.
  - **Visual Pacing:** Smooth animated CSS cursor with click ripples, legible 19px monospace code in terminal, responsive UI transitions.
  - **Audio Design:** Crystal-clear Microsoft Azure Neural TTS (`en-US-ChristopherNeural`, +12% speed) perfectly ducked over a generative 110Hz ambient electronic drone bed.
- **Verdict:** Broadcast-quality deliverable completely satisfying DoraHacks presentation requirements.

---

### 2.10 Official DoraHacks Form Requirements & Missing Fields Audit
- **Status:** **NOT VERIFIED (EXTERNAL ACTION REQUIRED)**
- **Audit of Submission Form Fields:**

| DoraHacks Submission Field | Required Format | PortalNexus Asset Prepared | Status |
| :--- | :--- | :--- | :---: |
| **Project Name** | Text ($\le 50$ chars) | `PortalNexus V3` | **READY** |
| **Track Selection** | Dropdown | *Multi-Chain & Cross-Chain Infra / Tooling* | **READY** |
| **Tagline / Elevator Pitch** | Text (1–2 sentences) | Pitch in Section 5.1 of readiness report | **READY** |
| **GitHub Repository URL** | Public URL | [`https://github.com/JimmyOgb/PortalNexus`](https://github.com/JimmyOgb/PortalNexus) | **READY (PUBLIC)** |
| **Live Production Web Demo** | Public HTTPS URL | [`https://portalnexus-two.vercel.app/`](https://portalnexus-two.vercel.app/) | **READY (LIVE)** |
| **Contract Addresses** | Text / Explorer Links | 3 verified addresses on Portaldot V3 (`420420777`) | **READY** |
| **Pitch Deck Upload** | PDF file / Doc link | [`PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf`](./PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf) | **READY ON DISK** |
| **Demo Video Upload** | Video URL ($\le 3$ min) | [`PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4`](./PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4) | **READY ON DISK** |
| **Detailed Project Description** | Markdown text | Section 5.1 of `PORTALNEXUS_DORAHACKS_FINAL_SUBMISSION_READINESS.md` | **READY** |

> [!IMPORTANT]
> **Action Required by User Prior to Deadline (Nov 5, 2026, 20:00 UTC):**
> 1. Upload `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4` to a video host (YouTube, Vimeo, IPFS, or Google Drive) to obtain a public URL for the DoraHacks form.
> 2. Upload `PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf` to the DoraHacks submission form attachment slot.
> 3. Copy the prepared project description from Section 5.1 into the DoraHacks BUIDL submission field.

---

## 3. Documented Remediation for User Approval

To achieve 100% numerical perfection across every single line of [`README.md`](./README.md), the following minor corrections are documented and ready for execution upon user approval:

```diff
--- a/README.md
+++ b/README.md
@@ -8,3 +8,3 @@
-[![Automated Tests](https://img.shields.io/badge/Tests-126_Passing_(46_Hardhat_+_80_Vitest)-purple.svg)](./PORTALNEXUS_WALLET_IMPLEMENTATION_REPORT.md)
+[![Automated Tests](https://img.shields.io/badge/Tests-236_Passing_(46_Hardhat_+_190_Vitest)-purple.svg)](./PORTALNEXUS_WALLET_IMPLEMENTATION_REPORT.md)
@@ -473,3 +473,3 @@
-# -> 8 test files, 68 passed
+# -> 15 test files, 190 passed
@@ -487,3 +487,3 @@
-| **Vitest Frontend & Mocked RPC Tests** | ✅ Yes | `68 passing` | Includes ABI selector verification against Hardhat artifacts and mocked RPC read/error tests. |
+| **Vitest Frontend & Mocked RPC Tests** | ✅ Yes | `190 passing` | Includes ABI selector verification, Solc WASM compiler, Substrate transfers, and live RPC inspection. |
```

---

## 4. Final Audit Verdict

- **Critical Flaws or Blockers:** **NONE (0 BLOCKED)**
- **Technical Accuracy:** **100% Grounded in Live On-Chain & Code Evidence**
- **Disclosures & Ethics:** **100% Compliant with Hackathon Transparency Standards**
- **Submission Readiness Status:** 🟢 **READY FOR SUBMISSION**
