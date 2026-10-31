import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { setGlobalDispatcher, Agent } from "undici";

if (setGlobalDispatcher && Agent) {
  setGlobalDispatcher(new Agent({ connect: { timeout: 60000 } }));
}

const RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
const EXPECTED_CHAIN_ID = 420420777;
const AUTHORIZED_DEPLOYER = "0xdC7f5c7813a5f0e3F51c2Fe569DE6C5577768A2A";
const MAX_FEE_CEILING_POT = 50.0;
const CONSTRUCTOR_ARG = 42n;

async function getProviderAndSigner() {
  const req = new ethers.FetchRequest(RPC_URL);
  req.timeout = 60000;
  const directProvider = new ethers.JsonRpcProvider(req, undefined, {
    staticNetwork: ethers.Network.from(EXPECTED_CHAIN_ID)
  });

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

  if (!privKey) {
    throw new Error("No deployer private key detected in environment or contracts/.env");
  }

  const cleanKey = privKey.startsWith("0x") ? privKey : `0x${privKey}`;
  const wallet = new ethers.Wallet(cleanKey, directProvider);
  return { provider: directProvider, signer: wallet };
}

async function main() {
  console.log("================================================================================");
  console.log("PortalNexus — Stage 3D Authorized Deployment: PortalTestStorage.sol");
  console.log("================================================================================");

  // 1. Provider & Signer Verification
  const { provider, signer } = await getProviderAndSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`[Check 1] Target Network Chain ID: ${chainId} (Expected: ${EXPECTED_CHAIN_ID})`);
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID}, got ${chainId}. Aborting.`);
  }

  console.log(`[Check 2] Signer Address:          ${signer.address}`);
  if (signer.address.toLowerCase() !== AUTHORIZED_DEPLOYER.toLowerCase()) {
    throw new Error(`Deployer mismatch! Expected ${AUTHORIZED_DEPLOYER}, got ${signer.address}. Aborting.`);
  }

  // 2. Query Live Balances & Nonce
  const balanceWeiBefore = await provider.getBalance(signer.address);
  const balancePotBefore = ethers.formatEther(balanceWeiBefore);
  const nonceBefore = await provider.getTransactionCount(signer.address, "latest");
  const pendingNonce = await provider.getTransactionCount(signer.address, "pending");
  const block = await provider.getBlock("latest");
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 26000n;

  console.log(`[Check 3] Live Deployer Balance:    ${balancePotBefore} tPOT (${balanceWeiBefore.toString()} wei)`);
  console.log(`[Check 4] Account Nonce:            ${nonceBefore} (Pending: ${pendingNonce})`);
  console.log(`          Current Block:            #${block?.number} (${block?.hash})`);
  console.log(`          Live Gas Price:           ${gasPrice.toString()} wei (${(Number(gasPrice) / 1e9).toFixed(6)} Gwei)`);

  if (balanceWeiBefore < ethers.parseEther("50.0")) {
    throw new Error(`Insufficient balance! Available: ${balancePotBefore} tPOT, Minimum: 50.0 tPOT.`);
  }

  // 3. Load Compiled Artifact
  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/PortalTestStorage.sol/PortalTestStorage.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run 'npm run compile' first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // 4. Encode & Estimate Gas
  const iface = new ethers.Interface(artifact.abi);
  const deployData = ethers.concat([
    artifact.bytecode,
    iface.encodeDeploy([CONSTRUCTOR_ARG])
  ]);
  console.log(`[Check 5] Constructor Argument:    ${CONSTRUCTOR_ARG.toString()} (Encoded 32-byte argument verified)`);
  console.log(`[Check 6] Full Creation Payload:   ${(deployData.length - 2) / 2} bytes`);

  console.log("\nSimulating deployment transaction via eth_estimateGas...");
  const estGas = await provider.estimateGas({
    from: signer.address,
    data: deployData
  });
  const estCostWei = estGas * gasPrice;
  const estCostPot = ethers.formatEther(estCostWei);
  console.log(`[Check 7] Estimated Gas:           ${estGas.toString()} units`);
  console.log(`[Check 8] Estimated Transaction Fee:${estCostPot} tPOT (${estCostWei.toString()} wei)`);

  if (Number(estCostPot) > MAX_FEE_CEILING_POT) {
    throw new Error(`Estimated fee (${estCostPot} tPOT) exceeds 50.00 tPOT ceiling! Aborting.`);
  }
  console.log(`[Check 9] Fee Ceiling Compliance:  PASS (${estCostPot} tPOT <= ${MAX_FEE_CEILING_POT} tPOT)`);

  // 5. Broadcast Deployment Transaction
  console.log("\n--------------------------------------------------------------------------------");
  console.log("Broadcasting Authorized Deployment Transaction...");
  console.log("--------------------------------------------------------------------------------");

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(CONSTRUCTOR_ARG);
  const deployTx = contract.deploymentTransaction()!;
  console.log(`🚀 Transaction Broadcast! Hash:     ${deployTx.hash}`);
  console.log("   Awaiting block inclusion & confirmation receipt...");

  const receipt = await deployTx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Deployment transaction reverted on-chain! Status: ${receipt?.status}`);
  }

  const deployedAddress = await contract.getAddress();
  console.log(`✅ Contract Successfully Deployed!`);
  console.log(`   Deployed Address:                ${deployedAddress}`);
  console.log(`   Mined in Block:                  #${receipt.blockNumber} (${receipt.blockHash})`);
  console.log(`   Gas Used:                        ${receipt.gasUsed.toString()} units`);
  
  const effectivePrice = receipt.gasPrice ?? gasPrice;
  const actualFeeWei = receipt.gasUsed * effectivePrice;
  const actualFeePot = ethers.formatEther(actualFeeWei);
  console.log(`   Actual Computational Fee:        ${actualFeePot} tPOT (${actualFeeWei.toString()} wei)`);

  // 6. Post-Deployment Verification Queries
  console.log("\n--------------------------------------------------------------------------------");
  console.log("Commencing Post-Deployment Read-Only State Verification...");
  console.log("--------------------------------------------------------------------------------");

  // Query Runtime Bytecode
  const deployedCode = await provider.getCode(deployedAddress);
  if (!deployedCode || deployedCode === "0x") {
    throw new Error("Deployed runtime bytecode is empty on-chain!");
  }
  const codeSizeBytes = (deployedCode.length - 2) / 2;
  console.log(`[Verification 1] Runtime Bytecode Length: ${codeSizeBytes} bytes (Non-empty verified)`);

  // Query getValue()
  const valOnChain: bigint = await (contract as any).getValue();
  console.log(`[Verification 2] getValue() Query:        ${valOnChain.toString()} (Expected: ${CONSTRUCTOR_ARG.toString()})`);
  if (valOnChain !== CONSTRUCTOR_ARG) {
    throw new Error(`getValue() mismatch! Expected ${CONSTRUCTOR_ARG}, got ${valOnChain}`);
  }

  // Query creator()
  const creatorOnChain: string = await (contract as any).creator();
  console.log(`[Verification 3] creator() Query:         ${creatorOnChain} (Expected: ${AUTHORIZED_DEPLOYER})`);
  if (creatorOnChain.toLowerCase() !== AUTHORIZED_DEPLOYER.toLowerCase()) {
    throw new Error(`creator() mismatch! Expected ${AUTHORIZED_DEPLOYER}, got ${creatorOnChain}`);
  }

  // Check Remaining Deployer Balance
  const balanceWeiAfter = await provider.getBalance(signer.address);
  const balancePotAfter = ethers.formatEther(balanceWeiAfter);
  const totalBalanceSpentWei = balanceWeiBefore - balanceWeiAfter;
  const totalBalanceSpentPot = ethers.formatEther(totalBalanceSpentWei);

  console.log(`[Verification 4] Remaining Deployer Bal:  ${balancePotAfter} tPOT`);
  console.log(`                 Total Balance Spent:     ${totalBalanceSpentPot} tPOT`);
  console.log(`                 Explorer Link:           https://explorer.portaldot.dev/address/${deployedAddress}`);

  // 7. Write Deployment Receipt
  const receiptRecord = {
    network: "Portaldot V3 Testnet",
    chainId: EXPECTED_CHAIN_ID,
    contractName: "PortalTestStorage",
    sourceFile: "contracts/contracts/PortalTestStorage.sol",
    constructorArgument: CONSTRUCTOR_ARG.toString(),
    deployer: AUTHORIZED_DEPLOYER,
    contractAddress: deployedAddress,
    transactionHash: deployTx.hash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPriceWei: effectivePrice.toString(),
    actualFeePot: actualFeePot,
    balanceBeforePot: balancePotBefore,
    balanceAfterPot: balancePotAfter,
    totalBalanceSpentPot: totalBalanceSpentPot,
    bytecodeSizeBytes: codeSizeBytes,
    verifiedGetters: {
      "getValue()": valOnChain.toString(),
      "creator()": creatorOnChain
    },
    timestamp: new Date().toISOString()
  };

  const receiptOutPath = path.resolve(__dirname, "../deployment-receipt-stage3d.json");
  fs.writeFileSync(receiptOutPath, JSON.stringify(receiptRecord, null, 2), "utf8");
  console.log(`\nDeployment receipt successfully saved to: ${receiptOutPath}`);
  console.log("================================================================================");
  console.log("Stage 3D Controlled Deployment & Verification: COMPLETE SUCCESS");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("\n❌ Deployment Failed with Error:", err);
  process.exit(1);
});
