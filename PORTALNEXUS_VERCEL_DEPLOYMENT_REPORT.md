# PortalNexus — Vercel Deployment & Live Verification Report

**Date & Time:** October 29, 2026 — 13:10 UTC  
**Scope:** `PortalNexus` (`C:\Users\NO GO NO\PortalNexus`)  
**Network Target:** Portaldot V3 Testnet (`Chain ID 420420777`)  
**Status:** ✅ **VERIFIED LIVE IN PRODUCTION**

---

## 1. Deployment Summary

| Parameter | Confirmed Value | Notes |
| :--- | :--- | :--- |
| **GitHub Repository** | [`https://github.com/JimmyOgb/PortalNexus`](https://github.com/JimmyOgb/PortalNexus) | Connected via `vercel git connect` |
| **Commit Deployed** | `4253703` (docs(release): add final hackathon release and verification report) + documentation updates | Up to date with `origin/main` |
| **Vercel Project Name** | `portalnexus` (team / scope: `jamism123`) | Confirmed via Vercel CLI |
| **Production Canonical URL** | [https://portalnexus-two.vercel.app](https://portalnexus-two.vercel.app) | Returns `HTTP 200 OK` |
| **Specific Deployment URL** | [https://portalnexus-gt0fff2cd-jamism123.vercel.app](https://portalnexus-gt0fff2cd-jamism123.vercel.app) | Deployment ID: `dpl_PXjkNYwm2VWnKszANZ3g8L75n5gQ` |
| **Deployment Target** | **Production** | Promoted and aliased automatically |
| **Hosting Tier** | Vercel Free / Hobby Plan | Zero paid services added |
| **CI/CD Integration** | GitHub Automatic Deployments Enabled | Pushes to `main` automatically build and deploy |

---

## 2. Build Pipeline & Environment Configuration

### Local Validation
Prior to deployment, the complete local validation matrix was executed:
- **Frontend Test Suite (`npm test`):** 8 test files, 68 tests passing (`3.12s`)
- **Smart Contract Test Suite (`npm run test:contracts`):** 46 Hardhat tests passing (`4s`)
- **TypeScript Static Typing (`npm run typecheck`):** 0 errors (`tsc --noEmit`)
- **Frontend Production Build (`npm run build`):** Built in `4.09s` outputting to `dist/`

### Vercel Cloud Build Logs
```
Running "vercel build"
Vercel CLI 65.4.0
Installing dependencies...
added 114 packages in 6s
Running "npm run build"
> portalnexus-v3@0.1.0 build
> tsc && vite build
vite v6.4.5 building for production...
transforming...
✓ 48 modules transformed.
dist/index.html                        1.03 kB │ gzip:   0.58 kB
dist/assets/index-TR08D9MV.css        10.94 kB │ gzip:   3.26 kB
dist/assets/index-wZWapsSM.js        338.32 kB │ gzip: 102.52 kB
dist/assets/ThreeCanvas-B-C3pIWk.js  467.63 kB │ gzip: 118.62 kB
✓ built in 4.09s
▲ Aliased https://portalnexus-two.vercel.app
```

### Safety & Secret Boundary Verification
- **Secret Isolation:** Created `.vercelignore` strictly excluding `/contracts/`, `/scratch/`, `/docs/`, `/tests/`, and all `.env*` files from deployment archives.
- **Payload Audit:** Verified using `scratch/check_secrets.cjs` across all live assets (`index.html`, `index-wZWapsSM.js`, `ThreeCanvas-B-C3pIWk.js`, `index-TR08D9MV.css`).
- **Deployer Private Key:** Deployer private keys in `contracts/.env` were **never** exposed to frontend code, never uploaded as Vercel environment variables, and never present in client bundles.
- **Transaction Submission:** Hard-coded `TX_SUBMISSION_ENABLED = false` in `src/services/ammService.ts` verified intact. No wallet transactions can be signed or broadcast.

---

## 3. Live Site Verification (Automated Playwright Suite)

Automated end-to-end verification was performed against the live production URL (`https://portalnexus-two.vercel.app`):

### A. HTTP & Asset Loading
- `curl -I https://portalnexus-two.vercel.app`: `HTTP/1.1 200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -I https://portalnexus-two.vercel.app/assets/index-wZWapsSM.js`: `HTTP/1.1 200 OK`, `Content-Length: 338322`.
- Document Title: `PortalNexus V3 | Dual-VM Interoperability Hub`.

### B. Wallet State Verification Matrix
| State Tested | Observed Behavior | Live Portaldot RPC Calls | Wallet Calls | Write Calls | Guard Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Disconnected** | Displays "Wallet disconnected. Connect an EVM wallet to see balances". | `eth_call`, `eth_chainId`, `eth_gasPrice`, `eth_getBlockByNumber`, `eth_syncing`, `net_version`, `web3_clientVersion` | None | None | ✅ Disabled (`submit_disabled: true`) |
| **Wrong Network** (`Chain 1`) | Displays "Unsupported network (chain 1). Switch to Portaldot V3 Testnet (420420777)". | Same as above | `eth_requestAccounts`, `eth_chainId` | None | ✅ Disabled (`submit_disabled: true`) |
| **Connected** (`0x190f1ca9`) | Displays connected address `0xdC7f...8A2A (420420777)`. Queries balance via `eth_getBalance`. | `eth_call`, `eth_chainId`, `net_version`, `web3_clientVersion` | `eth_requestAccounts`, `eth_chainId`, `eth_getBalance` | None | ✅ Disabled (`submit_disabled: true`) |
| **Rejected** | Gracefully catches user rejection code `4001` with zero uncaught console errors. | `eth_call`, `eth_chainId`, `net_version`, `web3_clientVersion` | `eth_requestAccounts` | None | ✅ Clean (`console_errors: []`) |

### C. Live Read-Only Data Verification
- **Dual-VM Telemetry:** Successfully streams live block heights (e.g. `#238,603+`) and block delta ($\Delta$) directly from `https://test-evm-rpc-v3.portaldot.dev` and `wss://test-node-v3.portaldot.dev`.
- **Contract Inspection:** Direct queries against verified Architecture A smart contracts on Portaldot V3 Testnet:
  - `NexusAMMNative`: `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (Block `#237284`)
  - `TestUSDCMin`: `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` (Block `#237279`)
- **Empty-Pool State Presentation:** The AMM correctly detects and presents the zero-reserve pool (`0 POT / 0 pUSDC`), prevents swap quote fabrication, and provides initial liquidity calldata preview.
- **Simulation Token Disclosure:** Clearly surfaces the testnet disclosure: *"pUSDC is a Portaldot testnet simulation token. It has no real-world value and no backing."*

---

## 4. Verification Distinctions

As required by the verification protocol, the following distinctions are explicitly documented:
1. **Successful Vercel Deployment:** ✅ **PASSED.** Build succeeded, domain `portalnexus-two.vercel.app` provisioned, HTTP 200 OK.
2. **Successful Page Load:** ✅ **PASSED.** DOM loaded, WebGL/Three.js singularity rendered, React components mounted with zero uncaught console errors.
3. **Successful Live RPC Reads:** ✅ **PASSED.** Active JSON-RPC polling to `https://test-evm-rpc-v3.portaldot.dev` succeeds for block heights, gas prices, and contract reads.
4. **Real Wallet Connection Testing:** ⚠️ **SIMULATED VIA INJECTED EVM PROVIDER.** Tested via automated Playwright provider injection (`eth_requestAccounts`, `eth_chainId`, `eth_getBalance`). Manual end-user MetaMask confirmation remains for users visiting the live URL.
5. **Real Transaction Testing:** 🛑 **INTENTIONALLY NOT EXECUTED.** Hard-coded `TX_SUBMISSION_ENABLED = false` prevents any on-chain state modification. No testnet funds were spent; zero transactions were broadcast.

---

## 5. Documentation & Git Status

- **`README.md` Updated:**
  - Added primary "Live Hosted Web Demo" banner and table with live URLs.
  - Added feature support overview and testnet safety disclosures.
  - Updated Section J and Submission checklist with verified live links.
- **`.gitignore` & `.vercelignore` Configured:**
  - `.vercel` and `.env*` ignored to prevent committing local deployment state.
  - Non-frontend directories ignored during deployment builds.
- **Automatic GitHub Deployments:**
  - `vercel git connect` connected the project to `https://github.com/JimmyOgb/PortalNexus`.
  - Future commits to `main` automatically trigger production deployments on Vercel.

---

## 6. Next Recommended Product Improvements

1. **Initial Testnet Liquidity Seeding:** Once the deployer account receives additional `tPOT` from community faucets to cover `pallet-revive` storage deposits (`~25–35 POT`), execute `addLiquidity` (`0.5 POT + 10 pUSDC`) to activate on-chain swap quotes.
2. **Opt-In Transaction Broadcasting Mode:** Provide an explicit UI toggle with a safety acknowledgment modal allowing users with funded testnet wallets to sign and broadcast swaps.
3. **Substrate Wallet Direct Signer:** Integrate `@polkadot/extension-dapp` for native Substrate balance transfers alongside the EVM provider.
4. **Custom RPC Node Selector:** Allow users to switch between official Portaldot RPC endpoints or configure custom local development nodes.
