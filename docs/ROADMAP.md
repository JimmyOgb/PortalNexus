# PortalNexus — Post-Hackathon Roadmap

All items below are **planned future work** and are not claimed as completed features in the current prototype release.

---

## Phase 1 — Testnet Liquidity Seeding & End-to-End Transaction Validation (Immediate Next Step)
- **Prerequisite:** Top up the deployer/test wallet (`0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A` / SS58 `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`) with $\ge 50\text{ tPOT}$ from the Portaldot community faucet to cover `pallet-revive` trie storage deposits (~25–35 POT across new mapping slots).
- **Sequential Execution (per [`PORTALNEXUS_TRANSACTION_TEST_PLAN.md`](../PORTALNEXUS_TRANSACTION_TEST_PLAN.md)):**
  1. Claim `20.00 pUSDC` via `TestUSDCMin.faucetMint` (`~7.82 POT` storage deposit).
  2. Approve `15.00 pUSDC` for `NexusAMMNative` (`~3.92 POT` storage deposit).
  3. Seed initial pool liquidity (`0.50 POT` + `10.00 pUSDC`) via `NexusAMMNative.addLiquidity` (`~14–18 POT` storage deposit).
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
