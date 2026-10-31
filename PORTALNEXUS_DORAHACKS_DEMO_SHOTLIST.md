# PortalNexus V3.0 — DoraHacks Demo Video Production Shotlist & Storyboard

**Document:** `PORTALNEXUS_DORAHACKS_DEMO_SHOTLIST.md`  
**Companion Script:** `PORTALNEXUS_DORAHACKS_DEMO_VIDEO_SCRIPT.md`  
**Target Event:** DoraHacks Portaldot Hacker House 2026  
**Track:** Multi-Chain & Cross-Chain Infra / Tooling  
**Total Target Video Duration:** **2 minutes 50 seconds (170.0s)**  
**Target Video Format:** 1080p60 MP4 (1920 × 1080, 60 FPS, Bitrate: 14 Mbps, Audio: AAC 320 kbps, 48 kHz Stereo)  
**Primary Capture URL:** Production: [`https://portalnexus-two.vercel.app/`](https://portalnexus-two.vercel.app/) (or local high-FPS instance `http://localhost:5173/`)

---

## 1. Pre-Recording Technical Setup Checklist

| Checkpoint | Recommended Setting | Verification Method |
| :--- | :--- | :--- |
| **Display Resolution** | Exactly 1920 × 1080 (16:9 Landscape) | Windows Display Settings & OBS Canvas |
| **Browser Window** | Chrome / Edge clean profile, 100% zoom, Bookmarks & extensions hidden, Fullscreen (F11) | Visual inspection of window margins |
| **RPC Connectivity** | Substrate WebSocket & EVM JSON-RPC live and green | Telemetry cards displaying block `#262,700+` |
| **Theme / Appearance** | Dark mode default, Three.js 3D Singularity Canvas active | Canvas rotating with cyan/emerald particle field |
| **Terminal Setup** | Windows Terminal or VS Code terminal, 1920 × 1080, font size 15pt JetBrains Mono | Run `npm test` test run to verify clean pass |
| **Audio Configuration** | Microphone sampled at 48 kHz / 24-bit with noise suppression, or high-fidelity TTS | Audio peaks at -6 dB, background music at -24 dB |

---

## 2. Shot-by-Shot Technical Breakdown (0:00 – 2:50)

### Scene 1: Introduction & Live App Overview (0:00 – 0:30)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 1.1: Global Hero & 3D Singularity Canvas Drift (0:00 – 0:15 | 15s)                │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Top Navbar, Header Badges, Three.js 3D Singularity Background    │
│ Screen Region        │ Full Screen (0, 0) to (1920, 1080)                              │
│ Camera / Zoom        │ 100% full overview, subtle slow zoom-in (100% -> 105%)          │
│ Action Sequence      │ 1. Browser loads https://portalnexus-two.vercel.app/           │
│                      │ 2. The 3D singularity particle vortex animates smoothly at 60fps│
│                      │ 3. Mouse cursor enters from bottom right and rests at center.   │
│ On-Screen Graphic    │ Lower Third (0:04 – 0:12):                                      │
│                      │ "PORTALNEXUS V3.0 — Dual-VM Interoperability Hub for Portaldot"  │
│ Narration Sync       │ "Welcome to PortalNexus V3, an open-source Dual-VM... Hacker   │
│                      │  House 2026."                                                   │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 1.2: Header Status Badges & Network Verification (0:15 – 0:30 | 15s)               │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Top Header Right: Network Badges (`Chain ID 420420777`)          │
│ Screen Region        │ Upper Right Quadrant: (1100, 20) to (1900, 100)                 │
│ Camera / Zoom        │ Smooth pan to upper right, 120% magnification                   │
│ Action Sequence      │ 1. Cursor smoothly hovers over "Portaldot V3.0 Testnet" badge.   │
│                      │ 2. Cursor hovers over "Chain ID: 420420777" indicator.          │
│                      │ 3. Cursor hovers over "Pallet-Revive v3002" green status dot.    │
│ Narration Sync       │ "Portaldot V3 transitions to the Polkadot SDK’s pallet-revive...│
│                      │  live in production right now on Vercel."                       │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

### Scene 2: Dual-VM Telemetry & Cadence Offsets (0:30 – 1:00)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 2.1: Dual Consensus Monitoring Streams (0:30 – 0:45 | 15s)                        │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Dual-VM Telemetry Card (`#dual-vm-telemetry`)                   │
│ Screen Region        │ Center Screen: (200, 180) to (1720, 480)                        │
│ Camera / Zoom        │ Center focus, 115% zoom                                         │
│ Action Sequence      │ 1. Cursor points to Left Column: Substrate WebSocket stream      │
│                      │    - Highlight URL: wss://test-node-v3.portaldot.dev             │
│                      │    - Highlight block height incrementing with live pulse.        │
│                      │ 2. Cursor glides to Right Column: EVM JSON-RPC stream            │
│                      │    - Highlight URL: https://test-evm-rpc-v3.portaldot.dev        │
│                      │    - Highlight gas price: ~25,925 wei.                           │
│ On-Screen Graphic    │ Callout Box (0:33 – 0:42):                                      │
│                      │ "Simultaneous Streaming: Substrate Layer-0 + Revive EVM"        │
│ Narration Sync       │ "On our dashboard, we monitor both virtual machines...          │
│                      │  query the Portaldot EVM JSON-RPC at Chain ID 420420777."       │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 2.2: Cadence Delta (Δ) Offset Metric (0:45 – 1:00 | 15s)                          │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Cadence Delta Center Meter & Mini-Graph                         │
│ Screen Region        │ Center Telemetry Widget: (820, 220) to (1100, 460)              │
│ Camera / Zoom        │ Tight zoom to Cadence Offset gauge (135% zoom)                  │
│ Action Sequence      │ 1. Cursor hovers over the "Δ = Substrate − EVM" badge.          │
│                      │ 2. Tooltip reveals rolling 15-sample synchronization status.     │
│                      │ 3. Camera pulls back smoothly to prepare for Tab 1 inspection.   │
│ Narration Sync       │ "PortalNexus computes the live cadence delta between consensus  │
│                      │  and smart contract execution in real time..."                  │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

### Scene 3: Revive Address Inspector — Preventing Lost Funds (1:00 – 1:30)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 3.1: Tab 1 Navigation & Input Field Focus (1:00 – 1:12 | 12s)                     │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Tab Navigation Bar & Address Inspector Panel                    │
│ Screen Region        │ Middle Viewport: (200, 360) to (1720, 850)                      │
│ Camera / Zoom        │ 110% zoom on Tab 1 (`#tab-btn-teleport`)                        │
│ Action Sequence      │ 1. Cursor clicks "1. Cross-VM Map" tab (`#tab-btn-teleport`).    │
│                      │ 2. Cursor clicks the EVM Address input field.                   │
│                      │ 3. Automatically selects or pastes EVM address:                  │
│                      │    0x1111111111111111111111111111111111111111                  │
│ Narration Sync       │ "One of the greatest hazards on Portaldot V3 is silent fund     │
│                      │  loss. Legacy Polkadot tools derive Substrate addresses..."     │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 3.2: Deterministic 0xEE Derivation & Security Comparison (1:12 – 1:30 | 18s)       │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Derived SS58 Display & Frontier Comparison Card                 │
│ Screen Region        │ Inspector Output: (240, 460) to (1680, 800)                     │
│ Camera / Zoom        │ 120% zoom highlighting the side-by-side comparison              │
│ Action Sequence      │ 1. UI instantly displays the derived SS58 address:              │
│                      │    5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM             │
│                      │ 2. Cursor hovers over the 12-byte [0xEE; 12] padding indicator. │
│                      │ 3. Cursor highlights the red "Legacy Frontier Blake2" warning.  │
│                      │ 4. Cursor clicks the "Copy Address" button; green check appears.│
│ On-Screen Graphic    │ Side-by-Side Callout (1:15 – 1:25):                             │
│                      │ "❌ Legacy Blake2 Hash: Funds Lost in Unmapped Account"          │
│                      │ " Pallet-Revive [0xEE; 12]: Canonical AccountId32 Standard"    │
│ Narration Sync       │ "But Portaldot’s pallet-revive enforces an authoritative...     │
│                      │  ensure user funds are never sent to unmapped phantom accounts."│
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

### Scene 4: Verified Contract Registry & In-Browser Solc Compiler (1:30 – 2:05)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 4.1: Live Storage Getter Verification on PortalTestStorage (1:30 – 1:48 | 18s)     │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Verified Contracts Registry Card                                │
│ Screen Region        │ Lower Half of Dashboard: (200, 680) to (1720, 1050)             │
│ Camera / Zoom        │ Scroll down smoothly, 115% zoom                                 │
│ Action Sequence      │ 1. Scroll into view: "Verified Contracts Registry".             │
│                      │ 2. Point to PortalTestStorage deployed at Block #261857.        │
│                      │ 3. Cursor clicks "Re-verify Live State" button.                 │
│                      │ 4. Refresh icon spins; live RPC getters populate:               │
│                      │    - getValue() => 42                                           │
│                      │    - creator() => 0xdC7f...8A2A                                 │
│ Narration Sync       │ "Next, developer tooling. In our verified registry, we          │
│                      │  interactively inspect our on-chain test contract..."          │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 4.2: In-Browser Solidity 0.8.24 WASM Compiler Modal (1:48 – 2:05 | 17s)           │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Deployment Modal (`#btn-deploy-modal` trigger)                  │
│ Screen Region        │ Modal Window: (360, 80) to (1560, 980)                          │
│ Camera / Zoom        │ Centered on modal, 105% zoom                                    │
│ Action Sequence      │ 1. Scroll to top right and click "Deploy Contracts" button.     │
│                      │ 2. Modal appears with backdrop blur.                            │
│                      │ 3. Point to green badge: "Solc 0.8.24 Ready (WASM Emscripten)". │
│                      │ 4. Cursor highlights Solidity editor containing PortalTestStorage│
│                      │ 5. Cursor highlights compiled bytecode and storage deposit cost │
│                      │ 6. Press Escape or click '✕' to close modal smoothly.           │
│ On-Screen Graphic    │ Callout (1:52 – 2:00):                                          │
│                      │ "Client-Side Solc 0.8.24 WASM: Zero Command-Line Setup"        │
│ Narration Sync       │ "Furthermore, our deployment manager embeds an in-browser...    │
│                      │  deploy through their browser wallet without external tools."   │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

### Scene 5: Architecture A AMM & State-Rent Optimization (2:05 – 2:35)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 5.1: Switching to Nexus AMM & Architecture Inspection (2:05 – 2:20 | 15s)          │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Tab 3: "3. Nexus AMM" (`#tab-btn-swap`)                         │
│ Screen Region        │ Center Viewport: (200, 360) to (1720, 950)                      │
│ Camera / Zoom        │ 110% zoom on AMM Panel                                          │
│ Action Sequence      │ 1. Cursor clicks `#tab-btn-swap`.                               │
│                      │ 2. Panel renders Native POT / pUSDC pair interface.             │
│                      │ 3. Point to Contract: 0x407A2609dfd5336a38D6274B1EFc1804930f160A│
│                      │ 4. Point to pUSDC: 0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002  │
│ On-Screen Graphic    │ Diagram / Callout (2:08 – 2:18):                                │
│                      │ "Architecture A: Direct Native POT Trading"                     │
│                      │ "Saves ~683 tPOT Storage Deposit (No Wrapped Token Overhead)"    │
│ Narration Sync       │ "To pioneer DeFi on Portaldot V3, we designed a state-rent-     │
│                      │  minimized AMM. Because pallet-revive bundles Substrate..."     │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 5.2: Transparent Pool Status & Safety Guard Enforcement (2:20 – 2:35 | 15s)        │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ AMM Reserves & Swap Safety Lock (`requiresNonZeroReserves`)     │
│ Screen Region        │ Swap Box: (560, 420) to (1360, 880)                             │
│ Camera / Zoom        │ 125% zoom on reserves card and swap button                      │
│ Action Sequence      │ 1. Highlight live reserves: "0.00 POT / 0.00 pUSDC".           │
│                      │ 2. Highlight badge: "Pool Unseeded — Swaps Locked".             │
│                      │ 3. Cursor hovers over disabled Swap button; tooltip verifies:   │
│                      │    "Swaps require non-zero pool liquidity reserves".            │
│                      │ 4. Cursor points to 46 passing contract invariant tests badge.  │
│ On-Screen Graphic    │ Disclosure Callout (2:22 – 2:32):                               │
│                      │ "Transparent Audit Disclosure: 0 Reserves (Unseeded Pool)"      │
│                      │ "46 Hardhat Contract Invariant Tests Pass In-Memory Math"       │
│ Narration Sync       │ "While our pool currently awaits initial liquidity seeding, its │
│                      │  constant-product invariant math... verified by 46 tests."      │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

### Scene 6: Conclusion, Automated Test Verification & Open Source (2:35 – 2:50)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 6.1: Terminal Test Suite Execution (236 / 236 PASS) (2:35 – 2:43 | 8s)            │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ VS Code Terminal / Windows Terminal Running Test Suite          │
│ Screen Region        │ Full Screen Terminal (0, 0) to (1920, 1080)                     │
│ Camera / Zoom        │ 100% full screen terminal, crisp green test output              │
│ Action Sequence      │ 1. Terminal displays finished test execution:                   │
│                      │    ✓ Vitest: 15 / 15 test files passed (190 / 190 tests) in 7.8s│
│                      │    ✓ Hardhat: 46 / 46 contract invariant tests passed in 3.0s   │
│                      │    ✓ TypeScript: tsc --noEmit exited with code 0                │
│                      │    ✓ Production Build: npm run build completed cleanly in 4.61s │
│ On-Screen Graphic    │ Green Banner (2:36 – 2:42):                                     │
│                      │ "236 / 236 AUTOMATED TESTS PASSING (100% COVERAGE)"             │
│ Narration Sync       │ "PortalNexus is 100% open-source under the MIT license and      │
│                      │  backed by 236 passing automated tests."                        │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SHOT 6.2: Final Closing Slate & DoraHacks Credentials (2:43 – 2:50 | 7s)               │
├──────────────────────┬─────────────────────────────────────────────────────────────────┤
│ Target Component     │ Pitch Deck Final Slide / Branded Closing Graphic                │
│ Screen Region        │ Full Screen 1920 × 1080                                         │
│ Camera / Zoom        │ Static 100% view                                                │
│ Action Sequence      │ 1. Display PortalNexus V3 logo, GitHub URL, and live dApp link: │
│                      │    - https://portalnexus-two.vercel.app/                        │
│                      │    - https://github.com/JimmyOgb/PortalNexus                    │
│                      │ 2. DoraHacks Portaldot Hacker House 2026 logo badge.            │
│                      │ 3. Fade out smoothly to black at 2:50.                          │
│ Narration Sync       │ "Explore our live dApp on Vercel or inspect our code on GitHub. │
│                      │  Thank you to DoraHacks and the Portaldot Foundation..."        │
└──────────────────────┴─────────────────────────────────────────────────────────────────┘
```

---

## 3. Video Recording Script Automation Options

### Option A: Automated Screen Capture using Playwright
If recording without OBS Studio, you can use Playwright's native Chromium video recording feature:
```python
browser = playwright.chromium.launch()
context = browser.new_context(
    record_video_dir="videos/",
    record_video_size={"width": 1920, "height": 1080},
    viewport={"width": 1920, "height": 1080}
)
page = context.new_page()
# Execute script interactions exactly as timed in Section 2...
context.close()
```

### Option B: OBS Studio / Windows Game Bar (Win+Alt+R)
1. Open Chrome / Edge maximized to 1920 × 1080 at `https://portalnexus-two.vercel.app/`.
2. Start OBS Studio with standard 1080p60 recording settings.
3. Follow the mouse coordinates and click sequences in Shots 1.1 through 6.2.
4. Merge the recorded video with the voiceover generated from `PORTALNEXUS_DORAHACKS_DEMO_VIDEO_SCRIPT.md` using FFmpeg.

---

## 4. Final Video Package Verification
- **Total Timed Scenes:** 6 scenes, 12 discrete shots.
- **Total Video Runtime:** Exactly 170 seconds (2:50).
- **All Technical Claims Grounded in Workspace Code:**
  - `src/lib/reviveMapper.ts` (0xEE address derivation)
  - `src/services/blockMonitor.ts` (Cadence delta)
  - `src/services/compilerService.ts` (In-browser Solc WASM)
  - `src/contracts/NexusAMMNative.sol` (Architecture A direct AMM)
  - `src/services/contractInspectionService.ts` (`PortalTestStorage` getters)
  - `test/NexusAMMNative.test.ts` (46 invariant tests)
  - Vitest test suite (190 unit/integration tests)
