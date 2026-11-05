# PortalNexus — Post-Hackathon Roadmap

> **Status:** The transaction sequence below is a historical proposal, not an executable guide. AMM and faucet submissions are disabled in the current app. The legacy V1 address must not be used for liquidity. Any future test plan must target V2, use fresh live state and current fee estimates, preserve nonzero minimums/deadlines, and receive separate explicit transaction authorization.

All items below are **planned future work** and are not claimed as completed features in the current prototype release.

---

## Phase 1 — Testnet Liquidity Seeding & End-to-End Transaction Validation (Immediate Next Step)
- **Prerequisite:** No additional funding is authorized. The historical 50 tPOT top-up and 25–35 POT cost estimate are obsolete and must not be used as current guidance. The app's AMM and faucet transaction gates remain disabled; preserve the existing 20 tPOT aggregate test cap.
- **Sequential Execution (per [`PORTALNEXUS_TRANSACTION_TEST_PLAN.md`](../PORTALNEXUS_TRANSACTION_TEST_PLAN.md)):**
  1. The app faucet control is disabled. A future mint, if separately authorized, would target the test-token faucet; the old `20.00 pUSDC` and `~7.82 POT` estimate is historical and must not be reused.
  2. If separately authorized, approve only the exact required pUSDC amount for active `NexusAMMNativeV2` (`0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df`); historical V1 approval estimates are not current estimates.
  3. If separately authorized and current preflight permits it, prepare initial V2 liquidity with nonzero minimum POT/pUSDC amounts, a short deadline, and the intended initial ratio. Do not use V1 or reuse the historical 0.50 POT / 10.00 pUSDC proposal without fresh state and fee checks.
  4. Execute and verify bidirectional swaps (`swapExactPOTForTokens` and `swapExactTokensForPOT`) and partial/full liquidity removal (`removeLiquidity`).
  5. Enable opt-in transaction broadcasting in the UI behind explicit user confirmation and wallet network guards.

## Phase 2 — Public Hosted Frontend & Real-Wallet Extension QA
- Deploy the static Vite production bundle (`dist/`) to a zero-cost static host (GitHub Pages / Vercel / Cloudflare Pages).
- Conduct manual end-to-end QA sessions with MetaMask, Rabby, Talisman, and SubWallet browser extensions across Windows, macOS, and Linux.
- Add indexed event caching so LP position discovery remains fast as block history grows beyond 100,000 blocks.

## Phase 3 — Reusable Open-Source SDK for Portaldot V3 Builders
- Extract `src/lib/reviveMapper.ts` and the `pallet-revive` gas/storage-deposit estimator into a standalone MIT-licensed npm package (`@portalnexus/revive-kit`) so any Portaldot V3 developer can safely convert SS58↔H160 addresses and predict storage rent before broadcasting transactions.

## Phase 4 — Multi-Pool Routing & Security Auditing (Long-Term)
- Expand from a single `Native POT / pUSDC` pair to a factory/router architecture optimized for `pallet-revive` bytecode limits.
- Integrate native Substrate `pallet_revive::map_account` status detection via Substrate state storage reads (`Revive::OriginalAccount`).
- Complete independent third-party smart contract security audits before any mainnet deployment.
