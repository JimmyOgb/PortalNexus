import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { setGlobalDispatcher, Agent } from "undici";

if (setGlobalDispatcher && Agent) {
  setGlobalDispatcher(new Agent({ connect: { timeout: 60000 } }));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
const EXPECTED_CHAIN_ID = 420420777;

// Resilient helper to get provider and signer
async function getResilientProviderAndSigner() {
  const req = new ethers.FetchRequest(RPC_URL);
  req.timeout = 60000;
  const directProvider = new ethers.JsonRpcProvider(req, undefined, {
    staticNetwork: ethers.Network.from(EXPECTED_CHAIN_ID)
  });

  // Try to read private key from env or .env file securely
  let privKey = process.env.PORTALDOT_PRIVATE_KEY || process.env.DEPLOYER_KEY;
  if (!privKey) {
    const envPath = path.resolve(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("PORTALDOT_PRIVATE_KEY=") || trimmed.startsWith("PRIVATE_KEY=")) {
          privKey = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
    }
  }

  if (privKey) {
    const cleanKey = privKey.startsWith("0x") ? privKey : `0x${privKey}`;
    const wallet = new ethers.Wallet(cleanKey, directProvider);
    return { provider: directProvider, signer: wallet };
  }

  throw new Error("No deployer signer detected in environment or contracts/.env");
}

async function main() {
  console.log("================================================================================");
  console.log("PortalNexus — Architecture A Deployment: Native POT / pUSDC AMM");
  console.log("================================================================================");

  const { provider, signer } = await getResilientProviderAndSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Target Network: Portaldot V3 Testnet (Chain ID: ${chainId} / 0x${chainId.toString(16)})`);

  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID}, got ${chainId}. Aborting deployment.`);
  }

  console.log(`Deployer Address: ${signer.address}`);

  // Query Live Balance & Runtime Parameters
  let balanceWei = await provider.getBalance(signer.address);
  let balancePot = ethers.formatEther(balanceWei);
  const block = await provider.getBlock("latest");
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 27650n;

  console.log(`Live Balance:     ${balancePot} POT (${balanceWei.toString()} wei)`);
  console.log(`Current Block:    #${block?.number} (${block?.hash})`);
  console.log(`Live Gas Price:   ${gasPrice.toString()} wei (${(Number(gasPrice) / 1e9).toFixed(6)} Gwei)`);

  // Load compiled artifacts
  const usdcArtifact = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../artifacts/contracts/TestUSDCMin.sol/TestUSDCMin.json"),
    "utf8"
  ));
  const ammArtifact = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../artifacts/contracts/NexusAMMNative.sol/NexusAMMNative.json"),
    "utf8"
  ));

  // Estimate Gas & Storage Deposit Requirements for both contracts
  console.log("\nSimulating deployment transactions via eth_estimateGas...");
  const estGasUsdc = await provider.estimateGas({
    from: signer.address,
    data: usdcArtifact.bytecode
  });
  const estCostUsdcWei = estGasUsdc * gasPrice;

  const ammIface = new ethers.Interface(ammArtifact.abi);
  const dummyUSDC = "0x0000000000000000000000000000000000000001";
  const ammDeployData = ethers.concat([
    ammArtifact.bytecode,
    ammIface.encodeDeploy([dummyUSDC])
  ]);
  const estGasAmm = await provider.estimateGas({
    from: signer.address,
    data: ammDeployData
  });
  const estCostAmmWei = estGasAmm * gasPrice;

  const totalRequiredWei = estCostUsdcWei + estCostAmmWei;
  const totalRequiredPot = ethers.formatEther(totalRequiredWei);

  console.log(`TestUSDCMin:    ~${estGasUsdc.toString()} gas (~${ethers.formatEther(estCostUsdcWei)} POT)`);
  console.log(`NexusAMMNative: ~${estGasAmm.toString()} gas (~${ethers.formatEther(estCostAmmWei)} POT)`);
  console.log(`Total Required: ~${totalRequiredPot} POT`);

  // Initial Balance Gate (Must cover both contracts)
  if (balanceWei < totalRequiredWei) {
    console.error(`\n❌ [BLOCKER] Insufficient funds for complete deployment!`);
    console.error(`Required:  ${totalRequiredPot} POT`);
    console.error(`Available: ${balancePot} POT`);
    console.error(`Deficit:   ${ethers.formatEther(totalRequiredWei - balanceWei)} POT`);
    return;
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("Commencing Sequential Contract Deployment for Architecture A...");
  console.log("--------------------------------------------------------------------------------");

  // ============================================================================
  // STEP 1: Deploy TestUSDCMin
  // ============================================================================
  console.log("\n[1/2] Deploying TestUSDCMin.sol (Portal Test USD, 6 decimals)...");
  const TestUSDCFactory = new ethers.ContractFactory(usdcArtifact.abi, usdcArtifact.bytecode, signer);
  const usdc = await TestUSDCFactory.deploy();
  const usdcTx = usdc.deploymentTransaction()!;
  console.log(`      Broadcast Tx: ${usdcTx.hash}`);
  console.log("      Awaiting block confirmation...");
  const usdcReceipt = await usdcTx.wait();
  const usdcAddress = await usdc.getAddress();

  console.log(`      ✅ Deployed Address: ${usdcAddress}`);
  console.log(`      Mined in Block:    #${usdcReceipt?.blockNumber}`);
  console.log(`      Gas Used:          ${usdcReceipt?.gasUsed?.toString()}`);

  // Verify TestUSDCMin on-chain
  console.log("      Verifying TestUSDCMin on-chain via read-only calls...");
  const usdcCode = await provider.getCode(usdcAddress);
  if (!usdcCode || usdcCode === "0x") throw new Error("TestUSDCMin code is empty on-chain!");
  const usdcContract = new ethers.Contract(usdcAddress, usdcArtifact.abi, provider);
  const usdcName = await usdcContract.name();
  const usdcDecimals = await usdcContract.decimals();
  const usdcSymbol = await usdcContract.symbol();
  console.log(`      Bytecode size:     ${(usdcCode.length - 2) / 2} bytes`);
  console.log(`      name():            "${usdcName}"`);
  console.log(`      symbol():          "${usdcSymbol}"`);
  console.log(`      decimals():        ${usdcDecimals.toString()}`);
  if (usdcName !== "Portal Test USD" || Number(usdcDecimals) !== 6 || usdcSymbol !== "pUSDC") {
    throw new Error("TestUSDCMin metadata verification failed!");
  }

  // ============================================================================
  // PRE-STEP 2: Intermediate Balance & Cost Recalculation Gate
  // ============================================================================
  console.log("\n--- Checking wallet balance & re-simulating NexusAMMNative prior to step 2 ---");
  balanceWei = await provider.getBalance(signer.address);
  balancePot = ethers.formatEther(balanceWei);
  const feeDataStep2 = await provider.getFeeData();
  const gasPriceStep2 = feeDataStep2.gasPrice ?? gasPrice;

  const actualAmmDeployData = ethers.concat([
    ammArtifact.bytecode,
    ammIface.encodeDeploy([usdcAddress])
  ]);
  const estGasAmmActual = await provider.estimateGas({
    from: signer.address,
    data: actualAmmDeployData
  });
  const estCostAmmActualWei = estGasAmmActual * gasPriceStep2;
  const estCostAmmActualPot = ethers.formatEther(estCostAmmActualWei);

  console.log(`Live Balance Remaining:  ${balancePot} POT`);
  console.log(`NexusAMMNative Required: ~${estCostAmmActualPot} POT (${estGasAmmActual.toString()} gas at ${gasPriceStep2.toString()} wei)`);

  if (balanceWei < estCostAmmActualWei) {
    console.error(`\n❌ [STOP CONDITION] Remaining balance (${balancePot} POT) cannot fund NexusAMMNative (${estCostAmmActualPot} POT)!`);
    console.error(`Halted before broadcasting transaction 2.`);
    return;
  }
  console.log(`✅ Sufficient funds confirmed for NexusAMMNative (+${(parseFloat(balancePot) - parseFloat(estCostAmmActualPot)).toFixed(4)} POT margin).`);

  // ============================================================================
  // STEP 2: Deploy NexusAMMNative
  // ============================================================================
  console.log("\n[2/2] Deploying NexusAMMNative.sol (Native POT / pUSDC AMM)...");
  const NexusAMMFactory = new ethers.ContractFactory(ammArtifact.abi, ammArtifact.bytecode, signer);
  const amm = await NexusAMMFactory.deploy(usdcAddress);
  const ammTx = amm.deploymentTransaction()!;
  console.log(`      Broadcast Tx: ${ammTx.hash}`);
  console.log("      Awaiting block confirmation...");
  const ammReceipt = await ammTx.wait();
  const ammAddress = await amm.getAddress();

  console.log(`      ✅ Deployed Address: ${ammAddress}`);
  console.log(`      Mined in Block:    #${ammReceipt?.blockNumber}`);
  console.log(`      Gas Used:          ${ammReceipt?.gasUsed?.toString()}`);

  // Verify NexusAMMNative on-chain
  console.log("      Verifying NexusAMMNative on-chain via read-only calls...");
  const ammCode = await provider.getCode(ammAddress);
  if (!ammCode || ammCode === "0x") throw new Error("NexusAMMNative code is empty on-chain!");
  const ammContract = new ethers.Contract(ammAddress, ammArtifact.abi, provider);
  const boundUSDC = await ammContract.usdc();
  const receiptContract = await ammContract.receiptContract();
  const [rPOT, rUSDC] = await ammContract.getReserves();
  console.log(`      Bytecode size:     ${(ammCode.length - 2) / 2} bytes`);
  console.log(`      usdc():            ${boundUSDC}`);
  console.log(`      receiptContract(): ${receiptContract}`);
  console.log(`      initial reserves:  POT=${rPOT}, USDC=${rUSDC}`);

  if (boundUSDC.toLowerCase() !== usdcAddress.toLowerCase()) {
    throw new Error("NexusAMMNative bound USDC address mismatch!");
  }
  if (receiptContract.toLowerCase() !== ammAddress.toLowerCase()) {
    throw new Error("NexusAMMNative receipt contract mismatch!");
  }

  // Final Balance Check
  const finalBalWei = await provider.getBalance(signer.address);
  const finalBalPot = ethers.formatEther(finalBalWei);
  console.log(`\nFinal Deployer Balance: ${finalBalPot} POT`);

  // ============================================================================
  // STEP 3: Record Deployment Receipt File
  // ============================================================================
  const receiptPath = path.resolve(__dirname, "../deployment-receipt-arch-a.json");
  const receiptData = {
    network: "Portaldot V3 Testnet",
    chainId: EXPECTED_CHAIN_ID,
    architecture: "Architecture A — Direct Native POT / pUSDC AMM",
    timestamp: new Date().toISOString(),
    deployer: signer.address,
    initialBalance: balancePot,
    finalBalance: finalBalPot,
    contracts: {
      testUSDC: {
        name: "Portal Test USD",
        symbol: "pUSDC",
        decimals: 6,
        address: usdcAddress,
        txHash: usdcTx.hash,
        blockNumber: usdcReceipt?.blockNumber,
        gasUsed: usdcReceipt?.gasUsed?.toString(),
        bytecodeSize: (usdcCode.length - 2) / 2
      },
      nexusAMM: {
        name: "NexusAMMNative",
        pair: "POT / pUSDC",
        address: ammAddress,
        txHash: ammTx.hash,
        blockNumber: ammReceipt?.blockNumber,
        gasUsed: ammReceipt?.gasUsed?.toString(),
        bytecodeSize: (ammCode.length - 2) / 2,
        usdc: boundUSDC,
        receiptContract: receiptContract
      }
    }
  };

  fs.writeFileSync(receiptPath, JSON.stringify(receiptData, null, 2), "utf8");
  console.log(`\nDeployment receipt written to: ${receiptPath}`);

  // ============================================================================
  // STEP 4: Update Frontend Configuration (Post-Verification Only)
  // ============================================================================
  const configPath = path.resolve(__dirname, "../../src/contracts/config.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf8");
    
    // Update testUSDC
    configContent = configContent.replace(
      /testUSDC:\s*\{[\s\S]*?deployedAddress:\s*null[\s\S]*?isDeployed:\s*false[\s\S]*?statusText:\s*'Local-Only[^']*'/m,
      `testUSDC: {\n    name: 'Portal Test USD',\n    symbol: 'pUSDC',\n    decimals: 6,\n    deployedAddress: '${usdcAddress}',\n    isDeployed: true,\n    statusText: 'Verified on Portaldot V3 Testnet'`
    );

    // Update nexusAMM
    configContent = configContent.replace(
      /nexusAMM:\s*\{[\s\S]*?deployedAddress:\s*null[\s\S]*?isDeployed:\s*false[\s\S]*?statusText:\s*'Local-Only[^']*'/m,
      `nexusAMM: {\n    name: 'Nexus AMM Constant Product Pool (Native POT / pUSDC)',\n    deployedAddress: '${ammAddress}',\n    isDeployed: true,\n    statusText: 'Verified on Portaldot V3 Testnet'`
    );

    // Update nexusReceipt
    configContent = configContent.replace(
      /nexusReceipt:\s*\{[\s\S]*?deployedAddress:\s*null[\s\S]*?isDeployed:\s*false[\s\S]*?statusText:\s*'Local-Only[^']*'/m,
      `nexusReceipt: {\n    name: 'Nexus LP Position Receipt',\n    symbol: 'NX-LP',\n    deployedAddress: '${ammAddress}',\n    isDeployed: true,\n    statusText: 'Verified on Portaldot V3 Testnet (Unified AMM Authority)'`
    );

    fs.writeFileSync(configPath, configContent, "utf8");
    console.log(`Frontend contract registry updated in: ${configPath}`);
  }

  console.log("\n================================================================================");
  console.log("✅ Architecture A Deployment Successfully Completed & Verified On-Chain!");
  console.log("================================================================================");
}

main().catch((error) => {
  console.error("\n❌ Deployment halted due to error:", error);
  process.exitCode = 1;
});
