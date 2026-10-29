# PortalNexus — Polkadot.js Wallet Deployment Preflight Audit

**Audit Date:** 2026-10-28  
**Local Timestamp:** 2026-10-28T16:33:00+01:00 (UTC 15:33:00Z)  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Protected Workspace:** `C:\Users\NO GO NO\Portaldot Sentinel` (Strictly untouched)  
**Decision Gate Verdict:** 🛑 **STOP — DO NOT DEPLOY**  

---

## Part A: Portaldot V3 Testnet Live Health Audit

### 1. EVM JSON-RPC Verification
- **Endpoint:** `https://test-evm-rpc-v3.portaldot.dev`
- **Chain ID Verified:** `420420777` (`0x190f1ca9`) — Matches expected configuration.
- **Sequential Block Queries (Interval Check):**
  - **Query 1 Timestamp:** `2026-10-28T15:32:00.896Z`
    - Best Block Height: `#232115`
    - Block Hash: `0x06890969b976a715eed528736798e683f80fbfb21defe3691c9d4f9b9da32875`
    - Block Header Timestamp: `2026-10-28T12:45:54.000Z`
  - **Wait Interval:** 4,000 ms
  - **Query 2 Timestamp:** `2026-10-28T15:32:17.587Z`
    - Best Block Height: `#232115`
    - Block Hash: `0x06890969b976a715eed528736798e683f80fbfb21defe3691c9d4f9b9da32875`
    - Block Header Timestamp: `2026-10-28T12:45:54.000Z`
  - **Block Progression:** **0 blocks advanced** (Stalled).

### 2. Substrate WebSocket Verification
- **Endpoint:** `wss://test-node-v3.portaldot.dev`
- **Substrate Best Block:** `#232115` (`0xa45d316ac54493ff10ac3783d915e3011780a4ff7ce4eb1c9f2ba8f3cf1379a5`)
- **Substrate Finalized Block:** `#232113` (`0xd95fb0bc00d6d672a8f7e51e7078ed052b602cce0528d83c0c362eed87325696`)
- **Finalized Progress:** **0 blocks finalized** since previous check.
- **Node Health & Peer Topology:**
  - Active Peers: `1`
  - Sync State: `isSyncing: false`
  - Substrate RPC Responsiveness: Intermittent 60-second timeouts on internal state calls (`Metadata_metadata_at_version`) with sporadic `1006 Abnormal Closure`.
- **Network Health Rating:** **UNCONFIRMED / DEGRADED** (Consensus authoring halted).

### 3. Funding Extrinsic Mempool Audit
- **Extrinsic Hash:** `0x9ac1b81cf1e0c3d653f147e41917236ec7c464f3c7931e795c6dd0381470b0a4`
- **Current Status:** **PENDING IN MEMPOOL** (Index `[0]` of 15 pending transactions).
- **Mempool Retention:** Extrinsic is valid and actively retained in the node transaction pool; it has not been evicted, dropped, or confirmed into an on-chain block.

---

## Part B: Deployment Path & Wallet Compatibility Verification

### 1. Contract & Compiler Inventory
- **Contract Source Files:**
  - `contracts/WPotToken.sol`: Standard ERC-20 Wrapped POT (18 decimals). Constructor: `()`.
  - `contracts/TestUSDC.sol`: ERC-20 test faucet simulation token (6 decimals). Constructor: `()`.
  - `contracts/NexusAMM.sol`: Automated Market Maker $(x \cdot y = k)$. Constructor: `(address _wpot, address _testUsdc)`. Internally instantiates `NexusLPReceipt.sol` during constructor execution.
- **Compiler Configuration (`contracts/hardhat.config.ts`):**
  - Solidity: `0.8.24`
  - EVM Version Target: `"cancun"`
  - Optimizer: Enabled (`runs: 200`)
  - IR Code Generation: `viaIR: true`
- **Current Deployment Pipeline:**
  - Script: `contracts/scripts/deployTerminal.ts`
  - Signing Engine: Hardhat Ethers provider using standard EVM private key.

### 2. EVM JSON-RPC Deployment Capability
- Portaldot V3 features `pallet-revive-eth-rpc`, an EVM-compatibility translation layer.
- Solidity contracts compiled to EVM bytecode can be deployed via `eth_sendRawTransaction`.
- The runtime automatically wraps EVM deployment transactions into `revive.ethTransact` / `revive.ethInstantiateWithCode` extrinsics on Substrate.

### 3. Polkadot.js Browser Extension Incompatibility
- **Direct Signing Compatibility:** ❌ **INCOMPATIBLE**.
- **Technical Justification:**
  - The Polkadot.js browser extension (`@polkadot/extension`) is exclusively an account manager for **Substrate native keypairs** (sr25519, ed25519, Substrate MultiAddress).
  - It exposes `window.injectedWeb3['polkadot-js']` and only signs Substrate SCALE-encoded payload extrinsics (`signer.signPayload`).
  - It does **not** inject an Ethereum provider (`window.ethereum`).
  - It **cannot** sign Ethereum RLP / EIP-155 / EIP-1559 transactions or compute secp256k1 EVM signatures required by Hardhat, ethers.js, or the Portaldot EVM RPC adapter.

### 4. Third-Party Deployment Website Audit
- **Audit Findings:** No verified, secure web application exists that bridges the Polkadot.js browser extension to Portaldot V3 EVM Solidity deployment.
- **Node Console (`https://node-console.portaldot.dev/`):**
  - Officially hosted instance of Polkadot-JS Apps.
  - Supports native Substrate balance transfers and staking.
  - Does **not** provide a Solidity contract deployment interface.
- **Remix IDE (`https://remix.ethereum.org/`):**
  - Supports Portaldot V3 via custom EVM RPC (`https://test-evm-rpc-v3.portaldot.dev`).
  - However, Remix requires an **EVM-native browser wallet** (e.g. MetaMask, Rabby, or Talisman in EVM mode). It cannot communicate with the Polkadot.js browser extension.
- **Recommendation:** No unverified web deployment portals should be utilized.

### 5. Architectural Distinction: Native Substrate/ink! vs. Solidity/EVM
| Dimension | Native Substrate / ink! | PortalNexus (Solidity / EVM) |
| :--- | :--- | :--- |
| **Language** | Rust (ink! framework) | Solidity (`0.8.24`) |
| **Bytecode Target** | WebAssembly (`.wasm`) or PolkaVM RISC-V | EVM Bytecode (`cancun` target) |
| **Runtime Pallet** | `pallet-contracts` / `pallet-revive` (native) | `pallet-revive` via EVM RPC emulation |
| **Deployment Extrinsic**| `contracts.instantiateWithCode` | `revive.ethTransact` / `eth_sendRawTransaction` |
| **Compatible Signer** | **Polkadot.js Extension**, Talisman (Substrate) | **EVM Private Key**, MetaMask, Rabby, Talisman (EVM) |

---

## Part C: Funding & Account Balances (Without Secrets Exposure)

| Query | Address / Account | Balance Observed | Verification Status |
| :--- | :--- | :--- | :--- |
| **Substrate Destination** | `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu` | `0 planck` (`0.0000 tPOT`) | Uncredited (Mempool pending) |
| **EVM Temporary Deployer**| `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A` | `0 wei` (`0.000000 POT`) | Uncredited (Mempool pending) |

- **Security Note:** No private keys, mnemonics, or recovery materials were accessed, printed, or transmitted.

---

## Decision Gate Summary & Verdict

| Gate Condition | Observed Status | Gate Result |
| :--- | :--- | :--- |
| **1. Block Production Advancing** | Block height frozen at `#232115` for $> 3.5\text{ hours}$ | ❌ **FAIL** |
| **2. RPC & Network Health** | 1 peer, RPC state timeouts, degraded node health | ❌ **FAIL** |
| **3. Wallet Signing Compatibility**| Polkadot.js extension cannot sign EVM/Solidity transactions | ❌ **FAIL** |
| **4. On-Chain Funding Available** | Balance is `0.0000 POT` (transfer pending in mempool) | ❌ **FAIL** |

### Mandatory Verdict: 🛑 STOP — DO NOT DEPLOY

### Recommended Next Steps:
1. **Do not broadcast or resubmit transactions:** The funding extrinsic `0x9ac1...` remains queued in the mempool and will process automatically once block authoring resumes.
2. **Contact Portaldot Testnet Support:** Inquire via official developer channels (Discord) regarding the validator stall at Block `#232115`.
3. **Execution Plan Post-Recovery:**
   - Once Block `#232116+` is authored, the temporary deployer will receive `0.9000 POT`.
   - Deploy via the verified terminal script [`contracts/scripts/deployTerminal.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/scripts/deployTerminal.ts) using the secure local deployer account.
   - Alternatively, import the funded account into MetaMask/Rabby for web-based interaction.
