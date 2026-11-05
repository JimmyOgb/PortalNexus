# PortalNexus AMM Cost Analysis

**Snapshot:** Portaldot V3 EVM RPC, block `333136`, chain ID `420420777`
**Status:** Read-only RPC estimates and historical receipt reads. No transaction sent.

## Current wallet and RPC estimates

Deployer `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A` balance was `74.630459847862109200 POT`. The RPC returned gas price `21,740 wei`.

| Call | RPC `eth_estimateGas` | Estimate × gas price | State of estimate |
|---|---:|---:|---|
| Deploy `NexusAMMNativeV2(pUSDC)` | `13,699,123,358,364,237` | `297.818941810838512380 POT` | Fresh read-only estimate at block 333,136; not a signed transaction or guaranteed final charge. |
| `faucetMint(deployer, 100 pUSDC)` | `359,823,173,147,478` | `7.822555784226171720 POT` | Fresh read-only estimate at block 333,136. |
| `approve(V2, 100 pUSDC)` | `180,360,245,625,855` | `3.921031739906087700 POT` | Fresh read-only estimate at block 333,136. Target address is hypothetical until V2 is deployed. |
| Initial liquidity | Not estimable against current state | Unknown | V2 does not yet exist; exact approval and token balance state are not available to RPC simulation. |
| Swap | Not estimable against current state | Unknown | No seeded pool exists. A meaningful exact-call simulation needs post-liquidity state. |

The V2 deployment estimate alone is about **3.99×** the recorded balance, with a shortfall of about **223.18848 POT**. It is financially impractical from that account.

## Why the estimate numbers are large

On this Portaldot revive endpoint, `eth_estimateGas` returns very large gas-like quantities for storage-changing EVM calls. Multiplying those quantities by the RPC gas price yields the estimated POT exposure above. The estimates reflect the chain's revive cost model, including storage-related costs represented through the EVM transaction estimate; they should not be interpreted as ordinary EVM CPU gas alone.

Historical public receipts corroborate the scale. Read-only `eth_getTransactionReceipt` returned:

| Historical transaction | Block | `gasUsed` | `effectiveGasPrice` | Product |
|---|---:|---:|---:|---:|
| pUSDC deployment | 237,279 | `4,664,872,854,966,639` | `27,625 wei` | `128.867112618453402375 POT` |
| Legacy AMM deployment | 237,284 | `10,097,535,378,439,017` | `27,625 wei` | `278.944414829377844625 POT` |
| PortalTestStorage deployment | 261,857 | `1,480,293,021,720,810` | `25,980 wei` | `38.458012704306643800 POT` |

Receipt-level execution charge is reported as `gasUsed × effectiveGasPrice`. It is not safe to add a separate modeled storage-deposit figure to that product unless a runtime receipt/event proves that the deposit is a separate debit; doing so could double count. For the future demo, record receipt fields and reconcile the wallet balance delta independently.

The current estimate for V2 is higher than the old AMM deployment receipt's historical product. Gas price and storage/code accounting differ by block and deployment bytecode. The estimate is not a promise of the eventual amount.

## Storage deposit refundability

The Polkadot SDK `pallet_revive` source models storage deposits as `Charge` or `Refund` and documents that failed contract execution rolls back its storage changes and associated deposit. It also has refund paths when storage is removed. See the [contract result storage-deposit definition](https://paritytech.github.io/polkadot-sdk/master/src/pallet_revive/primitives.rs.html) and [storage metering/refund implementation](https://paritytech.github.io/polkadot-sdk/master/src/pallet_revive/metering/storage.rs.html).

That establishes a runtime mechanism, not the exact reclaimability or timing for this Portaldot deployment/account. Prior PortalNexus cost records classify the EVM-visible storage-refund path as unverified. Budget deposits as **unavailable/spent capital** until a live balance delta or documented Portaldot reclaim procedure proves otherwise. Do not count possible refunds as remaining spend capacity.

## Demonstration budgets and hard stop

### Existing v1 fallback

Fresh estimates for faucet + approval are `11.743587526310348 POT`. The proposal also needs `1 POT` liquidity principal plus `0.01 POT` swap input. An earlier October 31 preflight modeled the v1 add-liquidity debit near `17.9725 POT`; that is historical, not a current estimate. The swap's precise charge remains unknown because the pool is empty.

For screening only, require an execution plan to fit under a **50 POT total wallet-debit budget**, including the 1.01 POT principal and all measured fees. This leaves about `24.63 POT` from the snapshot balance. This is an owner-enforced stop limit, **not a guaranteed protocol maximum**. Do not proceed if the current sequential simulations cannot bound all four calls under it. Given v1's race, meeting the budget does not make initialization safe.

### Corrected V2

Known components before unknown add/swap charges:

```text
V2 deployment estimate       297.818942 POT
100 pUSDC faucet estimate      7.822556 POT
100 pUSDC approval estimate    3.921032 POT
1 POT liquidity principal      1.000000 POT
0.01 POT swap principal        0.010000 POT
                               -----------
Known subtotal               310.572530 POT
```

Add-liquidity and swap charges are not yet estimable against live post-deployment state. An old v1 add-liquidity simulation around `17.9725 POT` would raise this to about `328.545 POT` before swap fee and drift; it is not a V2 quote. A funding screen of **at least 380 POT** (known subtotal plus historical add estimate plus roughly 15% headroom) is a planning floor, **not an absolute maximum**. The current wallet is short by over 300 POT relative to that screen. This recommendation is not a request to fund the wallet.

## Transaction ordering and cost reduction

- Faucet and approval must be included before add liquidity can use the tokens/allowance. They cannot safely be combined as separate EOA transactions without confirmed sequencing; the current frontend should await each confirmed receipt.
- A V2 factory could bundle deployment and initialization into one atomic transaction, but it adds factory bytecode/storage and does not remove the need to fund deployment or swap operations. No validated factory estimate exists.
- Reusing an exact allowance or lowering input amounts may reduce some storage writes, but does not justify unlimited approvals or removing minimums. Faucet, approval, and LP receipt creation create persistent mapping/state changes.
- Exact per-call `eth_estimateGas` against the simulated state sequence is required before approval. The current empty-pool RPC state cannot produce a trustworthy add/swap estimate.

## Decision

Do not deploy if the maximum-fee calculation with headroom exceeds the authorized cap. Do not describe 50 POT or 380 POT as guaranteed chain maximums. V1's low-cost path still carries an unfixable-by-frontend initialization race.

## Earlier 300 POT cap stop (2026-11-05, block 333515)

The authorized local signer derived to the expected EVM address `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`; no signing key material was printed. Live RPC confirmed chain ID `420420777`, native balance `374.6304598478621092 POT`, gas price `21,720 wei`, and latest block `333515`.

The deterministic AccountId32 mapping for the EVM address is `0xdc7f5c7813a5f0e3f51c2fe569de6c5577768a2aeeeeeeeeeeeeeeeeeeeeeeee`, SS58 prefix 42 `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`; it matches the repository's recorded mapping vector.

The current artifact was simulated with the exact V2 creation bytecode and constructor argument `pUSDC = 0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`. The compiler artifact is Solidity `0.8.24`, Cancun EVM, optimizer enabled at 200 runs, viaIR enabled, and has no linked libraries. Initcode is 3,695 bytes. `eth_call` returned 3,488 bytes of runtime code, and that runtime matched the compiled artifact after applying the constructor-bound immutable pUSDC value. Fresh `eth_estimateGas` was `13,711,737,651,952,255` gas-like units. At `21,720 wei`, the estimate × gas price is `297.818941800402978600 POT`.

With 10% gas-limit headroom:

```text
estimated gas limit             13,711,737,651,952,255
gas limit with 10% headroom     15,082,911,417,147,481
max fee at 21,720 wei            327.600835980443287320 POT
authorized deployment cap        300.000000000000000000 POT
cap shortfall                     27.600835980443287320 POT
```

**STOP: no deployment was broadcast under the original 300 POT cap.** The estimate alone was below 300 POT, but the explicitly requested 10% gas-limit headroom made the maximum exposure exceed that cap by `27.600835980443287320 POT`. The wallet balance did not expand the original authorization.

The contract tests, frontend tests, typecheck, and build passed at that time: **52 contract tests**, **194 frontend tests**, typecheck passed, build passed. Those results are historical, not the post-integration quality gate.

## Revised authorized deployment and actual outcome

Under the user's separate 330 POT cap, a fresh preflight read at block `333596` confirmed the expected deployer `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`, chain `420420777`, balance `374.6304598478621092 POT`, and current gas price `21,715 wei`. The exact V2 creation call used constructor pUSDC `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002`, Solidity `0.8.24`, Cancun, optimizer 200 runs, viaIR, no linked libraries. Its simulation returned runtime matching the compiled artifact with the constructor immutable applied.

| Measure | Value |
|---|---:|
| Fresh `eth_estimateGas` | `13,714,894,855,990,963` gas-like units |
| Gas limit (+10%) | `15,086,384,341,590,060` |
| Maximum fee at pinned gas price | `327.6008359776281529 POT` |
| Authorized cap | `330 POT` |
| Remaining cap headroom | `2.3991640223718471 POT` |
| Actual gas used | `13,503,887,262,734,727` |
| Actual effective gas price | `21,715 wei` |
| Actual fee | `293.236911910284596805 POT` |
| Contract / block / tx | `0x9c01D8C8E5c04079AfaB9d3eF95895f5350F01Df` / `333609` / `0x76349d5059c1be0bfe0ce83db4f43eb1099ceb89725b426b82e428ab2370e30f` |

The successful receipt had status `1`. A separate RPC verification confirmed runtime code (3,488 bytes; Keccak256 `0x53e792c956039e42b583a9dd49d95cc58c2eebf978d8ade396b632f08c115363`), `usdc()` equals the constructor argument, `receiptContract()` equals the AMM address, minimum liquidity is `1000`, fee constants are `997/1000`, and reserves/share supply are zero. A later live balance read was `81.393547937577512395 POT`; it is a post-deployment snapshot, not a guaranteed current balance. Full receipt data is in `contracts/deployment-receipt-amm-v2.json`.
