# PortalNexus AMM First-Liquidity Safety Remediation

**Prepared:** 2026-11-05
**Network:** Portaldot V3 Testnet, EVM chain ID `420420777`
**Scope:** Local source/test changes and the separately authorized NexusAMMNativeV2 deployment. No faucet mint, approval, liquidity action, swap, push, or submission was performed.

## Latest live state checked

At block `333238` on 2026-11-05, read-only RPC returned chain ID `420420777`, deployer native balance `74.6304598478621092 POT`, pUSDC total supply and deployer balance `0`, allowance `0`, v1 reserves `0 POT / 0 pUSDC`, total liquidity shares `0`, and deployer LP position count `0`. PortalTestStorage still returned `42`. At block `333515`, the authorized deployer balance was `374.6304598478621092 POT`; no write followed. These are observations at the stated blocks, not guarantees about later chain state.

## Recommendation

Use a separately deployed corrected AMM version for the first-liquidity demonstration. `NexusAMMNativeV2.sol` now requires explicit nonzero POT and pUSDC minimums and checks the amounts actually accepted after reserve-ratio calculation. Keep the deployed v1 at `0x407A2609dfd5336a38D6274B1EFc1804930f160A` intact for historical evidence and read-only monitoring. The frontend now refuses to prepare first liquidity for v1.

V2 is deployed and independently verified. The 300 POT authorization correctly stopped the earlier attempt; under the later explicit 330 POT cap, a fresh preflight at block 333,596 estimated a maximum fee of `327.6008359776281529 POT` with 10% gas-limit headroom. The deployment was included at block `333609`, transaction `0x76349d5059c1be0bfe0ce83db4f43eb1099ceb89725b426b82e428ab2370e30f`; actual fee was `293.236911910284596805 POT`. V2 is still empty: no liquidity or swap has occurred.

## What the deployed v1 can and cannot enforce

The deployed v1 ABI exposes `addLiquidity`, both swaps, liquidity removal, reserve/share getters, position getters, and `usdc()`. There is no initialization-only function, immutable price, factory, or pool ratio parameter. `usdc` is immutable and bound to the deployed pUSDC. Source/artifact selectors and live getters match; the observed v1 runtime size is 3,305 bytes.

The v1 initial branch assigns `amountUSDCDesired` and `msg.value` directly and does not read `minAmountPOT` or `minAmountUSDC`. Its bytecode is immutable at this address. Changing frontend calldata or doing a preflight read cannot make those bounds execute in v1.

## Solution comparison

| Approach | Race effect | New deployment? | Cost / compatibility / deadline assessment |
|---|---|---:|---|
| Change only the v1 Solidity source | None on the already deployed address; source edits do not change bytecode | Yes, if the change is to take effect | V2 is ABI-compatible with the current native-POT panel, but requires switching the selected AMM address after independent deployment verification. The fresh 10%-headroom exposure is 327.601 POT, above the authorized 300 POT deployment cap. |
| Deploy `NexusAMMNativeV2` | Enforces both nonzero minimums and actual received/spent minima. A raced pool that would force contribution below either minimum reverts. The first provider still chooses the market price; minimums are slippage bounds, not an oracle or fair-price guarantee. | Yes | Lowest complexity of corrected options. Runtime state shape and external function signatures remain compatible. Fresh 10%-headroom fee exposure is 327.60 POT, above the authorized 300 POT cap. |
| Atomic factory that deploys and seeds in one transaction | Removes the interval in which the newly created pool is publicly visible and empty. A creator-specific factory path can prevent another caller from substituting its desired seed before deployment. It still cannot establish a fair price without a trusted price reference. | Yes: factory and pool | More bytecode, storage, audit work, and transaction complexity. Factory must atomically transfer the approved pUSDC, deploy, initialize, and assign LP ownership. Higher cost than V2 and not a responsible one-day addition under present funding constraints. |
| Seed liquidity in the V2 constructor | The pool becomes visible already seeded, removing a public empty-pool interval for that address. The constructor still needs token funding/allowance to the deployment address or a factory-mediated transfer. | Yes | Requires a redesigned constructor/deployment flow and careful address/approval handling. Deployment storage footprint increases. Not tested or implemented in this change; no cost estimate validated. |
| Trusted one-shot initialization on v1 | Reduces exposure with a fresh pool-state read, exact transaction simulation, short deadline, immediate wallet submission, and immediate post-inclusion checks. **Does not eliminate the race** because v1 ignores initial minimums. | No | Best fallback only if the owner explicitly accepts the residual public-mempool risk. Existing interface now blocks this path. No verified Portaldot private transaction relay or atomic bundle mechanism was found in the inspected project/runtime documentation. |
| Rely on transaction ordering / nonce | A sender nonce orders that sender's own transactions only; it does not reserve first place against another account's transaction. A short deadline limits stale execution time but not ordering. | No | Not a safety fix. No private relay or atomic-bundle mechanism was validated in the project or RPC interfaces reviewed. |

## Corrected V2 behavior

`NexusAMMNativeV2` preserves the deployed v1 entrypoint signatures, native POT/pUSDC pair, 997/1000 fee formula, receipt bookkeeping, events, and 1,000 minimum-liquidity shares. It adds:

- Nonzero minimum requirements for both contributed assets.
- A check that both actual accepted asset amounts satisfy those minima on first and subsequent deposits.
- A custom error for insufficient initial shares instead of arithmetic underflow.
- Public fee numerator/denominator constants used by both swap paths.
- Existing deadline, zero-value, reserve, output-minimum, reentrancy, and receipt-burn behavior.

The first depositor still chooses the initial price. In a proposed one-POT/100-pUSDC seed, the UI must show the implied **100 pUSDC per POT** ratio and explicit minimum amounts. If another account seeds first, V2 must reject a deposit whose ratio requires accepting less than either configured minimum. No price oracle is present.

## Frontend remediation

- Live v1 reserves, pUSDC supply, balances, allowances, and LP position reads remain on-chain reads; no fallback values are introduced.
- First-liquidity quote math now computes nonzero minimums using the configured slippage tolerance, but the known legacy target is blocked before transaction preparation. The UI explains that frontend checks cannot fix v1 bytecode.
- Immediately before each wallet prompt, the panel rereads reserves and rejects a changed snapshot. It then simulates the exact `{from,to,data,value}` with `eth_call`; a revert or unsupported simulation fails closed.
- A non-confirmed transaction status stops the sequence. An approval receipt that is not confirmed cannot be followed by an AMM call.
- The V2 deployment descriptor is active only after the address, runtime code, constructor binding, getters, and successful receipt were independently verified.

These checks reduce stale-quote and error risks but do not substitute for V2's on-chain minimum enforcement. V2 is now the selected AMM target after independent verification. The separate deployment record is `contracts/deployment-receipt-amm-v2.json`; the UI retains v1's limitation disclosure and shows V2's empty-pool status. AMM transaction submission remains disabled pending separate authorization.

## Deployment and release checklist

Before V2 can be used:

1. **Completed:** deploy V2 under a separate 330 POT cap after fresh estimate, 10% gas-limit headroom, exact creation-call simulation, and artifact/constructor verification.
2. Independently simulate deployment and all sequential transactions with current block state and report storage/deposit charges distinctly.
3. **Completed:** V2 deployment receipt and runtime/configuration were independently verified.
4. Verify chain ID, constructor-bound pUSDC, runtime code, selectors, minimum-liquidity constant, fee constants, and receipt status.
5. **Completed:** V2 is a separate registry entry; v1 remains unchanged and labeled legacy.
6. **Completed:** UI selects V2 after code verification and shows the v1 disclosure.
7. Execute faucet, exact allowance, add liquidity, and swap only after separate exact transaction approval.
8. Confirm every receipt and independently read balances, reserves, share total, owner/position, events, gas used, and effective gas price.

## Current conclusion

V1 cannot be made race-safe locally. V2 was deployed within the subsequently authorized 330 POT cap and is the active corrected implementation. Its runtime code, constructor binding, receipt, and configuration were independently verified. The pool remains empty and no successful liquidity or swap is claimed. A controlled v1 initialization remains a residual-risk fallback and is not enabled.

## Fresh verification

- `npm test`: **194 passed** across 15 files.
- `npm run test:contracts`: **52 passed**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**.

The public-RPC registry test exceeded its original 15-second timeout twice; its per-test timeout was raised to 30 seconds, and the final full run passed with the live RPC check completing in about 3 seconds. Tests use local contract fixtures except the explicitly named read-only contract-inspection test. These results validate local implementation and read paths; they do not establish deployed V2 behavior or a successful live swap.
