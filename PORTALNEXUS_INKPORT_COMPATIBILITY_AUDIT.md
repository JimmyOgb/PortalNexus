# PortalNexus — InkPort Alternative Deployment Audit (READ-ONLY)

**Audit Date:** 2026-10-28  
**Local Timestamp:** 2026-10-28T16:58:00+01:00 (UTC 15:58:00Z)  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Protected Workspace:** `C:\Users\NO GO NO\Portaldot Sentinel` (Strictly untouched)  
**Overall Verdict:** 🛑 **NOT COMPATIBLE**  

---

## Executive Summary

This read-only audit investigated whether **InkPort** (`freedanjeremiah/portaldot-hackathon-2026-inkport-dmk`) can be utilized as an alternative deployment pipeline to deploy an equivalent of the **PortalNexus** DEX to the official **Portaldot V3 Testnet** using a Polkadot.js-compatible workflow.

### Key Conclusions:
1. **Runtime Mismatch:** InkPort was specifically designed for an obsolete Substrate 2021 **rent-era `pallet-contracts` (seal0 ABI)**. In contrast, the official Portaldot V3 Testnet runs **`pallet_revive` (PolkaVM RISC-V + EVM RPC)**. InkPort's emitted WebAssembly bytecode and seal0 host function imports cannot run on Portaldot V3.
2. **Target Node Mismatch & Outage:** InkPort targets an independent community endpoint (`wss://portaldot.philotheephilix.in`), which is currently **offline (HTTP 503 Service Unavailable)**. It does not target `wss://test-node-v3.portaldot.dev`.
3. **Compiler Architectural Blocker:** InkPort does not support `new Contract(...)` dynamic contract instantiation (`Expression::New` is completely omitted from AST lowering). `NexusAMM.sol`'s internal factory instantiation of `NexusLPReceipt` will trigger an immediate fail-loud compiler exit.
4. **No Polkadot.js Wallet Flow:** Neither the InkPort CLI nor its web playground (`inkport.vercel.app`) provides a Polkadot.js extension wallet-connect flow. The CLI hardcodes Substrate development accounts (`//Alice`), which must never be used with real testnet funds.
5. **Arithmetic & Overflow Risks:** InkPort truncates Solidity `uint256` to Rust `u128`. Intermediate constant-product AMM multiplications (`amount0 * reserve1`) will exceed $2^{128}$ and revert.

---

## Stage 1 — Official/Public InkPort Materials Review

### 1. Project Identification & License
- **Repository:** `https://github.com/freedanjeremiah/portaldot-hackathon-2026-inkport-dmk`
- **Web Applications:** `https://inkport.vercel.app/` and `https://inkport.vercel.app/why-inkport`
- **License:** MIT License.
- **Author/Context:** Portaldot Hackathon 2026 participant project by Freedan Jeremiah.

### 2. Architecture & Pipeline
- **Solidity Parser:** Uses `solang-parser` to parse Solidity into an abstract syntax tree (AST).
- **Lowering & Codegen:** Lowers AST into raw `#![no_std]` Rust targeting Substrate's ancient `seal0` host calls (`seal_input`, `seal_return`, `seal_get_storage`, `seal_set_storage`, `seal_deposit_event`).
- **Compilation:** Uses `cargo +stable build --target wasm32-unknown-unknown` and strips post-MVP WebAssembly opcodes (`memory.fill` / `memory.copy`).
- **Integrity Guarantee:** Enforces a strict "fail-loud" policy: any unsupported Solidity construct terminates `inkport translate` with a non-zero exit code.

### 3. Signer & Wallet-Connect Workflow
- **Web Playground (`inkport.vercel.app/playground`):**
  - Static code inspection and in-browser translation only.
  - Source bundle inspection confirmed:
    `wallet count: 0`, `polkadot count: 0`, `extension count: 0`, `injected count: 0`.
  - The web playground exposes **no wallet-connect flow** and cannot interface with a user's Polkadot.js extension.
- **CLI Configuration (`inkport.config.py`):**
  - Hardcodes `DEFAULT_SIGNER = "//Alice"`.
  - Relies exclusively on standard Substrate development accounts (`//Alice`, `//Bob`, `//Charlie`).
  - There is no documented hardware wallet or secure external signer integration.

---

## Stage 2 — PortalNexus Contract Source Audit Against InkPort

### 1. `WPotToken.sol`
- **Solidity Constructs:** ERC-20 wrapper, `receive() external payable`, `deposit()`, `withdraw(uint256)`.
- **EVM-Native Transfer:**
  Line 53: `(bool success, ) = msg.sender.call{value: wad}("");`
  - In EVM: Transfers native POT/wei.
  - In InkPort / seal0: Low-level `.call{value: ...}` is not supported. In `seal0`, transferring native balance requires the `seal_transfer` host function.
- **OpenZeppelin Dependencies:** Imports `ERC20.sol` and `ReentrancyGuard.sol`. InkPort cannot resolve external npm dependencies or complex OpenZeppelin inheritance trees.

### 2. `TestUSDC.sol`
- **Solidity Constructs:** Custom `decimals() public pure override returns (uint8)` returning 6, `faucetMint()`, `constant MAX_MINT_PER_CALL`.
- **Decimals Semantics:** InkPort assumes standard 14-decimal Substrate token units (`POT`). It does not model custom ERC-20 decimal scaling in its runtime harness.

### 3. `NexusLPReceipt.sol`
- **Solidity Constructs:** ERC-721 position receipt NFT, `struct Position`, `onlyAMM` modifier, mint and burn capabilities.
- **Storage Layout:** Stores position metadata in `mapping(uint256 => Position)`.
  - InkPort supports `mapping(K => Struct)` only if the struct consists purely of scalar fields and is declared in the same file.
  - However, OpenZeppelin's `ERC721` base contract imports extensive multi-file dependencies (`IERC721Metadata`, `IERC721Errors`, `Context`) which InkPort cannot parse.

### 4. `NexusAMM.sol` — Critical Architectural Blockers
- **The Factory Creation Blocker (`new NexusLPReceipt`):**
  - Line 87: `receiptContract = new NexusLPReceipt(address(this));`
  - In `translator/src/codegen_seal.rs`, expression match arms explicitly support arithmetic, variables, logic, and member access. **`Expression::New` is completely missing.**
  - InkPort's fail-loud translator will immediately reject `new NexusLPReceipt(...)`.
- **Mathematical Overflow ($u128$ vs $u256$):**
  - InkPort maps Solidity `uint256` directly to Rust `u128` (16 bytes, max $\approx 3.4 \times 10^{38}$).
  - In `NexusAMM`:
    $$\text{numerator} = (\text{amountIn} \times 997) \times \text{reserveOut}$$
    When operating on 18-decimal tokens with typical liquidity (e.g. $100\text{ WPOT} = 10^{20}\text{ wei}$ and $100,000\text{ pUSDC} = 10^{11}$ units):
    $10^{20} \times 997 \times 10^{11} \approx 10^{34}$ (fits in $u128$).
    However, if both tokens use 18 decimals, $10^{20} \times 10^{20} = 10^{40}$, which exceeds $2^{128}$ ($\approx 3.4 \times 10^{38}$). Under InkPort's checked math, this triggers an immediate on-chain transaction revert.
- **Cross-Contract ABI Call Constraints:**
  - InkPort requires callee interfaces (`IERC20`, `INexusLPReceipt`) to be declared bodyless in the same single file.
  - Multi-file compilation or circular linking is unsupported.

---

## Stage 3 — Non-Mutating Compatibility Matrix

| Contract | Target Complexity | Compatibility Verdict | Root Cause / Blockers |
| :--- | :--- | :--- | :--- |
| **`WPotToken.sol`** | Low | ❌ **NOT COMPATIBLE** | OpenZeppelin dependencies; EVM `msg.sender.call{value: ...}` native transfer syntax; custom errors. |
| **`TestUSDC.sol`** | Low | ⚠️ **REDESIGN REQUIRED** | OpenZeppelin dependencies; non-standard 6-decimal scaling; custom errors. |
| **`NexusLPReceipt.sol`** | Medium | ⚠️ **REDESIGN REQUIRED** | OpenZeppelin ERC721 dependencies; custom receipt access control; requires two-step manual linking if factory creation is disabled. |
| **`NexusAMM.sol`** | High | ❌ **NOT COMPATIBLE** | **CRITICAL:** `new NexusLPReceipt` unsupported (`Expression::New` missing); $u128$ intermediate math overflow risk; multi-contract orchestration unsupported. |

---

## Stage 4 — Deployment Target Verification

### Target A: Official Portaldot V3 Testnet (Our Mandatory Target)
- **Substrate Endpoint:** `wss://test-node-v3.portaldot.dev`
- **EVM JSON-RPC:** `https://test-evm-rpc-v3.portaldot.dev`
- **Chain ID:** `420420777` (`0x190f1ca9`)
- **Runtime Spec:** `portaldot-v3` (v3002)
- **Contract Engine:** **`pallet_revive`** (PolkaVM RISC-V + EVM RPC adapter).
- **InkPort Compatibility:** ❌ **INCOMPATIBLE**. Portaldot V3 does not execute legacy `seal0` wasm imports.

### Target B: InkPort Hackathon Endpoint (`wss://portaldot.philotheephilix.in`)
- **Node Status:** ❌ **OFFLINE (HTTP 503 Service Unavailable)**.
- **Network Identity:** A private hackathon development node running deprecated Substrate 2021 `pallet-contracts` (rent-era, `Compact<Weight>` gas).
- **Verdict:** An unverified, discontinued test server that is completely separate from the official Portaldot V3 Testnet.

---

## Stage 5 — Specific Answers to Audit Tasks

1. **Official/Public References Reviewed:**
   - GitHub: `freedanjeremiah/portaldot-hackathon-2026-inkport-dmk` (AST lowerer, seal0 codegen, python chain harness).
   - Web: `https://inkport.vercel.app/` and `https://inkport.vercel.app/why-inkport`.
2. **Chain & Runtime Compatibility Verdict:**
   - **Zero Compatibility.** InkPort targets Substrate 2021 `seal0` `pallet-contracts`. Portaldot V3 runs `pallet_revive`.
3. **Per-Contract Compatibility:**
   - 2 contracts Incompatible (`WPotToken`, `NexusAMM`).
   - 2 contracts Require Full Ground-Up Redesign (`TestUSDC`, `NexusLPReceipt`).
4. **Specific Factory Creation Blocker:**
   - InkPort's parser and codegen lack any implementation for `Expression::New`. `NexusAMM` cannot instantiate `NexusLPReceipt` on-chain.
5. **Polkadot.js Wallet Signing Support:**
   - **Unsupported.** InkPort CLI uses hardcoded development seeds (`//Alice`). InkPort web playground has no injected Web3 wallet integration.
6. **Zero-Cost, No-Deployment Next Step:**
   - Maintain PortalNexus's verified Solidity implementation.
   - Do not attempt porting to InkPort.
   - Monitor Portaldot V3 Testnet validator recovery at Block `#232115`.
7. **Final Recommendation:**
   - **NOT COMPATIBLE.** Do not proceed with an InkPort deployment attempt.
