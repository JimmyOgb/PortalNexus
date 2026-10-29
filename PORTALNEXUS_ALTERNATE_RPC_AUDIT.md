# PortalNexus — Alternate Official RPC & Network Recovery Investigation

**Audit Date:** 2026-10-28  
**Audit Timestamp (UTC):** 2026-10-28T16:33:18Z (17:33:18 Local)  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Protected Workspace:** `C:\Users\NO GO NO\Portaldot Sentinel` (Strictly untouched)  
**Audit Outcome:** 🛑 **NO ALTERNATE ENDPOINT FOUND**  

---

## 1. Official Endpoint Discovery & DNS Infrastructure Audit

A comprehensive probe across official repositories, documentation references, and DNS namespaces was conducted to identify any secondary or alternate RPC endpoints for the **Portaldot V3 Testnet**.

### A. Official Documentation & Repository Verification
1. **Official References Reviewed:**
   - Portaldot Sentinel Architecture Specification (`Portaldot Sentinel/README.md`)
   - Portaldot Client Network Definitions (`Portaldot Sentinel/src/types/sentinel.ts`)
   - Portaldot Network Whitepaper and GitBook (`portaldot-network.gitbook.io`)
   - Official Hackathon Repositories (`portal-sentinel`, `RelayMesh`, `portal-receipt`, `vestry`, `plinths.xyz`)
2. **Documented Testnet Endpoints:**
   - Every official document and public repository exclusively specifies a single endpoint pair:
     - **EVM JSON-RPC:** `https://test-evm-rpc-v3.portaldot.dev` (Chain ID `420420777`)
     - **Substrate WebSocket:** `wss://test-node-v3.portaldot.dev` (SS58 Format `42`)
     - **Node Console:** `https://node-console.portaldot.dev/` (Web UI only)

### B. DNS Infrastructure Probing (`portaldot.dev` and `portaldot.io`)
We performed live DNS lookups across potential alternate subdomain patterns:
- **`portaldot.dev` Probed Subdomains:**
  - `test-node-v3.portaldot.dev` &rarr; `[104.21.11.196, 172.67.150.59]` (Active Cloudflare Edge)
  - `test-evm-rpc-v3.portaldot.dev` &rarr; `[104.21.11.196, 172.67.150.59]` (Active Cloudflare Edge)
  - `node-console.portaldot.dev` &rarr; `[104.21.11.196, 172.67.150.59]` (Active Cloudflare Edge)
  - `rpc.portaldot.dev`, `rpc-v3.portaldot.dev`, `testnet.portaldot.dev`, `evm.portaldot.dev`, `node.portaldot.dev`, `ws.portaldot.dev`, `test-rpc.portaldot.dev`, `test-node.portaldot.dev`: **NXDOMAIN (Non-existent)**
- **`portaldot.io` Probed Subdomains:**
  - `mainnet.portaldot.io` &rarr; `[47.242.204.5]` (Active; **Mainnet only** — strictly excluded per safety rules)
  - `testnet.portaldot.io`, `rpc.portaldot.io`, `evm.portaldot.io`, `test-evm-rpc-v3.portaldot.io`: **NXDOMAIN (Non-existent)**

**Discovery Verdict:** There is **no alternate official RPC or WebSocket endpoint** provisioned by the Portaldot network team for Portaldot V3 Testnet.

---

## 2. Chain Identity & Network Health Observations

Fresh read-only queries were executed against the verified primary endpoints:

### A. Primary EVM JSON-RPC (`https://test-evm-rpc-v3.portaldot.dev`)
- **Verified Chain ID:** `420420777` (`0x190f1ca9`)
- **Cadence Interval Verification (5,000 ms wait):**
  - **Query 1 (16:33:24 UTC):**
    - Block Height: `#232115`
    - Block Hash: `0x06890969b976a715eed528736798e683f80fbfb21defe3691c9d4f9b9da32875`
    - Block Header Timestamp: `2026-10-28T12:45:54.000Z`
  - **Query 2 (16:33:30 UTC):**
    - Block Height: `#232115`
    - Block Hash: `0x06890969b976a715eed528736798e683f80fbfb21defe3691c9d4f9b9da32875`
    - Block Header Timestamp: `2026-10-28T12:45:54.000Z`
  - **Block Progression:** **0 blocks advanced**. Stalled for $> 4.75\text{ hours}$.

### B. Primary Substrate WebSocket (`wss://test-node-v3.portaldot.dev`)
- **Best Block Height:** `#232115` (`0xa45d316ac54493ff10ac3783d915e3011780a4ff7ce4eb1c9f2ba8f3cf1379a5`)
- **Finalized Block Height:** `#232113` (`0xd95fb0bc00d6d672a8f7e51e7078ed052b602cce0528d83c0c362eed87325696`)
- **Active Peers:** **`0`** (`shouldHavePeers: true`)
- **Sync Status:** `isSyncing: false`
- **Consensus State:** The public RPC node is completely isolated with 0 peer connections. Testnet authoring validators are currently offline.

---

## 3. Funding Extrinsic & Account Balances

- **Target Funding Extrinsic:**  
  `0x9ac1b81cf1e0c3d653f147e41917236ec7c464f3c7931e795c6dd0381470b0a4`
- **Mempool Inspection (`author_pendingExtrinsics`):**
  - Total Pending Extrinsics: `16`
  - Extrinsic Status: **CONFIRMED PRESENT** at index `[2]`
  - Retention: Valid, signed by `5GmZebx...`, unexpired, and awaiting block inclusion.
- **Account Balances:**
  - **Substrate Destination (`5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`):** `0 planck` (`0.0000 tPOT`)
  - **EVM Deployer (`0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`):** `0 wei` (`0.000000 POT`)

---

## 4. Final Verdict & Next Steps

### Official Audit Outcome:
🛑 **NO ALTERNATE ENDPOINT FOUND**

1. **Infrastructure Reality:** Portaldot V3 Testnet infrastructure is centralized around the single official gateway pair (`test-evm-rpc-v3.portaldot.dev` / `test-node-v3.portaldot.dev`). No backup public RPCs exist.
2. **Current Network State:** The testnet consensus mechanism remains halted at Block `#232115`.
3. **Safety Guarantee:** No transactions or deployments can or should be broadcast. Rebroadcasting the funding transfer is neither necessary nor effective, as it is already preserved in the mempool.
4. **Action:** Await testnet validator restart by the Portaldot infrastructure team.
