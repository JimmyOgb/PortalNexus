# PortalNexus — Official Hackathon Requirements Audit

**Audit Date:** 2026-10-29  
**Event:** Portaldot Hacker House 2026 (DoraHacks Hackathon `#2362`)  
**Primary Official Source:** `https://dorahacks.io/hackathon/2362/detail`  
**Organizer:** Portaldot Network Ecosystem Foundation  
**Target Repository:** `https://github.com/JimmyOgb/PortalNexus`  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`

---

## 1. Sources Checked & Verification Notes

| Source | URL / Identifier | Date Checked | Access / Verification Method |
| :--- | :--- | :--- | :--- |
| **DoraHacks Event Page** | `https://dorahacks.io/hackathon/2362/detail` | 2026-10-29 | Search index grounding & DoraHacks page metadata (direct HTTP GET returns AWS WAF `405` challenge; indexed event rules retrieved and verified via search grounding). |
| **Portaldot V3 EVM RPC** | `https://test-evm-rpc-v3.portaldot.dev` | 2026-10-29 | Live JSON-RPC 2.0 queries (`eth_chainId`, `eth_blockNumber`, `eth_getCode`, `eth_call`). |
| **Portaldot V3 Substrate WS** | `wss://test-node-v3.portaldot.dev` | 2026-10-29 | Live WebSocket JSON-RPC handshake (`system_chain`, `state_getRuntimeVersion`, `system_properties`). |
| **Target GitHub Repository** | `https://github.com/JimmyOgb/PortalNexus` | 2026-10-29 | GitHub REST API (`GET /repos/JimmyOgb/PortalNexus` = HTTP 200 Public; `/commits` = HTTP 409 Empty Repository). |

---

## 2. Official Event Timeline & Deadlines

| Milestone | Official Date / Time | Current Status (as of 2026-10-29) | Compliance Note |
| :--- | :--- | :--- | :--- |
| **Pre-registration** | September 29, 2026 (09:00 UTC-7) | Passed | External organizer registration status is `UNKNOWN` from local workspace. |
| **Submission Period Opens** | October 13, 2026 (09:00 UTC-7) | Active | We are currently inside the active submission window. |
| **Kick-off & Workshop** | October 14, 2026 | Passed | Informational milestone. |
| **Check-in Submission Deadline** | October 24, 2026 | Passed | As of 2026-10-29, the remote GitHub repo was still empty. Whether a DoraHacks check-in form was submitted on Oct 24 is `UNKNOWN` from local files, and no commits existed on GitHub before Oct 24 (**PARTIAL / AT RISK**). |
| **Final Submission / Code Freeze** | November 5, 2026 (20:00 UTC-7) / November 6, 2026 | **7–8 Days Remaining** | Pushing genuine commits on 2026-10-29 occurs well ahead of the final 24-hour pre-deadline window. |
| **Live Demo Days** | November 8 – 9, 2026 | Upcoming | Requires Demo Video (≤3 min) and Pitch Deck ready prior to Demo Days. |
| **Winners Announcement** | November 11, 2026 | Upcoming | Final judging conclusion. |

---

## 3. Track Analysis & Recommendation

### Official Tracks in Portaldot Hacker House 2026
1. **Modular Cloud & Middleware:** Decentralized middleware, data/storage components, and APIs utilizing Portaldot's modular architecture.
2. **Multi-Chain & Cross-Chain Infra:** Leveraging cross-chain/multi-VM features to build asset/data bridges and liquidity engines.
3. **Node Operations & Tooling:** Node monitoring, automated staking, visualization, diagnostics, and security tools.
4. **Ecosystem DApps:** DeFi applications, RWA tokenization platforms, and consumer-facing applications natively deployed on Portaldot V3 (supporting extra 2nd and 3rd place prizes in addition to 1st place).

### Recommendation for PortalNexus
- **Primary Recommended Track: Track 4 — Ecosystem DApps (DeFi)** *(or Track 2 — Multi-Chain & Cross-Chain Infra / Track 3 — Node Operations & Tooling depending on positioning)*
  - **Why Ecosystem DApps (Primary):** PortalNexus deploys a real, verified Solidity constant-product Automated Market Maker (`NexusAMMNative.sol`) and test stablecoin (`TestUSDCMin.sol`) on Portaldot V3 EVM (`pallet-revive`), pairing native `POT` directly with `pUSDC` alongside unified ERC-721 LP receipts. Furthermore, **Ecosystem DApps** is the only track with 1st ($800), 2nd ($500), and 3rd ($300) place prizes in addition to Grand Prize ($1,000) and Community Choice ($200) eligibility.
  - **Why Node Operations & Tooling / Multi-Chain & Cross-Chain Infra (Alternative):** PortalNexus also includes a real-time Dual-VM Cadence Monitor comparing Substrate Layer-0 (`wss://test-node-v3.portaldot.dev`) and EVM (`https://test-evm-rpc-v3.portaldot.dev`) block production in lockstep, plus an audited `pallet-revive` address-mapping inspector (`AccountId32Mapper` 12-byte `0xEE` fallback vs `OriginalAccount` keccak256 mapping) that prevents fund loss from legacy Frontier `evmToAddress()` hashing. Since the AMM pool currently has zero initial liquidity and transaction submission is guarded (`TX_SUBMISSION_ENABLED = false`), the **Dual-VM Observability & Address Inspector** is 100% live and interactive today.
  - **Actionable Positioning:** Frame PortalNexus as a **Dual-VM DeFi & Observability Terminal for Portaldot V3**, qualifying cleanly for **Ecosystem DApps** (via its deployed Architecture A AMM contracts) or **Node Operations & Tooling** (via its live Dual-VM telemetry and `pallet-revive` address derivation tooling).

---

## 4. Requirement-by-Requirement Compliance Matrix

| ID | Category | Exact Requirement / Faithful Summary | Official Source | Status | Evidence Found | Missing Evidence / Gap | Required Next Action | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Eligibility** | Project built for Portaldot Network V3.0 during the Hacker House period; team registration on DoraHacks (note: some tracks encourage ≥2 team members). | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** | Codebase specifically targets Portaldot V3 (`Chain ID 420420777`, `pallet-revive` v3002). | DoraHacks participant registration and team roster are external to the workspace (`UNKNOWN`). | Confirm team registration on DoraHacks portal prior to final submission. | **HIGH** |
| **R-02** | **Portaldot Integration & Deployment** | Smart contracts deployed on Portaldot V3 Testnet utilizing native `POT` for gas, with verifiable contract addresses and deployment tx hashes. | `https://dorahacks.io/hackathon/2362/detail` | **PASS** | `TestUSDCMin` (`0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`, tx `0x45346086...`, block `#237279`) and `NexusAMMNative` (`0x407A2609dfd5336a38D6274B1EFc1804930f160A`, tx `0x48cd0859...`, block `#237284`) deployed & verified via `eth_getCode` and `eth_call`. | Post-deployment write transactions (faucet mint, initial liquidity deposit, swaps) have not been executed (`totalSupply = 0`, `reserves = (0,0)`). | Document deployed contract proof prominently in README; disclose zero-reserve pool state honestly. | **BLOCKER** |
| **R-03** | **Technical Requirements** | Utilize Portaldot V3 stack (Solidity/EVM, ERC-20/ERC-721, or Substrate/WASM) with working code and tests. | `https://dorahacks.io/hackathon/2362/detail` | **PASS** | Solidity 0.8.24 contracts (`TestUSDCMin` ERC-20, `NexusAMMNative` constant-product AMM + unified ERC-721 LP receipt) + Dual-VM Substrate/EVM frontend; 46 Hardhat tests + 66 Vitest tests passing. | None for local/read-only verification. | Maintain 100% test pass rate through release. | **HIGH** |
| **R-04** | **Public GitHub Repository** | Open-source code repository on GitHub/GitLab/Bitbucket, publicly accessible throughout the event, containing all core contracts and frontend logic. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** *(Pending Push)* | `https://github.com/JimmyOgb/PortalNexus` exists and is public, and full source code is ready in `C:\Users\NO GO NO\PortalNexus`. | Remote GitHub repo is currently empty (`409 Git Repository is empty`). | Initialize Git safely, create genuine structured commits, and push to `JimmyOgb/PortalNexus` in Phase Ten. | **BLOCKER** |
| **R-05** | **MIT License & Open-Source Hygiene** | Open-source license present and secret-free repository (`contracts/.env` excluded). | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** *(Pending Creation)* | `.gitignore` rules hardened; user explicitly approved MIT License. | Root `LICENSE` file not yet created. | Create root `LICENSE` (MIT) in Phase Six and verify zero secrets before staging. | **HIGH** |
| **R-06** | **Detailed README & Architecture Diagram** | Complete `README.md` with project overview, architecture diagram, deployed contract addresses/hashes, setup/build/test instructions, and feature status. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** *(Updating)* | Existing `README.md` and audit reports exist in workspace. | `README.md` needs full judge-facing structure, Mermaid architecture diagram distinguishing live reads vs disabled tx paths, and supporting `docs/`. | Complete judge-ready `README.md` (Phase Seven) and `docs/` (Phase Eight). | **BLOCKER** |
| **R-07** | **Development / Commit History** | At least **3 valid commits** during the Hacker House period; core modules must not be dumped all at once in the final 24 hours before the deadline. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** *(Pending Commits)* | Current date is `2026-10-29`, which is **7–8 days before** the Nov 5–6 final deadline (not within the final 24 hours). | Git was not previously initialized, so earlier October work was not committed incrementally at the time. | Create ≥3 genuine, logically scoped commits today (`2026-10-29`) without backdating or fabricating timestamps, and continue incremental commits if further work is done before Nov 5. | **HIGH** |
| **R-08** | **Required Check-in Materials** | Check-in submission (deadline Oct 24, 2026): current progress, public GitHub repo, architecture diagram, testnet deployment info, initial demo material. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL / UNKNOWN** | All technical check-in artifacts (architecture diagram, testnet deployment addresses/tx hashes, runnable app) exist now on 2026-10-29. | Oct 24 check-in date has passed; whether the user submitted the check-in form on DoraHacks is `UNKNOWN`. | Publish complete check-in & final materials to GitHub immediately so the DoraHacks BUIDL entry has all required links. | **HIGH** |
| **R-09** | **Runnable Demo** | Live web/DApp link OR clear, reproducible instructions for running the application locally. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** | Reproducible local demo works out of the box (`npm install && npm run dev`) with live RPC telemetry and contract reads. | No public hosted URL (e.g., Vercel/Netlify/GitHub Pages) is currently deployed; transaction submission is intentionally disabled (`TX_SUBMISSION_ENABLED = false`). | Provide crystal-clear local demo instructions in `README.md` and `docs/DEMO_GUIDE.md`; explicitly label hosted deployment as optional/outstanding. | **HIGH** |
| **R-10** | **Demo Video (≤ 3 Minutes)** | Demo video of 3 minutes or less demonstrating the real product running core functions. | `https://dorahacks.io/hackathon/2362/detail` | **FAIL (Outstanding)** | None in workspace. | Video recording and public link (YouTube/Loom/Vimeo) do not exist yet. | Provide a ready-to-record 2–3 minute script & production checklist in `docs/DEMO_GUIDE.md`; user must record and upload before Nov 5. | **BLOCKER** *(for final DoraHacks form)* |
| **R-11** | **Pitch Deck** | Pitch deck (PDF or public link) covering problem, why Portaldot, product proof, business/ecosystem value, and roadmap. | `https://dorahacks.io/hackathon/2362/detail` | **FAIL (Outstanding)** | All narrative and technical content is being prepared in `README.md` and `docs/`. | Slide deck PDF / link is not yet created or uploaded. | Provide slide-by-slide outline and checklist in `docs/DEMO_GUIDE.md` so the user can export a PDF deck before Nov 5. | **BLOCKER** *(for final DoraHacks form)* |
| **R-12** | **Screenshots & Evidence** | Genuine screenshots of the running application and verifiable on-chain deployment evidence. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** | Live Playwright screenshots exist in `scratch/*.png`, and deployment receipt `contracts/deployment-receipt-arch-a.json` is verified on-chain. | `scratch/` is git-ignored; curated genuine UI screenshots should be placed in a tracked `docs/images/` or referenced cleanly if included. | Capture/copy genuine UI screenshots into `docs/assets/` (if helpful for README) or document exact visual states without fabricating anything. | **MEDIUM** |
| **R-13** | **Required Submission Fields** | DoraHacks BUIDL fields: Project Name, Team Members, 1-Sentence Overview, Track, GitHub URL, Contract Addresses/Tx Hashes, Demo URL/Instructions, Video Link, Pitch Deck Link. | `https://dorahacks.io/hackathon/2362/detail` | **PARTIAL** | Project Name, 1-Sentence Overview, Track recommendation, GitHub URL, Contract Addresses/Tx Hashes, and Local Demo Instructions are ready. | Video Link, Pitch Deck Link, and actual DoraHacks form submission must be completed by the user. | Summarize ready-to-paste DoraHacks submission field values in `PORTALNEXUS_RELEASE_REPORT.md`. | **HIGH** |
| **R-14** | **Deadlines & Code Freeze** | Final submission deadline Nov 5, 2026 (20:00 UTC-7) / Nov 6, 2026; strict code freeze thereafter. | `https://dorahacks.io/hackathon/2362/detail` | **PASS** | Current date is Oct 29, 2026 — 7 days prior to code freeze. | None. | Push all code and documentation today (Oct 29, 2026) well ahead of code freeze. | **HIGH** |

---

## 5. Judging Criteria Alignment & Honest Gap Analysis

Portaldot Hacker House 2026 evaluates submissions across four weighted criteria (100% total):

| Criterion | Weight | PortalNexus Strengths (Verified Evidence) | Current Gaps & Honest Disclosures | How Phase Five–Eight Improvements Maximize Score |
| :--- | :--- | :--- | :--- | :--- |
| **1. Technical Feasibility** | **30%** | - Two Solidity `0.8.24` contracts deployed & verified on Portaldot V3 Testnet (`TestUSDCMin` & `NexusAMMNative`).<br>- 112 automated tests passing (46 Hardhat + 66 Vitest).<br>- Zero-dependency custom ABI encoder/decoder (`src/contracts/abi.ts`) verified against Hardhat artifacts.<br>- Dual-RPC client polling Substrate WS (`wss://test-node-v3.portaldot.dev`) and EVM HTTP (`https://test-evm-rpc-v3.portaldot.dev`). | - Pool currently has `0` reserves (`getReserves() = (0,0)`) and `0` minted `pUSDC` because post-deployment write transactions cost ~25–35 POT in `pallet-revive` state rent and deployer has `13.088 POT` remaining.<br>- `TX_SUBMISSION_ENABLED = false` by safety design. | - Clearly document the empirical `pallet-revive` storage-deposit math ($0.0589\text{ POT/byte}$ + trie item deposits) that led to Architecture A.<br>- Improve UI so judges can inspect live on-chain contract metadata, bytecode verification, and interactive quote/calldata simulation even while the pool has zero reserves. |
| **2. Innovation** | **30%** | - **Architecture A (Direct Native POT AMM):** Eliminates `WPotToken` wrapper contract to save ~217 POT in `pallet-revive` deployment state rent and avoid extra ERC-20 storage slots.<br>- **Unified ERC-721 LP Receipts:** Embeds NFT position accounting directly inside `NexusAMMNative`, saving ~416 POT vs separate receipt contract.<br>- **Dual-VM Cadence & Address Mapper:** Pairs Substrate & EVM block headers in real time and implements `pallet-revive`'s `AccountId32Mapper` (`0xEE` 12-byte suffix) vs `OriginalAccount` (`keccak256`). | - Cross-VM teleport action is a read-only mapping inspector (trustless cross-VM transfer is not natively exposed without a runtime bridge/extrinsic). | - Highlight the architectural innovation of designing DeFi primitives specifically around `pallet-revive` state rent economics (`407.81 POT` actual deploy cost vs `~1,090.86 POT` naive 3-contract architecture). |
| **3. Ecosystem Contribution** | **20%** | - Solves a critical developer/user pain point on Portaldot V3: legacy Polkadot Frontier tools (`evmToAddress()`) produce wrong SS58 addresses on `pallet-revive`, risking permanent fund loss. PortalNexus provides an open-source, tested `reviveMapper.ts` library and visual inspector.<br>- Provides comprehensive empirical benchmarks of `pallet-revive` gas and storage deposit behavior on Portaldot V3. | - Needs clean `docs/` packaging so other Portaldot V3 builders can reuse the address mapper, RPC clients, and `pallet-revive` cost formulas. | - Publish dedicated `docs/ARCHITECTURE.md` and `docs/TESTING_AND_EVIDENCE.md` under the MIT License so any Portaldot builder can adopt the patterns. |
| **4. Business Potential** | **20%** | - Native POT / stablecoin liquidity and safe Substrate↔EVM account tooling are foundational primitives required by every future DeFi protocol and user onboarding onto Portaldot V3. | - Currently a testnet prototype with a simulation stablecoin (`pUSDC`) and no production audit. | - Present a realistic, phased post-hackathon roadmap (`docs/ROADMAP.md`) moving from testnet liquidity seeding to audited mainnet-grade infrastructure. |

---

## 6. Summary of Actionable Priorities for Remaining Phases

1. **Phase Two & Three (Workspace & Security):** Re-verify Git status, remote repository (`JimmyOgb/PortalNexus`), and `.gitignore` exclusions so `contracts/.env` and `scratch/` can never be staged.
2. **Phase Four (Live Portaldot Verification):** Re-verify live RPC responses on `https://test-evm-rpc-v3.portaldot.dev` for Chain ID, block number, bytecode, and contract getters.
3. **Phase Five (Targeted Product Hardening):** Enhance `AmmPanel.tsx` / `Dashboard.tsx` so judges inspecting the app immediately see:
   - Live on-chain contract verification status (deployed addresses, block numbers, tx hashes, live `getReserves()` and token metadata).
   - Clear empty-pool explanation alongside an clearly labeled **Initial Liquidity & Calldata Preview** (allowing judges to inspect how initial liquidity and swap calldata are constructed without faking on-chain reserves or enabling unauthorized broadcasts).
   - Responsive, accessible UI and full test coverage for any added functionality.
4. **Phase Six–Eight (MIT License, README & Supporting Docs):** Create `LICENSE` (MIT), rewrite `README.md` to the full A–T judge-facing specification, and create `docs/ARCHITECTURE.md`, `docs/DEMO_GUIDE.md`, `docs/TESTING_AND_EVIDENCE.md`, and `docs/ROADMAP.md`.
5. **Phase Nine–Eleven (Validation, Structured Git Commits, Push & Release Report):** Run all test suites, stage deliberately, create genuine structured commits, push to `https://github.com/JimmyOgb/PortalNexus`, verify remote commit hashes, and write `PORTALNEXUS_RELEASE_REPORT.md`.
