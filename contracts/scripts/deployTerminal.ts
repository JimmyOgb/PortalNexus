import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("================================================================================");
  console.log("PortalNexus — Stage 4B: Portaldot V3 Terminal Contract Deployment & Verification");
  console.log("================================================================================");

  // 1. Verify Target Network & Chain ID
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Target Network: Portaldot V3 Testnet (Chain ID: ${chainId} / 0x${chainId.toString(16)})`);

  if (chainId !== 420420777) {
    throw new Error(`Chain ID mismatch! Expected 420420777, got ${chainId}. Aborting deployment.`);
  }

  // 2. Verify Signer
  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("\n❌ [BLOCKER] No deployer account detected in Hardhat configuration.");
    console.error("To securely supply the funded deployer account without exposing secrets:");
    console.error("Option 1 (Process-scoped environment variable in PowerShell):");
    console.error("  $env:PORTALDOT_PRIVATE_KEY=\"<your-private-key>\"");
    console.error("Option 2 (Ignored local .env file in contracts/.env):");
    console.error("  PORTALDOT_PRIVATE_KEY=<your-private-key>");
    console.error("  (Verified: contracts/.env is strictly ignored by .gitignore)");
    return;
  }

  const deployer = signers[0];
  console.log(`Deployer Address: ${deployer.address}`);

  // 3. Query Live Balance
  const balanceWei = await ethers.provider.getBalance(deployer.address);
  const balancePot = ethers.formatEther(balanceWei);
  console.log(`Live Balance:     ${balancePot} POT (${balanceWei.toString()} wei)`);

  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(`Current Block:    #${blockNumber}`);

  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 28015n;
  console.log(`Live Gas Price:   ${gasPrice.toString()} wei (${(Number(gasPrice) / 1e9).toFixed(6)} Gwei)`);

  // Balance Check
  if (balanceWei === 0n) {
    console.error(`\n❌ [BLOCKER] Deployer account ${deployer.address} has 0.0000 POT on Portaldot V3.`);
    console.error("Please fund this address from the Portaldot Discord community faucet before deploying.");
    return;
  }

  // Preflight Gas Estimation
  const estTotalGas = 4100000n;
  const estGasFee = estTotalGas * gasPrice;
  console.log(`Estimated Total Gas: ~${estTotalGas.toString()} units (~${ethers.formatEther(estGasFee)} POT fee)`);
  console.log(`Storage Deposit:     ~0.05 - 0.20 POT (pallet-revive bytecode storage trie reservation)`);

  if (balanceWei < estGasFee) {
    console.error(`\n❌ [BLOCKER] Insufficient balance to cover gas fee (${balancePot} POT available).`);
    return;
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log("Commencing Sequential Contract Deployment to Portaldot V3...");
  console.log("--------------------------------------------------------------------------------");

  // ============================================================================
  // STEP 1: Deploy WPotToken
  // ============================================================================
  console.log("\n[1/3] Deploying WPotToken.sol (ERC-20 Wrapped POT, 18 decimals)...");
  const WPotFactory = await ethers.getContractFactory("WPotToken");
  const wpot = await WPotFactory.deploy();
  const wpotTx = wpot.deploymentTransaction()!;
  console.log(`      Broadcast Tx: ${wpotTx.hash}`);
  console.log("      Awaiting block confirmation...");
  const wpotReceipt = await wpotTx.wait();
  const wpotAddress = await wpot.getAddress();

  console.log(`      ✅ Deployed Address: ${wpotAddress}`);
  console.log(`      Mined in Block:    #${wpotReceipt?.blockNumber}`);
  console.log(`      Gas Used:          ${wpotReceipt?.gasUsed?.toString()}`);

  // Verify WPotToken on-chain
  console.log("      Verifying WPotToken on-chain via read-only calls...");
  const wpotCode = await ethers.provider.getCode(wpotAddress);
  if (!wpotCode || wpotCode === "0x") throw new Error("WPotToken code is empty on-chain!");
  const wpotName = await wpot.name();
  const wpotDecimals = await wpot.decimals();
  console.log(`      Bytecode size:     ${(wpotCode.length - 2) / 2} bytes`);
  console.log(`      name():            "${wpotName}"`);
  console.log(`      decimals():        ${wpotDecimals.toString()}`);
  if (wpotName !== "Wrapped POT" || Number(wpotDecimals) !== 18) {
    throw new Error("WPotToken metadata verification failed!");
  }

  // ============================================================================
  // STEP 2: Deploy TestUSDC
  // ============================================================================
  console.log("\n[2/3] Deploying TestUSDC.sol (pUSDC 6-decimal simulation token)...");
  const TestUSDCFactory = await ethers.getContractFactory("TestUSDC");
  const testUSDC = await TestUSDCFactory.deploy();
  const usdcTx = testUSDC.deploymentTransaction()!;
  console.log(`      Broadcast Tx: ${usdcTx.hash}`);
  console.log("      Awaiting block confirmation...");
  const usdcReceipt = await usdcTx.wait();
  const testUSDCAddress = await testUSDC.getAddress();

  console.log(`      ✅ Deployed Address: ${testUSDCAddress}`);
  console.log(`      Mined in Block:    #${usdcReceipt?.blockNumber}`);
  console.log(`      Gas Used:          ${usdcReceipt?.gasUsed?.toString()}`);

  // Verify TestUSDC on-chain
  console.log("      Verifying TestUSDC on-chain via read-only calls...");
  const usdcCode = await ethers.provider.getCode(testUSDCAddress);
  if (!usdcCode || usdcCode === "0x") throw new Error("TestUSDC code is empty on-chain!");
  const usdcName = await testUSDC.name();
  const usdcDecimals = await testUSDC.decimals();
  const usdcMaxMint = await testUSDC.MAX_MINT_PER_CALL();
  console.log(`      Bytecode size:     ${(usdcCode.length - 2) / 2} bytes`);
  console.log(`      name():            "${usdcName}"`);
  console.log(`      decimals():        ${usdcDecimals.toString()}`);
  console.log(`      MAX_MINT_PER_CALL: ${usdcMaxMint.toString()}`);
  if (usdcName !== "Portal Test USD" || Number(usdcDecimals) !== 6) {
    throw new Error("TestUSDC metadata verification failed!");
  }

  // ============================================================================
  // STEP 3: Deploy NexusAMM (passing verified wpotAddress and testUSDCAddress)
  // ============================================================================
  console.log("\n[3/3] Deploying NexusAMM.sol (Constant Product AMM with auto-deployed NexusLPReceipt)...");
  console.log(`      Constructor Args:  _tokenA=${wpotAddress}, _tokenB=${testUSDCAddress}`);
  const NexusAMMFactory = await ethers.getContractFactory("NexusAMM");
  const nexusAMM = await NexusAMMFactory.deploy(wpotAddress, testUSDCAddress);
  const ammTx = nexusAMM.deploymentTransaction()!;
  console.log(`      Broadcast Tx: ${ammTx.hash}`);
  console.log("      Awaiting block confirmation...");
  const ammReceipt = await ammTx.wait();
  const ammAddress = await nexusAMM.getAddress();

  console.log(`      ✅ Deployed Address: ${ammAddress}`);
  console.log(`      Mined in Block:    #${ammReceipt?.blockNumber}`);
  console.log(`      Gas Used:          ${ammReceipt?.gasUsed?.toString()}`);

  // Verify NexusAMM on-chain
  console.log("      Verifying NexusAMM & NexusLPReceipt on-chain...");
  const ammCode = await ethers.provider.getCode(ammAddress);
  if (!ammCode || ammCode === "0x") throw new Error("NexusAMM code is empty on-chain!");

  const token0 = await nexusAMM.token0();
  const token1 = await nexusAMM.token1();
  const receiptAddress = await nexusAMM.receiptContract();
  console.log(`      Bytecode size:     ${(ammCode.length - 2) / 2} bytes`);
  console.log(`      token0():          ${token0}`);
  console.log(`      token1():          ${token1}`);
  console.log(`      receiptContract(): ${receiptAddress}`);

  // Verify token ordering
  const expectedT0 = wpotAddress.toLowerCase() < testUSDCAddress.toLowerCase() ? wpotAddress : testUSDCAddress;
  const expectedT1 = wpotAddress.toLowerCase() < testUSDCAddress.toLowerCase() ? testUSDCAddress : wpotAddress;
  if (token0.toLowerCase() !== expectedT0.toLowerCase() || token1.toLowerCase() !== expectedT1.toLowerCase()) {
    throw new Error("AMM Token ordering mismatch!");
  }

  // Verify NexusLPReceipt
  const receiptCode = await ethers.provider.getCode(receiptAddress);
  if (!receiptCode || receiptCode === "0x") throw new Error("NexusLPReceipt code is empty on-chain!");

  const NexusLPReceiptFactory = await ethers.getContractFactory("NexusLPReceipt");
  const receiptContract = NexusLPReceiptFactory.attach(receiptAddress) as any;
  const receiptAmm = await receiptContract.amm();
  const receiptName = await receiptContract.name();
  console.log(`      Receipt bytecode:  ${(receiptCode.length - 2) / 2} bytes`);
  console.log(`      Receipt name():    "${receiptName}"`);
  console.log(`      Receipt amm():     ${receiptAmm}`);
  if (receiptAmm.toLowerCase() !== ammAddress.toLowerCase()) {
    throw new Error("NexusLPReceipt AMM authority mismatch!");
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL 4 CONTRACTS SUCCESSFULLY DEPLOYED AND INDEPENDENTLY VERIFIED!");
  console.log("================================================================================");

  const totalGasUsed = (wpotReceipt?.gasUsed ?? 0n) + (usdcReceipt?.gasUsed ?? 0n) + (ammReceipt?.gasUsed ?? 0n);
  const totalGasCost = totalGasUsed * gasPrice;
  console.log(`Total Gas Used:  ${totalGasUsed.toString()} units`);
  console.log(`Total Gas Cost:  ${ethers.formatEther(totalGasCost)} POT`);

  // Update frontend config
  const configPath = path.resolve(__dirname, "../../src/contracts/config.ts");
  if (fs.existsSync(configPath)) {
    console.log(`\nUpdating frontend configuration in ${configPath}...`);
    let cfgContent = fs.readFileSync(configPath, "utf8");

    // Replace wpot address
    cfgContent = cfgContent.replace(/wpot:\s*\{[^}]*deployedAddress:\s*null[^}]*isDeployed:\s*false/s, (match) => {
      return match
        .replace(/deployedAddress:\s*null/, `deployedAddress: '${wpotAddress}'`)
        .replace(/isDeployed:\s*false/, "isDeployed: true")
        .replace(/statusText:\s*'[^']*'/, "statusText: 'Verified on Testnet'");
    });

    // Replace testUSDC address
    cfgContent = cfgContent.replace(/testUSDC:\s*\{[^}]*deployedAddress:\s*null[^}]*isDeployed:\s*false/s, (match) => {
      return match
        .replace(/deployedAddress:\s*null/, `deployedAddress: '${testUSDCAddress}'`)
        .replace(/isDeployed:\s*false/, "isDeployed: true")
        .replace(/statusText:\s*'[^']*'/, "statusText: 'Verified on Testnet'");
    });

    // Replace nexusAMM address
    cfgContent = cfgContent.replace(/nexusAMM:\s*\{[^}]*deployedAddress:\s*null[^}]*isDeployed:\s*false/s, (match) => {
      return match
        .replace(/deployedAddress:\s*null/, `deployedAddress: '${ammAddress}'`)
        .replace(/isDeployed:\s*false/, "isDeployed: true")
        .replace(/statusText:\s*'[^']*'/, "statusText: 'Verified on Testnet'");
    });

    // Replace nexusReceipt address
    cfgContent = cfgContent.replace(/nexusReceipt:\s*\{[^}]*deployedAddress:\s*null[^}]*isDeployed:\s*false/s, (match) => {
      return match
        .replace(/deployedAddress:\s*null/, `deployedAddress: '${receiptAddress}'`)
        .replace(/isDeployed:\s*false/, "isDeployed: true")
        .replace(/statusText:\s*'[^']*'/, "statusText: 'Verified on Testnet'");
    });

    fs.writeFileSync(configPath, cfgContent);
    console.log("Frontend configuration updated and marked as isDeployed: true!");
  }

  // Save deployment receipt JSON
  const receiptData = {
    network: "Portaldot V3 Testnet",
    chainId: chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    wpot: {
      address: wpotAddress,
      txHash: wpotTx.hash,
      blockNumber: wpotReceipt?.blockNumber ? Number(wpotReceipt.blockNumber) : null,
      gasUsed: wpotReceipt?.gasUsed?.toString()
    },
    testUSDC: {
      address: testUSDCAddress,
      txHash: usdcTx.hash,
      blockNumber: usdcReceipt?.blockNumber ? Number(usdcReceipt.blockNumber) : null,
      gasUsed: usdcReceipt?.gasUsed?.toString()
    },
    nexusAMM: {
      address: ammAddress,
      txHash: ammTx.hash,
      blockNumber: ammReceipt?.blockNumber ? Number(ammReceipt.blockNumber) : null,
      gasUsed: ammReceipt?.gasUsed?.toString()
    },
    nexusReceipt: {
      address: receiptAddress,
      amm: ammAddress
    },
    totalGasUsed: totalGasUsed.toString(),
    totalGasCostPot: ethers.formatEther(totalGasCost)
  };

  const receiptOutPath = path.resolve(__dirname, "../deployment-receipt.json");
  fs.writeFileSync(receiptOutPath, JSON.stringify(receiptData, null, 2));
  console.log(`Saved deployment receipt to ${receiptOutPath}`);
}

main().catch((err) => {
  console.error("\n❌ Deployment Error:", err);
  process.exit(1);
});
