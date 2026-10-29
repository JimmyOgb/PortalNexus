# PortalNexus — Portaldot V3 Testnet Deployment Cost & Gas Scaling Investigation

**Investigation Date:** 2026-10-29  
**Workspace:** `C:\Users\NO GO NO\PortalNexus`  
**Protected Workspace:** `C:\Users\NO GO NO\Portaldot Sentinel` (Strictly untouched)  
**Investigation Mode:** Strictly Read-Only (Zero Transactions Broadcast)  
**Target Network:** Portaldot V3 Testnet  
**RPC Endpoint:** `https://test-evm-rpc-v3.portaldot.dev`  
**Chain ID:** `420420777` (`0x190f1ca9`)  
**Deployer Address:** `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`  
**Deployer Available Balance:** `0.900000 POT` (`900,000,000,000,000,000` wei)  

---

## Executive Summary & GO / NO-GO Recommendation

### Verdict: 🛑 NO-GO (Insufficient Faucet Balance for Runtime Storage Deposits)

1. **Why It Costs Hundreds of POT:**  
   Portaldot V3 is powered by Substrate's next-generation smart-contract engine **`pallet_revive`** (specVersion `3002`). Unlike Ethereum where bytecode deployment is billed purely as consumable gas, Substrate runtimes enforce a **refundable storage deposit** (`DepositPerByte` and `DepositPerItem`) to prevent state bloat. Because standard Ethereum tooling (`ethers.js`, Hardhat, MetaMask) only communicates via a single scalar `gasLimit` parameter, the `pallet-revive-eth-rpc` translation layer bundles the required storage deposit into `eth_estimateGas`:
   $$\text{eth\_gas} \approx \text{ExecutionWeightToGas} + \frac{\text{StorageDeposit}}{\text{gasPrice}}$$
   At the live network base fee of $\sim 27,695\text{ wei}$, the runtime charges approximately **`0.0589 POT per byte`** of contract bytecode stored on-chain, plus a base trie creation fee of **`~18.32 POT`**.

2. **Total Deployment Cost for PortalNexus:**
   - **`WPotToken.sol`** (3,276 bytes): **`216.91 POT`**
   - **`TestUSDC.sol`** (2,749 bytes): **`178.10 POT`**
   - **`NexusAMM.sol`** (9,555 bytes + internal LPReceipt instantiation): **`695.85 POT`**
   - **Total Required for All 3 Contracts:** **`~1,090.86 POT`**

3. **Deployer Funding Reality:**  
   The temporary deployer wallet holds **`0.900000 POT`**. This is less than $0.1\%$ of the required balance. At the current testnet configuration, deployment cannot proceed without obtaining at least **`1,200 tPOT`** from the community faucet or testnet administrators.

---

## 1. Raw Observations & Benchmark Reproductions

All benchmarks were collected on live Block **#236250** (`0x39ada` / hash `0x94647109cf71e90caff1c9d019656fae563307ccc6cb751bd967bdd508e77d3a`).

### A. Network & Fee Parameters
- **RPC `eth_blockNumber`:** `236250`
- **Block Gas Limit:** `0xffffffffffffffff` ($2^{64}-1 = 18,446,744,073,709,551,615$)
- **Base Fee / Live Gas Price (`eth_gasPrice`):** `27,695 wei` (`0x6c2f`)
- **Max Priority Fee (`eth_maxPriorityFeePerGas`):** `0x0`
- **Deployer Nonce (`eth_getTransactionCount`):** `0`
- **Deployer Balance (`eth_getBalance`):** `900,000,000,000,000,000 wei` (`0.900000 POT`)

### B. Benchmark Table Across Bytecode Complexities

| Benchmark Target | Bytecode Size | Raw `eth_estimateGas` (Hex) | Raw `eth_estimateGas` (Dec) | Implied Fee in Wei (`Gas * Price`) | Implied Cost in POT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0-Byte ETH Transfer** | 0 bytes | `0x691982dff2` | $451,399,573,490$ | $12,501,511,187,805,550$ | **`0.0125 POT`** |
| **Minimal Empty Contract** | 38 bytes | `0x2599f141a1148` | $661,489,725,346,120$ | $18,319,957,943,460,793,400$ | **`18.32 POT`** |
| **`TestUSDC.sol`** | 2,749 bytes | `0x16d8d450f2b20f` | $6,430,855,890,383,375$ | $178,102,553,884,167,570,625$ | **`178.10 POT`** |
| **`WPotToken.sol`** | 3,276 bytes | `0x1bd3612facb1ba` | $7,832,238,736,323,002$ | $216,913,851,802,465,540,390$ | **`216.91 POT`** |
| **`NexusAMM.sol`** | 9,555 bytes | `0x59436623d6fec1` | $25,125,378,894,266,049$ | $695,847,368,476,698,227,055$ | **`695.85 POT`** |

---

## 2. Mathematical Decomposition of the Cost

### A. Linear Storage Deposit Scaling
Comparing the empty contract (38 bytes) to `TestUSDC.sol` (2,749 bytes):
$$\Delta \text{Gas} = 6,430,855,890,383,375 - 661,489,725,346,120 = 5,769,366,165,037,255\text{ units}$$
$$\Delta \text{Bytes} = 2,749 - 38 = 2,711\text{ bytes}$$
$$\text{Gas Slope} = \frac{5,769,366,165,037,255}{2,711} \approx \mathbf{2.128 \times 10^{12}\text{ gas units per byte}}$$

Multiplying this gas slope by the live base fee ($27,695\text{ wei}$):
$$\text{Cost per Byte} = 2,128,132,115,469 \times 27,695\text{ wei} = 58,938,618,937,913,955\text{ wei} \approx \mathbf{0.0589\text{ POT per byte}}$$

### B. Cost Model Equation
The total cost to deploy an EVM contract on Portaldot V3 can be modeled as:
$$\text{Deployment Cost (POT)} \approx \text{Base Overhead} + (\text{Bytecode Size in Bytes} \times 0.0589\text{ POT}) + \text{Constructor Execution}$$
- **Base Overhead (Account/Trie Creation):** $\approx 18.32\text{ POT}$
- **Bytecode Storage Rate:** $\approx 0.0589\text{ POT / byte}$
- **Execution Cost:** Pure EVM transfer / execution is relatively inexpensive ($\sim 0.0125\text{ POT}$).

### C. Decimal Conversion Dynamics (Substrate 14 Decimals vs. EVM 18 Decimals)
The Substrate runtime properties confirm:
- Substrate native token: `tPOT` with **14 decimals** (`planck`).
- EVM RPC layer: `POT` with **18 decimals** (`wei`).
- Scale conversion: $1\text{ POT} = 10^{14}\text{ planck} = 10^{18}\text{ wei} \implies 1\text{ planck} = 10^4\text{ wei}$.

When `eth_call` was executed with a gas limit of $7,826,586,751,258,972$, the Substrate node returned:
```json
{
  "code": -32000,
  "message": "insufficient funds for gas * price + value (21687471887738611): address 0xdc7f5c7813a5f0e3f51c2fe569de6c5577768a2a have 900000000000000000 (supplied gas Some(7826586751258972))"
}
```
- Required: `21,687,471,887,738,611` planck ($\approx 216.87\text{ POT}$).
- Available: `90,000,000,000,000` planck ($\approx 0.90\text{ POT}$).

---

## 3. Analysis of Double-Counting, Script Logic & Hardhat Configuration

### A. Is Storage Deposit Being Counted Twice?
**NO.** Neither our deployment script nor Hardhat double-counts the storage deposit:
- The deployment script ([`contracts/scripts/deployTerminal.ts`](file:///C:/Users/NO%20GO%20NO/PortalNexus/contracts/scripts/deployTerminal.ts)) simply calls `factory.deploy()`.
- It does **not** attach an extra `value` or manual fee surcharge to the transaction.
- Ethers.js delegates gas estimation directly to the node via `eth_estimateGas`.
- The node's `pallet-revive-eth-rpc` layer calculates the storage deposit internally and bundles it into the returned gas value so that standard Ethereum tooling can ensure the account has enough collateral to lock into the state trie.

### B. Previous Script Misconceptions
Lines 55–58 in `deployTerminal.ts` previously stated:
```typescript
const estTotalGas = 4100000n;
const estGasFee = estTotalGas * gasPrice;
// Estimated Total Gas: ~4,100,000 units (~0.00000011 POT fee)
// Storage Deposit:     ~0.05 - 0.20 POT
```
This estimate was based on standard Ethereum EVM assumptions (where gas limits range in the millions) rather than `pallet_revive`'s Substrate weight/deposit mapping. The assumption that storage deposits were 0.05–0.20 POT total was off by three orders of magnitude.

### C. Can We Artificially Force a Lower `gasLimit`?
When we simulated deploying with a lower, affordable gas limit ($\le 3 \times 10^{13}$ gas, which $0.90\text{ POT}$ could cover), the transaction failed inside the runtime:
```text
failed to run contract: Module(ModuleError { index: 80, error: [11, 0, 0, 0], message: Some("ContractTrapped") })
```
`ContractTrapped` occurs because `pallet_revive` halts EVM bytecode execution as soon as the compute weight (`ref_time`) or state trie allocation exceeds the specified gas budget. Deploying with an artificially low gas limit is not viable.

---

## 4. RPC Capability: Can Execution Cost Be Separated from Storage Deposit?

### A. EVM JSON-RPC Endpoint (`https://test-evm-rpc-v3.portaldot.dev`)
Inspection of the node's `rpc_methods` revealed **38 supported methods**, all of which are standard Ethereum RPC methods (`eth_call`, `eth_estimateGas`, `eth_sendRawTransaction`, etc.) and `system_health`.
- The EVM RPC endpoint does **not** support `revive_dryRun`, `state_call`, or custom breakdown methods.
- Through standard EVM RPC endpoints, storage deposits and execution costs cannot be separated because the Ethereum protocol interface does not have a separate storage deposit field.

### B. Substrate WebSocket Endpoint (`wss://test-node-v3.portaldot.dev`)
The underlying Substrate node supports **135 native RPC methods**:
- Substrate runtime APIs (such as `ReviveApi` and `state_call`) evaluate `ref_time`, `proof_size`, and `storage_deposit` as independent fields.
- However, standard Solidity tools (Hardhat, Remix, ethers.js) interact strictly via the EVM RPC adapter, which requires the combined gas limit representation.

---

## 5. Remaining Uncertainties

1. **Testnet Governance / Faucet Intent:**  
   Is Portaldot V3 Testnet intended to have a high `DepositPerByte` (mimicking Asset Hub mainnet economic security), or was this parameter unintentionally inherited from production configs while the Discord faucet only dispenses $0.90 - 1.0\text{ POT}$?
2. **Refundability of Storage Deposits:**  
   Under `pallet_revive`, storage deposits are locked in the contract account and refundable if the contract is terminated (`selfdestruct` / suicide). However, for permanent AMM and token contracts, these funds remain locked indefinitely.

---

## 6. Actionable Next Steps

To proceed with PortalNexus deployment on Portaldot V3 Testnet:

1. **Option A: Obtain Sufficient Testnet Faucet Tokens (Recommended)**  
   Request an allocation of **`1,200 tPOT`** from the Portaldot Discord community faucet or testnet administrators to the temporary deployer address:
   - **EVM Address:** `0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A`
   - **Mapped Substrate Address:** `5H3pE4SQzSxPN5zuN1cqo7TbY7QuA9wHo3areDQDVLy2AUbu`
   - With $1,200\text{ tPOT}$, all 3 contracts can be deployed sequentially through the verified script.

2. **Option B: Testnet Parameter Adjustment by Portaldot Network Team**  
   If the faucet cannot dispense $>1\text{ POT}$, the Portaldot network team would need to adjust the `revive` pallet's `DepositPerByte` constant in the testnet runtime spec to align with faucet distribution limits.
