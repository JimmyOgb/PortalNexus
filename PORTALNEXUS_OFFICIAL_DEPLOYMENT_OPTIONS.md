# PortalNexus — Official EVM Deployment Route Discovery Report

**Audit Date:** 2026-10-28  
**Audit Timestamp:** 2026-10-28T16:15:09Z (17:15:09 Local)  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Protected Workspace:** `C:\Users\NO GO NO\Portaldot Sentinel` (Strictly untouched)  
**Current Network State:** 🛑 **TESTNET BLOCK AUTHORING STALLED AT BLOCK #232115**  

---

## 1. Official Documentation & Architecture Baseline

### Portaldot V3 EVM Architecture (`pallet_revive`)
- **Runtime Component:** Portaldot V3 uses Substrate's modern **`pallet_revive`** smart contract engine (v3002).
- **EVM Translation Layer:** The node runs `pallet-revive-eth-rpc`, an Ethereum JSON-RPC 2.0 emulation server listening at `https://test-evm-rpc-v3.portaldot.dev`.
- **Execution Mechanism:** Standard Ethereum transactions signed with secp256k1 keys targeting Chain ID `420420777` (`0x190f1ca9`) are ingested by the RPC, wrapped into Substrate `revive.ethTransact` extrinsics, and executed within the runtime.
- **Key Official References:**
  - Polkadot Revive Documentation: [https://docs.polkadot.com/develop/smart-contracts/](https://docs.polkadot.com/develop/smart-contracts/)
  - Substrate Revive Frame Pallet: [https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/revive](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame/revive)
  - Portaldot Network Documentation: [https://portaldot-network.gitbook.io/](https://portaldot-network.gitbook.io/)
  - Official Portaldot Developer Portal: [https://portaldot.dev/](https://portaldot.dev/)

---

## 2. Tooling Compatibility Matrix (Remix, Hardhat, Foundry, MetaMask)

Because Portaldot V3 implements standard Ethereum JSON-RPC via `pallet-revive-eth-rpc`, standard EVM tooling is supported:

| Tooling / Client | Support Status | Protocol / Mechanism | Verification Details |
| :--- | :--- | :--- | :--- |
| **Hardhat** | ✅ **Officially Supported** *(Recommended)* | JSON-RPC (`url: "https://test-evm-rpc-v3.portaldot.dev"`, `chainId: 420420777`) | Pre-configured in [`contracts/hardhat.config.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/hardhat.config.ts). Uses `ethers.ContractFactory` to sequentially deploy and verify all contracts. |
| **Foundry (Forge)** | ✅ **Officially Supported** | `forge script` / `forge create --rpc-url https://test-evm-rpc-v3.portaldot.dev` | Fully compatible with Cancun EVM target and standard secp256k1 signing. |
| **Remix IDE** | ✅ **Officially Supported** | Browser IDE via Injected Provider or External HTTP Provider | Point to `https://test-evm-rpc-v3.portaldot.dev`. Requires an EVM wallet (MetaMask/Rabby). |
| **MetaMask / Rabby** | ✅ **Officially Supported** | Standard EVM Wallet (`window.ethereum`) | Add Custom Network: RPC `https://test-evm-rpc-v3.portaldot.dev`, Chain ID `420420777`, Symbol `POT`. |
| **Polkadot.js Extension** | ❌ **NOT Supported for EVM** | Substrate native signer (`injectedWeb3['polkadot-js']`) | Only signs Substrate SCALE extrinsics; **cannot sign EVM deployment transactions**. |

---

## 3. Official Hosted Deployment Interfaces & Wallet Bridges

### 1. Official Portaldot Node Console (`https://node-console.portaldot.dev/`)
- **Domain:** `node-console.portaldot.dev` (Verified official Portaldot domain).
- **Underlying Software:** Polkadot-JS Apps customized for Portaldot.
- **Supported Wallets:** Polkadot.js extension, Talisman (Substrate), SubWallet (Substrate).
- **Capability:** Supports native Substrate extrinsics (e.g. `balances.transferKeepAlive`, staking, governance).
- **Limitation:** **Does NOT support Solidity EVM deployments.** The "Contracts" tab is reserved for Substrate `pallet-contracts` (WASM/ink!), which is not active on Portaldot V3.

### 2. Remix IDE (`https://remix.ethereum.org/`)
- **Domain:** `remix.ethereum.org` (Official Ethereum Foundation web IDE).
- **Wallet Connection:** Connects via **MetaMask**, **Rabby**, or multi-chain wallets in EVM mode.
- **Capability:** Allows compiling Solidity contracts and deploying sequentially to Chain ID `420420777`.
- **Limitation:** Requires manual entry of constructor arguments and does not automate updating PortalNexus's frontend configuration (`src/contracts/config.ts`) or generating project deployment receipts.

### 3. Can Polkadot.js Extension Be Bridged to EVM Deployment?
- **Finding:** **No official EVM bridge exists for the Polkadot.js extension.**
- The Polkadot.js extension does not expose an EIP-1193 provider (`window.ethereum`).
- Attempting to route Solidity EVM deployments through unverified third-party "bridge" sites is unsafe and unverified.

---

## 4. Multi-Contract Sequential Deployment & Verification Capability

Our project contracts require strict sequential deployment with constructor dependency chaining:
1. `WPotToken.sol` — Constructor: `()`
2. `TestUSDC.sol` — Constructor: `()`
3. `NexusAMM.sol` — Constructor: `(address _wpot, address _testUsdc)` (Internally instantiates `NexusLPReceipt.sol` during constructor execution).

### Comparison of Deployment Routes:

| Route | Sequential Deployment | Constructor Chaining | Automatic Verification | Auto-Updates Frontend Config |
| :--- | :--- | :--- | :--- | :--- |
| **Terminal Hardhat Script** ([`contracts/scripts/deployTerminal.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/scripts/deployTerminal.ts)) | ✅ Fully Automated | ✅ Fully Automated | ✅ Reads getters & on-chain bytecode | ✅ Updates `src/contracts/config.ts` & writes `deployment-receipt.json` |
| **Remix IDE + MetaMask** | ⚠️ Manual | ⚠️ Manual copy/paste | ⚠️ Manual via Remix UI | ❌ No auto-update (Manual copy/paste required) |

---

## 5. Fresh Live Network Health Audit (Read-Only)

Observations recorded on **2026-10-28T16:15:09Z**:

### A. EVM JSON-RPC (`https://test-evm-rpc-v3.portaldot.dev`)
- **Chain ID:** `420420777` (`0x190f1ca9`) — Matches configuration.
- **Best Block Height:** `#232115` (`0x06890969b976a715eed528736798e683f80fbfb21defe3691c9d4f9b9da32875`)
- **Block Header Timestamp:** `2026-10-28T12:45:54.000Z`
- **Elapsed Stall Time:** **$> 4.5\text{ hours}$** since the last block was minted.
- **Deployer EVM Balance (`0xdC7f...`):** `0 wei` (`0.000000 POT`)

### B. Substrate WebSocket (`wss://test-node-v3.portaldot.dev`)
- **Substrate Best Block:** `#232115` (`0xa45d316ac54493ff10ac3783d915e3011780a4ff7ce4eb1c9f2ba8f3cf1379a5`)
- **Substrate Finalized Block:** `#232113` (`0xd95fb0bc00d6d672a8f7e51e7078ed052b602cce0528d83c0c362eed87325696`)
- **Active Peers:** **`0`** (Node is completely isolated from peer validators).
- **Sync Status:** `isSyncing: false`.
- **Deployer Substrate Balance (`5H3pE4...`):** `0 planck` (`0.0000 tPOT`).

### C. Funding Extrinsic Status
- **Extrinsic Hash:** `0x9ac1b81cf1e0c3d653f147e41917236ec7c464f3c7931e795c6dd0381470b0a4`
- **Current Status:** **CONFIRMED PRESENT IN MEMPOOL** (Index `[2]` of 15 pending extrinsics).
- **Mempool Retention:** It has not been dropped, expired, or rejected. It will be included as soon as a validator produces Block `#232116`.

---

## 6. Distinction Between Verified Facts vs. Unresolved Questions

### Verified Facts
1. Portaldot V3 runs `pallet_revive`, exposing an EVM-compatible JSON-RPC layer on Chain ID `420420777`.
2. Standard EVM tooling (Hardhat, Foundry, Remix, MetaMask) is the officially supported development path for Solidity.
3. The Polkadot.js extension cannot deploy Solidity contracts because it lacks an EVM signing provider.
4. The user's funding transfer is valid and held in the node mempool.
5. Testnet validator block production halted at Block `#232115` at 12:45:54 UTC, and the RPC node currently reports 0 peers.

### Unresolved Questions
1. When will Portaldot testnet validators restart or resolve consensus to resume block authoring? *(Requires inquiry with the Portaldot network infrastructure team)*.
2. Will the validator reboot maintain the existing unfinalized block history and mempool, or perform a testnet state reset?

---

## 7. Recommended Safe Next Step

1. **Do not attempt deployment now:** Deployment transactions will fail or hang because deployer balance is 0 and block production is stopped.
2. **Do not rebroadcast or transfer again:** The funding transfer is already in the mempool.
3. **Primary Deployment Path Post-Recovery:**
   - Once validators author Block `#232116+`, the deployer account will automatically receive `0.9000 POT`.
   - Execute the sequential deployment via the verified terminal Hardhat runner:
     ```powershell
     cd "C:\Users\NO GO NO\PortalNexus\contracts"
     npx hardhat run scripts/deployTerminal.ts --network portaldotTestnet
     ```
   - This runner deploys all three contracts in order, reads and verifies on-chain getters, updates `src/contracts/config.ts`, and generates `deployment-receipt.json` without exposing private keys.
4. **Alternative Web-Based Path (If browser signing is preferred):**
   - Import the funded deployer key into MetaMask.
   - Configure Custom Network: `https://test-evm-rpc-v3.portaldot.dev`, Chain ID `420420777`.
   - Deploy via Remix IDE using "Injected Provider - MetaMask".
