# PortalNexus V3.0 — DoraHacks Official Demo Video Production Script

**Document:** `PORTALNEXUS_DORAHACKS_DEMO_VIDEO_SCRIPT.md`  
**Target Event:** DoraHacks Portaldot Hacker House 2026 (Portaldot Network Ecosystem Foundation)  
**Target Track:** Multi-Chain & Cross-Chain Infra / Tooling  
**Total Target Runtime:** **2 minutes 50 seconds (170 seconds)** — *Strictly below the 3-minute hackathon maximum*  
**Resolution / Aspect Ratio:** 1920 × 1080 (1080p, 60 FPS, 16:9 Landscape)  
**Narrator Tone:** Professional, confident, technically precise, articulate, fast-paced but clear (~135 words per minute)  
**Live Production URL:** [`https://portalnexus-two.vercel.app/`](https://portalnexus-two.vercel.app/)  
**Public GitHub Repository:** [`https://github.com/JimmyOgb/PortalNexus`](https://github.com/JimmyOgb/PortalNexus)  
**Portaldot V3 EVM Chain ID:** `420420777` (`0x190f1ca9`)  
**Verified On-Chain Contracts:**
- `NexusAMMNative`: `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Block `#237284`)
- `TestUSDCMin`: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Block `#237279`)
- `PortalTestStorage`: `0x5065125265638A4b354FDDfe1f9339F65cC9f6F8` (Block `#261857`)

---

## 1. Video Overview & Production Guidelines

### 1.1 Audio & Pacing Calibration
- **Total Word Count:** ~375 words across 170 seconds $\implies 132\text{ words per minute}$.
- **Voice Profile:** Clear, energetic, technical engineer voice (or natural neutral AI voiceover via `edge-tts` / `piper-tts` using `en-US-ChristopherNeural` or `en-US-GuyNeural`).
- **Background Audio:** Subtle, low-volume ambient electronic / synthwave track at -24 dB with high-frequency roll-off during speech.

### 1.2 Strict Truthfulness & Disclosure Mandates
1. **Unseeded AMM Status:** Explicitly state that `NexusAMMNative` currently holds zero liquidity reserves and that liquidity seeding transactions have not been executed. Never fabricate swap transactions.
2. **Real Contract Evidence:** All three contract addresses shown on-screen are real, mined contracts on Portaldot V3 testnet.
3. **Automated Test Results:** Display the actual automated test execution proving 236 / 236 tests passing (190 Vitest + 46 Hardhat).

---

## 2. Complete Scene-by-Scene Timed Script

```
========================================================================================
SCENE 1: Introduction & Live App Overview (0:00 – 0:30 | 30 Seconds | ~68 words)
========================================================================================
Visual Setup:
  • Browser window full screen at 1920x1080 navigating to https://portalnexus-two.vercel.app/
  • The dark-mode interface loads with the glowing 3D singularity canvas (Three.js) rotating smoothly.
  • Top header badges visible: "Portaldot V3.0 Testnet (420420777)", "Pallet-Revive v3002", and "RPC Online".
  • Smooth camera drift toward the central telemetry card.

On-Screen Text Overlay (0:04 – 0:12):
  ┌─────────────────────────────────────────────────────────────┐
  │ PORTALNEXUS V3.0                                            │
  │ Dual-VM Interoperability Hub for Portaldot Network          │
  │ DoraHacks Portaldot Hacker House 2026                       │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (0:02 – 0:28):
"Welcome to PortalNexus V3, an open-source Dual-VM interoperability hub and developer terminal built for the Portaldot Network Hacker House 2026. 

Portaldot V3 transitions to the Polkadot SDK’s pallet-revive execution engine, bringing high-performance EVM execution to Substrate Layer-0. 

PortalNexus unifies these two environments into a single, real-time browser dashboard, live in production right now on Vercel."

========================================================================================
SCENE 2: Dual-VM Telemetry & Cadence Offsets (0:30 – 1:00 | 30 Seconds | ~66 words)
========================================================================================
Visual Setup:
  • Smooth zoom into the Dual-VM Consensus Telemetry card (middle top of dashboard).
  • Mouse cursor hovers over the Substrate status column (left), showing:
      - Endpoint: wss://test-node-v3.portaldot.dev
      - Current block height (e.g., #262,700) with green pulsing indicator.
  • Mouse cursor moves to EVM status column (right), showing:
      - RPC: https://test-evm-rpc-v3.portaldot.dev
      - Chain ID: 420420777
      - Gas price: ~25,925 wei
  • Mouse highlights the Cadence Delta meter in the center: "Δ = Substrate − EVM".

On-Screen Text Overlay (0:35 – 0:45):
  ┌─────────────────────────────────────────────────────────────┐
  │ DUAL-VM CONSENSUS TELEMETRY                                 │
  │ Substrate WebSocket (14 dec) ↔ EVM JSON-RPC (18 dec)        │
  │ Real-time Cadence Delta Offset Tracking                     │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (0:31 – 0:58):
"On our dashboard, we monitor both virtual machines simultaneously. 

On the left, we stream live blocks directly from the Substrate Layer-0 WebSocket. On the right, we query the Portaldot EVM JSON-RPC at Chain ID 420420777. 

PortalNexus computes the live cadence delta between consensus and smart contract execution in real time, giving node operators and dApp developers instant visibility into network synchronization."

========================================================================================
SCENE 3: Revive Address Inspector — Preventing Lost Funds (1:00 – 1:30 | 30 Seconds | ~69 words)
========================================================================================
Visual Setup:
  • Click on Tab 1: "1. Cross-VM Map" (`#tab-btn-teleport`).
  • Paste an EVM address into the input field: `0x1111111111111111111111111111111111111111`.
  • The UI instantly derives the official Pallet-Revive SS58 Substrate address:
      `5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM`.
  • Highlight the visual warning banner comparing legacy Frontier `evmToAddress` vs. Revive `[0xEE; 12]`.
  • Click the copy button, displaying the "Copied!" green tooltip.

On-Screen Text Overlay (1:05 – 1:15):
  ┌─────────────────────────────────────────────────────────────┐
  │ DETERMINISTIC 0xEE MAPPING                                  │
  │ H160 (20B) + [0xEE; 12] ──> AccountId32 (32B)               │
  │ Prevents Silent Fund Loss from Legacy Frontier Converters   │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (1:01 – 1:28):
"One of the greatest hazards on Portaldot V3 is silent fund loss. 

Legacy Polkadot tools derive Substrate addresses by hashing EVM accounts. But Portaldot’s pallet-revive enforces an authoritative standard: the twenty-byte EVM address padded with twelve 0xEE bytes. 

PortalNexus implements this exact AccountId32 mapper directly in the browser, verified against canonical Polkadot SDK test vectors to ensure user funds are never sent to unmapped phantom accounts."

========================================================================================
SCENE 4: Verified Contract Registry & In-Browser Solc Compiler (1:30 – 2:05 | 35 Seconds | ~79 words)
========================================================================================
Visual Setup:
  • Scroll down to the "Verified Contracts Registry & Live Inspector" card.
  • Mouse cursor clicks the "Re-verify Live State" button.
  • The spinner spins for 1 second, then updates live getters on `PortalTestStorage`:
      - `getValue() => 42`
      - `creator() => 0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`
      - Block `#261857`
  • Mouse cursor scrolls to top right and clicks the "Deploy Contracts" button (`#btn-deploy-modal`).
  • The Deployment Modal opens displaying the embedded pinned Solidity 0.8.24 WASM compiler.
  • Show the compiler status badge: "Solc 0.8.24 Ready (WASM Emscripten)".
  • Show the Cancun bytecode and the calculated Pallet-Revive storage deposit estimate.
  • Press Escape or click the close button.

On-Screen Text Overlay (1:35 – 1:45):
  ┌─────────────────────────────────────────────────────────────┐
  │ LIVE CONTRACT REGISTRY & IN-BROWSER SOLC COMPILER           │
  │ On-Chain Contract: PortalTestStorage (Block #261857)        │
  │ soljson-v0.8.24.js WASM Emscripten Sandbox                  │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (1:31 – 2:03):
"Next, developer tooling. In our verified registry, we interactively inspect our on-chain test contract, PortalTestStorage, deployed at block 261857. 

With one click, we query live getters over JSON-RPC, confirming getValue returns 42 and creator matches our verified deployer. 

Furthermore, our deployment manager embeds an in-browser Solidity 0.8.24 WebAssembly compiler. Developers can write Cancun-compatible smart contracts, compile them in an isolated WebWorker sandbox, estimate Substrate storage deposit costs, and deploy through their browser wallet without installing external tools."

========================================================================================
SCENE 5: Architecture A AMM & State-Rent Optimization (2:05 – 2:35 | 30 Seconds | ~68 words)
========================================================================================
Visual Setup:
  • Click on Tab 3: "3. Nexus AMM" (`#tab-btn-swap`).
  • AMM Panel loads showing:
      - Native POT / pUSDC direct pool.
      - Contract Address: `0x407A2609dfd5336a38D6274B1EFc1804930f160A`.
      - TestUSDCMin Address: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`.
      - Reserves Display: `0.00 POT / 0.00 pUSDC`.
  • Highlight the safety guard badge: "Pool Unseeded — Swaps Locked Until Initial Deposit".
  • Cursor hovers over the disabled Swap button showing safety guard tooltip.

On-Screen Text Overlay (2:10 – 2:20):
  ┌─────────────────────────────────────────────────────────────┐
  │ STATE-RENT-MINIMIZED DEFI ARCHITECTURE                      │
  │ Direct Native POT Trading (Eliminates Wrapped POT)          │
  │ Saves ~683 tPOT in Substrate Storage Deposits               │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (2:06 – 2:33):
"To pioneer DeFi on Portaldot V3, we designed a state-rent-minimized AMM. 

Because pallet-revive bundles Substrate storage deposits into transaction gas, naive multi-contract AMMs require over 1,000 tokens in storage collateral. 

Our Architecture A eliminates wrapped POT, saving approximately 683 tPOT in upfront storage holds. While our pool currently awaits initial liquidity seeding, its constant-product invariant math, slippage protection, and 1,000-share liquidity lock are rigorously verified by 46 automated contract tests."

========================================================================================
SCENE 6: Conclusion, Test Verification & Open Source (2:35 – 2:50 | 15 Seconds | ~38 words)
========================================================================================
Visual Setup:
  • Quick transition to a split view or terminal screen:
      - Left: Visual Studio Code / Terminal running `npm test` showing Vitest and Hardhat test summaries:
          `Test Files  15 passed (15)`
          `Tests       190 passed (190)`
          `Hardhat     46 passed (46)`
          `Total:      236 / 236 PASS (100%)`
      - Right: GitHub repository page `https://github.com/JimmyOgb/PortalNexus`.
  • Final closing logo graphic with links and QR code / URLs.

On-Screen Text Overlay (2:36 – 2:48):
  ┌─────────────────────────────────────────────────────────────┐
  │ 236 / 236 AUTOMATED TESTS PASSING (100%)                    │
  │ MIT Licensed Open Source Repository                         │
  │ github.com/JimmyOgb/PortalNexus                             │
  │ portalnexus-two.vercel.app                                  │
  └─────────────────────────────────────────────────────────────┘

Narrator Spoken Dialogue (2:35 – 2:49):
"PortalNexus is 100% open-source under the MIT license and backed by 236 passing automated tests. 

Explore our live dApp on Vercel or inspect our code on GitHub. 

Thank you to DoraHacks and the Portaldot Foundation for advancing Dual-VM Web3."
========================================================================================
[FADE TO BLACK AT 2:50]
```

---

## 3. Production Check & Video Metadata

- **Script Duration:** Exactly 170 seconds (2 minutes 50 seconds).
- **Target Video Duration:** 02:50.
- **DoraHacks Compliance:** Passes the strict 3-minute hackathon cap with a 10-second safety margin.
- **Audio Delivery Rate:** 132 words/min (Optimal clarity for technical judging panels).
- **Video Export Format:** MP4 (H.264 video, AAC audio, 1080p60, bitrate 12–16 Mbps).
- **YouTube Upload Title:** `PortalNexus V3 — Dual-VM Interoperability Hub & Developer Suite | Portaldot Hacker House 2026`
- **YouTube Description:**
  ```text
  PortalNexus V3.0 is an open-source Dual-VM interoperability hub, deterministic pallet-revive address inspector, in-browser Solidity compiler, and state-rent-minimized AMM built natively for Portaldot Network V3.0 (Chain ID 420420777).

  Submitted to DoraHacks Portaldot Hacker House 2026 (Multi-Chain & Cross-Chain Infra Track).

  Live Hosted App: https://portalnexus-two.vercel.app/
  GitHub Repository: https://github.com/JimmyOgb/PortalNexus
  Pitch Deck: PORTALNEXUS_DORAHACKS_PITCH_DECK.pdf

  Verified On-Chain Contracts:
  - NexusAMMNative: 0x407A2609dfd5336a38D6274B1EFc1804930f160A
  - TestUSDCMin: 0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002
  - PortalTestStorage: 0x5065125265638A4b354FDDfe1f9339F65cC9f6F8

  Automated Test Coverage: 236 / 236 tests passing (190 Vitest + 46 Hardhat).
  ```
