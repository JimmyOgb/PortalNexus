# PortalNexus — Live RPC & Wallet Smoke Test Report (read-only)

Date: 2026-10-29. No transaction was signed or broadcast; no source, address or receipt was modified. Scratch scripts are in `scratch/` (`smoke.cjs`, `ui.py`, `ui2.py`, screenshots).

## 1. Live RPC evidence (LIVE)
RPC `https://test-evm-rpc-v3.portaldot.dev`

| Check | Result |
|---|---|
| `eth_chainId` | `0x190f1ca9` = **420420777** ✅ |
| `eth_blockNumber` ×3 | `0x3a02f` = **237615** each time (consistent). Deploy blocks were 237279/237284. |
| Reads pinned to block | 237615 |

## 2. Bytecode and getters (LIVE, `eth_call` at block 237615, decoded with the artifact ABIs)
| Item | Result |
|---|---|
| `eth_getCode` pUSDC | 1482 bytes (matches receipt `bytecodeSize`) ✅ |
| `eth_getCode` AMM | 3305 bytes (matches receipt) ✅ |
| AMM `getReserves()` (`0x0902f1ac`) | raw = 64 zero bytes → **(0, 0)** |
| AMM `reservePOT()` / `reserveUSDC()` / `totalLiquidityShares()` | 0 / 0 / 0 |
| AMM `usdc()` (`0x3e413bee`) | `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` ✅ |
| AMM `receiptContract()` (`0xd435b3a3`) | `0x407A2609dfd5336a38D6274B1EFc1804930f160A` (itself) ✅ |
| AMM `MINIMUM_LIQUIDITY()` | 1000 |
| pUSDC `name()` / `symbol()` / `decimals()` | "Portal Test USD" / "pUSDC" / 6 |
| pUSDC `totalSupply()` | 0 (no faucet mints yet) |
| pUSDC `MAX_MINT_PER_CALL()` | 10000000000 (10,000 pUSDC) |
| `eth_getLogs` on AMM, blocks 237284→237615 | 0 logs (no liquidity ever added) |
| `eth_getLogs` on pUSDC (unfiltered) | **No response**; the call hung until I cancelled it. Not needed by the app, which only queries AMM logs. Unresolved. |

**The pool is empty on-chain.** Earlier reports' empty state still holds.

## 3. Browser / UI (LIVE app, headless Chromium via Playwright; `npm run dev` on 127.0.0.1:5173)
- Dev server started with the project's `npm run dev`; app rendered with no console errors.
- **Disconnected state** ✅: "Wallet disconnected…", balances shown as "—", Submit button disabled.
- **Reserves** ✅: AmmPanel shows 0.00 POT / 0.00 pUSDC / 0 shares, matching `getReserves()`.
- **Zero-reserve handling** ✅: the banner "The pool has zero reserves. Trading is unavailable until liquidity is added." and "Trading is unavailable…" appear; no quote is shown.
- **RPC-error state** ✅ (observed live): in one run the RPC timed out; the panel showed "RPC error: Timeout connecting to …. Live data unavailable — nothing is shown as a fallback." with no reserve numbers. That run is evidence the RPC can be intermittently slow.
- Network traffic from the page was only `eth_call`, `eth_chainId`, `net_version`, `web3_clientVersion`, `eth_getBalance`, `eth_getLogs`. No write methods.
- Submit button was disabled in every state (`#submit-guarded`). Not changed.

## 4. Wallet connection
- **No real wallet was tested.** A fresh headless browser has no extension, and I did not use your browser profile or any wallet.
- Wallet paths were exercised with an **injected stub `window.ethereum` (MOCK)**. The stub rejects `eth_sendTransaction`, signing and network-switch methods and records the attempt; `blocked_write_calls` was empty in all runs.
  - Wrong network (stub chain 0x1): UI shows "Unsupported network (chain 1). Switch to Portaldot V3…" ✅
  - User rejection (stub 4001 on `eth_requestAccounts`): app stays disconnected, no crash ✅ (the rejection message appears in the header connect button tooltip, not in the panel).
  - Correct chain (stub 0x190f1ca9, address `0xdC7f…8A2A`): panel shows POT balance **13.088472 POT** and pUSDC **0.00 pUSDC**, read through the app's own RPC client (not the stub, which returns 0x0 for balance). 13.0884 matches the deployer's `finalBalance` in the deployment receipt. pUSDC 0.00 is consistent with `totalSupply` = 0. I did not independently re-query `balanceOf` for that address in this session.
- Stub-reported address/chain matched what the app displayed. A genuine wallet check is outstanding.
- I did not switch networks or change any wallet settings.

## 5. Mismatches / blockers
- None in decoded contract data versus receipt/source.
- Intermittent RPC slowness (7 s timeout hit once; one unfiltered pUSDC `eth_getLogs` never returned).
- LP positions: logs query ran (`eth_getLogs` seen) but there are zero events, so **no positions were displayed**, as expected. The position verification path (`ownerOf`/`getPosition`) was not exercised live.

## 6. Live vs mocked vs untested
- **Live:** chain id, block numbers, bytecode, all getter reads, AMM logs query, UI rendering against live RPC, empty-pool state, one RPC-timeout state, live POT/pUSDC balance reads for the deployer address.
- **Mocked:** wallet provider (wrong network, rejection, connected) in this session; all of `tests/liveIntegration.test.ts`.
- **Untested:** a real wallet extension; display with a non-empty pool; LP position display; quotes against real reserves; faucet/approve/add/remove/swap (no broadcasts, buttons disabled by design); gas estimation; `eth_estimateGas`/`eth_call` simulation of prepared transactions.

## Next (needs your approval)
Manual connect with your own wallet (no signing); then, if desired, transaction-level tests starting with a small `faucetMint`.
