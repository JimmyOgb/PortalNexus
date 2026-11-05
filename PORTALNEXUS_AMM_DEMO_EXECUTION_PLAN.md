# PortalNexus AMM Demo Execution Plan

**Prepared:** 2026-11-05
**Chain:** Portaldot V3 Testnet, chain ID `420420777`
**Execution status:** V2 deployment completed and independently verified. No faucet mint, approval, liquidity provision, swap, GitHub push, Vercel deployment, or DoraHacks submission occurred.

## Recommendation and go/no-go

The technically safer route is the distinct `NexusAMMNativeV2`, now deployed and verified at `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df`. Its receipt is recorded in `contracts/deployment-receipt-amm-v2.json`. V2 enforces first-liquidity minimums in contract code. No liquidity-related transactions have been executed; those steps need separate authorization and fresh exact estimates/simulations.

The legacy AMM route is cheaper only in deployment terms because it already exists. Its initial-liquidity branch ignores the minimum arguments. A trusted one-shot transaction with exact amounts, short deadline, exact simulation, and immediate post-inclusion checks can reduce exposure but cannot eliminate public transaction ordering risk. The app now blocks first liquidity on v1. Do not describe this fallback as race-safe.

## Candidate demonstration amounts

Use **1 POT + 100 pUSDC** to seed the project's previously documented 100 pUSDC/POT starting ratio. This is a demonstration assumption, not an external fair-price reference. It yields useful but small swap output:

- Seed: `1_000_000_000_000_000_000 wei` and `100_000_000` pUSDC base units.
- Minimums at 1%: `990_000_000_000_000_000 wei` POT and `99_000_000` pUSDC base units.
- At 1 POT / 100 pUSDC reserves, swap `0.01 POT` quotes `987,158` pUSDC base units (`0.987158 pUSDC`).
- At 0.5% swap slippage, `minAmountOut = 982,222` base units (`0.982222 pUSDC`).
- Initial LP shares: `9,999,999,999,000`; `1,000` minimum shares remain locked.

All amounts are small in principal terms, but Portaldot storage-related estimates dominate. Smaller principal amounts do not guarantee materially smaller fees because the number of storage writes is important.

## Exact transaction sequence (V2 route)

V2 has been separately deployed and verified at `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df` in block `333609`. The successful deployment transaction is `0x76349d5059c1be0bfe0ce83db4f43eb1099ceb89725b426b82e428ab2370e30f`; actual fee was `293.236911910284596805 POT`. Do not substitute legacy v1 address `0x407A2609dfd5336a38D6274B1EFc1804930f160A`.

| Step | Target and function | Parameters / value | Expected change | Gas / fee status |
|---|---|---|---|---|
| 0 | **Completed:** deploy `NexusAMMNativeV2` | Constructor pUSDC `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | V2 deployed and verified; reserves/shares zero | Actual fee `293.236911910284596805 POT`; receipt in `contracts/deployment-receipt-amm-v2.json`. |
| 1 | pUSDC `faucetMint(address,uint256)` | Recipient: connected deployer; amount `100000000`; value 0 | +100 pUSDC; total supply +100 pUSDC | Fresh estimate: 359,823,173,147,478 units; 7.822556 POT at snapshot gas price. |
| 2 | pUSDC `approve(address,uint256)` | Spender: verified V2 address from step 0; amount `100000000`; value 0 | Exact 100 pUSDC allowance | Fresh estimate used legacy address as spender because V2 address did not exist; 180,360,245,625,855 units; 3.921032 POT. Re-estimate for actual V2 address. |
| 3 | V2 `addLiquidity(uint256,uint256,uint256,uint256)` | `(100000000, 990000000000000000, 99000000, latestTimestamp+600)`; `msg.value = 1000000000000000000` wei | Reserves +1 POT/+100 pUSDC; position #1; LP receipt to sender | Cannot estimate against absent V2 and missing post-approval state. Exact-call simulation required after steps 0–2. |
| 4 | V2 `swapExactPOTForTokens(uint256,address,uint256)` | `(982222, deployer, latestTimestamp+600)`; `msg.value = 10000000000000000` wei | At quoted reserves: pUSDC balance +0.987158; reserves +0.01 POT/−0.987158 pUSDC | Cannot estimate against an empty pool. Exact-call simulation required after step 3. |

**Current gate:** Deployment is complete. Steps 1–4 (faucet, approval, liquidity, swap) have not been executed and require separate explicit authorization. The old estimate rows are planning snapshots only; refresh balances, block/time, gas, allowance, reserves, and exact transaction simulations before presenting a new transaction plan.

The estimate block is historical by the time execution occurs. Re-read chain ID, latest block, timestamp, gas price, wallet balance, token balance, allowance, code, and V2 reserves before producing a new approval package. Use a deadline derived from the latest block timestamp, not the static timestamp in this document.

## Required execution gates (for a later separately approved run)

1. Verify V2 deployment receipt, status, block, runtime code, `usdc()`, `receiptContract()`, `MINIMUM_LIQUIDITY()`, fee constants, and selectors. Confirm no code exists at any assumed address before deployment.
2. After each transaction, wait for receipt status success. Stop on revert, timeout, mismatch, or unexpected state. Never auto-retry.
3. Before step 2, confirm exact recipient and 100 pUSDC balance; approve only the verified V2 address and exact amount.
4. Before step 3, simulate the exact call and inspect both nonzero minimums, token amount, POT value, target address, and deadline in wallet UI.
5. Before step 4, verify reserves, LP receipt ownership, pUSDC balance, and exact simulation output/minimum. The simulation output is a quote, not a receipt.
6. After inclusion, verify receipt status, transaction hash, block, `gasUsed`, `effectiveGasPrice`, decoded event arguments, balances, reserves, LP position, and actual fee. Calculate `gasUsed × effectiveGasPrice` and reconcile against wallet balance delta; report any separate runtime deposit only if independently evidenced.
7. Store explorer links and raw JSON-RPC evidence. A swap is complete only when receipt and independent state reads match.

## Legacy v1 fallback if V2 deployment is impossible

**Not recommended for a judge-facing safety claim.** If the owner separately accepts the residual race and approves the exact transaction, the parameter values could be the same as steps 1–4 but point at `0x407A2609dfd5336a38D6274B1EFc1804930f160A`. The contract will ignore minimums if it is still empty when included. Fresh read, simulation, short deadline, and fast submission do not reserve ordering. Current frontend intentionally blocks the empty-pool v1 add path; do not bypass that block without a separately reviewed risk decision. No transaction has been prepared for wallet signing here.

## Demo run-of-show (about 2 minutes)

1. Show the production/local dApp connected to Portaldot V3, chain ID 420420777, with actual zero v1 reserves clearly labeled as legacy.
2. Open the contract-version notice. Explain why first liquidity is disabled on v1 and show the corrected V2 minimum checks in source/tests.
3. Show V2's verified address and deployment evidence before requesting any liquidity-related transaction.
4. Show the pUSDC faucet and exact approval previews; accept wallet prompts only under the separate transaction approval.
5. Add liquidity and wait for a successful receipt. Show the `LiquidityAdded` event, issued position ID/shares, and independently read reserves.
6. Prepare and simulate the 0.01 POT swap; show estimated output/minimum and 0.3% fee formula.
7. After receipt, show swap event, transaction link, gas/fee evidence, actual balance delta, and updated reserves.
8. Refresh the page to demonstrate those are persistent chain reads, not local mock state.

The current pool is empty. Do not describe a swap as demonstrated until a successful swap receipt and independent reserve/balance changes are verified.

## Judge-facing AMM explanation

“PortalNexus pairs native POT with six-decimal pUSDC in a constant-product pool. Each swap uses the 997/1000 output formula, equivalent to a 0.3% input fee retained in pool reserves. The UI reads reserves and balances from Portaldot and applies an output minimum and deadline. Legacy v1 does not enforce initial minimums, so we block its first-liquidity action; deployed V2 enforces those bounds on-chain. V2 is empty today; we report a successful swap only after receipt and reserve/balance verification.”

## Pitch deck content recommendations

- Replace any claim that the AMM has live liquidity or completed swaps with “deployed, empty, and safety-gated” until real evidence exists.
- Add a compact version table: v1 address and initialization limitation; V2 verified address and empty-pool status.
- Show the 0.3% formula and actual before/after reserve snapshot only after the swap is confirmed.
- Add a slide note that pUSDC is an unbacked testnet simulation token, not USDC or an asset with redemption value.
- Do not include fabricated hashes, balances, LP positions, fees, screenshots, or demo footage.

## Final evidence checklist

- [ ] Current chain ID, block, timestamp, gas price, deployer address, and starting balance.
- [ ] V2 deployment transaction hash, successful receipt, block, gas fields, bytecode size/hash, constructor binding, and explorer link.
- [ ] pUSDC faucet receipt and independently read balance/total supply.
- [ ] Exact allowance receipt and post-transaction `allowance(owner,V2)`.
- [ ] Liquidity receipt with decoded event, LP ID/shares, owner, reserves, and balances.
- [ ] Swap receipt with decoded `Swap` event and verified minimum/output.
- [ ] Post-swap independent reserve and wallet balance reads.
- [ ] Actual fee calculation and balance reconciliation; storage-deposit treatment explicitly evidenced.
- [ ] Fresh test output, README, demo recording, and pitch deck updated to match evidence.
- [ ] DoraHacks description prepared; submission remains a separate action.
