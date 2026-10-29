# PortalNexus — Live Integration Report

Network: Portaldot V3 Testnet (420420777). pUSDC `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`, AMM `0x407A2609dfd5336a38D6274B1EFc1804930f160A`.
**No transaction was broadcast, nothing deployed, no Git, no private keys touched. `Portaldot Sentinel` untouched.**

## Files changed
- NEW `src/contracts/abi.ts` — selectors, event topic, minimal ABI encode/decode
- NEW `src/services/ammService.ts` — live reads, quote math, input validation, tx preparation (no signing/sending), `TX_SUBMISSION_ENABLED = false`
- NEW `src/components/AmmPanel.tsx` — live UI (Swap / Add / Remove / Faucet)
- NEW `tests/liveIntegration.test.ts` (14 tests)
- EDIT `src/contracts/config.ts` — added `LIVE_DEPLOYMENT` (addresses from the deployment receipt); registry untouched
- EDIT `src/components/Dashboard.tsx` — removed hardcoded 10,000/25,000 reserves, WPOT/Wrap tab and simulated quote; tabs now "Cross-VM Map" and "Nexus AMM (native POT)"
- Contracts, receipts and old docs unchanged.

## Contract interfaces verified (from source + compiled artifacts)
- pUSDC: `faucetMint(address to,uint256 amount)` (cap 10,000e6 per call, **takes a recipient — not no-arg**), `approve`, `allowance`, `balanceOf`, 6 decimals
- AMM: `getReserves()`, `totalLiquidityShares()`, `addLiquidity(usdcDesired,minPOT,minUSDC,deadline)` **payable**, `removeLiquidity(tokenId,minPOT,minUSDC,to,deadline)`, `swapExactPOTForTokens(minOut,to,deadline)` **payable**, `swapExactTokensForPOT(amountIn,minOut,to,deadline)`, `getPosition`, `ownerOf`, `LiquidityAdded` event
- **Approval IS required** for pUSDC → AMM (`transferFrom` checks allowance) on addLiquidity and pUSDC→POT swap. The UI prepares an exact-amount `approve` (never unlimited) when allowance is insufficient. POT side needs no approval (msg.value).
- LP model: one ERC-721-style position per deposit inside the AMM; `removeLiquidity` redeems the **whole** position (no partial removal). There is no enumeration function, so positions are discovered via `LiquidityAdded` logs filtered by provider, then verified with `ownerOf` + `getPosition`.
- Selectors are asserted equal to the Hardhat artifact ABIs in tests.

## Features
- Live reserves, total shares, native POT balance, pUSDC balance, allowance, LP positions with current value.
- States: loading, disconnected, wrong network, RPC error (no fallback data), empty pool (explicit "trading unavailable until liquidity is added").
- Prepared (not sent) flows with confirmation details: estimate, min output, 0.3% fee, price impact, slippage, deadline, recipient, target/value/selector.
- pUSDC labelled as a test token with no value or backing. Wrap action removed; WPOT wording gone from user flows.
- Submit button is permanently disabled (`TX_SUBMISSION_ENABLED=false`) and says so.

## Test results
| Check | Result |
|---|---|
| Frontend `vitest run` | 8 files, **66 passed** (14 new) |
| `tsc --noEmit` | pass |
| `npm run build` | pass |
| Contract tests (`npm run test:contracts`) | **46 passing** |

## Known limitations
- Live reads were **not** exercised against the real RPC (only mocked in tests); the UI has not been viewed in a browser/wallet.
- Log-based position discovery depends on the RPC supporting `eth_getLogs` over the range from block 237284; failure shows a position error, not fake data.
- Estimates use state at read time; the block timestamp is approximated by local clock for deadlines.
- Add-liquidity approval is exact-amount, so `approve` and `addLiquidity` are two separate future transactions; reserves moving between them could revert within slippage limits.
- Substrate-side/receipt-transfer UI not implemented. Legacy `deploymentService`/`DeploymentModal` code remains but is unrelated.

## Next steps requiring explicit approval
1. Read-only smoke test of `getReserves()` against the live RPC and one browser/wallet connect check (no tx).
2. Enable submission behind a flag; testnet `faucetMint` of a small amount.
3. `approve` exact amount, then first `addLiquidity` (sets initial price; 1000 shares locked).
4. Small swaps each direction, then `removeLiquidity`, verifying balances and events.
