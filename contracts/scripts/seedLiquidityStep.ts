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
const AMM_ADDRESS = "0x407A2609dfd5336a38D6274B1EFc1804930f160A";
const USDC_ADDRESS = "0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002";
const MAX_CUMULATIVE_CEILING_POT = 29.71;

const USDC_ABI = [
  "function faucetMint(address to, uint256 amount) external",
  "function approve(address guy, uint256 wad) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address, address) external view returns (uint256)"
];

const AMM_ABI = [
  "function addLiquidity(uint256 amountUSDCDesired, uint256 minAmountPOT, uint256 minAmountUSDC, uint256 deadline) external payable returns (uint256 tokenId, uint256 shares, uint256 amountPOT, uint256 amountUSDC)",
  "function getReserves() external view returns (uint256, uint256)",
  "function totalLiquidityShares() external view returns (uint256)",
  "function ownerOf(uint256) external view returns (address)",
  "function balanceOf(address) external view returns (uint256)",
  "function getPosition(uint256) external view returns (address, uint256, uint256, uint256, uint256)"
];

export async function getProviderAndSigner() {
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

export async function runPreflightChecks(provider: ethers.JsonRpcProvider, signerAddress: string) {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID}, got ${chainId}`);
  }
  if (signerAddress.toLowerCase() !== AUTHORIZED_DEPLOYER.toLowerCase()) {
    throw new Error(`Deployer address mismatch! Expected ${AUTHORIZED_DEPLOYER}, got ${signerAddress}`);
  }

  const balance = await provider.getBalance(signerAddress);
  const nonce = await provider.getTransactionCount(signerAddress, "latest");
  const pendingNonce = await provider.getTransactionCount(signerAddress, "pending");

  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);

  const [usdcBal, usdcAllow, reserves, totalShares, feeData, block] = await Promise.all([
    usdc.balanceOf(signerAddress),
    usdc.allowance(signerAddress, AMM_ADDRESS),
    amm.getReserves(),
    amm.totalLiquidityShares(),
    provider.getFeeData(),
    provider.getBlock("latest")
  ]);

  const gasPrice = feeData.gasPrice ?? 26000n;

  return {
    chainId,
    signerAddress,
    balanceWei: balance.toString(),
    balancePot: ethers.formatEther(balance),
    nonce,
    pendingNonce,
    usdcBalance: usdcBal.toString(),
    usdcAllowance: usdcAllow.toString(),
    reservePOT: reserves[0].toString(),
    reserveUSDC: reserves[1].toString(),
    totalShares: totalShares.toString(),
    gasPriceWei: gasPrice.toString(),
    blockNumber: block?.number,
    blockTimestamp: block?.timestamp
  };
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || "--check";

  const { provider, signer } = await getProviderAndSigner();
  console.log("--------------------------------------------------------------------------------");
  console.log("PortalNexus Stage 4.2C Controlled Liquidity Seeding Runner");
  console.log(`Action: ${action} | Signer: ${signer.address}`);
  console.log("--------------------------------------------------------------------------------");

  const state = await runPreflightChecks(provider, signer.address);
  console.log("Preflight Status:", JSON.stringify(state, null, 2));

  if (action === "--check") {
    console.log("Preflight check completed successfully.");
    return;
  }

  if (action === "--tx1") {
    console.log("\n>>> Executing Transaction 1: faucetMint(deployer, 500000000)...");
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
    const tx = await usdc.faucetMint(AUTHORIZED_DEPLOYER, 500000000n);
    console.log(`Transaction 1 Broadcast! Hash: ${tx.hash}`);
    console.log("Awaiting block confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Tx 1 failed! Status: ${receipt?.status}`);
    }
    console.log(`✅ Tx 1 Confirmed in block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`);

    const newBal = await usdc.balanceOf(AUTHORIZED_DEPLOYER);
    console.log(`Verified Deployer pUSDC Balance: ${newBal.toString()} units`);
    if (newBal !== 500000000n) {
      throw new Error(`Balance mismatch after Tx 1! Expected 500000000, got ${newBal.toString()}`);
    }
    return;
  }

  if (action === "--tx2") {
    console.log("\n>>> Executing Transaction 2: approve(AMM, 500000000)...");
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
    const curBal = await usdc.balanceOf(AUTHORIZED_DEPLOYER);
    if (curBal < 500000000n) {
      throw new Error(`Deployer pUSDC balance (${curBal.toString()}) is insufficient for Tx 2!`);
    }

    const tx = await usdc.approve(AMM_ADDRESS, 500000000n);
    console.log(`Transaction 2 Broadcast! Hash: ${tx.hash}`);
    console.log("Awaiting block confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Tx 2 failed! Status: ${receipt?.status}`);
    }
    console.log(`✅ Tx 2 Confirmed in block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`);

    const newAllow = await usdc.allowance(AUTHORIZED_DEPLOYER, AMM_ADDRESS);
    console.log(`Verified AMM Allowance: ${newAllow.toString()} units`);
    if (newAllow !== 500000000n) {
      throw new Error(`Allowance mismatch after Tx 2! Expected 500000000, got ${newAllow.toString()}`);
    }
    return;
  }

  if (action === "--tx3") {
    console.log("\n>>> Executing Transaction 3: addLiquidity(500000000, 4975000000000000000, 497500000, deadline)...");
    const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, signer);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

    const [curAllow, reserves, block] = await Promise.all([
      usdc.allowance(AUTHORIZED_DEPLOYER, AMM_ADDRESS),
      amm.getReserves(),
      provider.getBlock("latest")
    ]);

    if (curAllow < 500000000n) {
      throw new Error(`Allowance (${curAllow.toString()}) insufficient for Tx 3!`);
    }
    if (reserves[0] !== 0n || reserves[1] !== 0n) {
      throw new Error(`Pool is not empty! reservePOT: ${reserves[0].toString()}, reserveUSDC: ${reserves[1].toString()}`);
    }

    const currentTimestamp = block ? BigInt(block.timestamp) : BigInt(Math.floor(Date.now() / 1000));
    const deadline = currentTimestamp + 600n; // +10 minutes

    const desiredUSDC = 500000000n;
    const minPOT = 4975000000000000000n;
    const minUSDC = 497500000n;
    const nativeValue = ethers.parseEther("5.0");

    console.log(`Submitting addLiquidity with deadline ${deadline.toString()} and 5.0 tPOT...`);
    const tx = await amm.addLiquidity(desiredUSDC, minPOT, minUSDC, deadline, {
      value: nativeValue
    });

    console.log(`Transaction 3 Broadcast! Hash: ${tx.hash}`);
    console.log("Awaiting block confirmation...");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Tx 3 failed! Status: ${receipt?.status}`);
    }
    console.log(`✅ Tx 3 Confirmed in block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`);

    // Verification
    const [finalReserves, finalShares, pos] = await Promise.all([
      amm.getReserves(),
      amm.totalLiquidityShares(),
      amm.getPosition(1)
    ]);

    console.log("\n=== POST-EXECUTION VERIFICATION ===");
    console.log(`reservePOT:   ${finalReserves[0].toString()} wei (${ethers.formatEther(finalReserves[0])} tPOT)`);
    console.log(`reserveUSDC:  ${finalReserves[1].toString()} units (${(Number(finalReserves[1]) / 1e6).toFixed(2)} pUSDC)`);
    console.log(`totalShares:  ${finalShares.toString()}`);
    console.log(`Position 1 shares:        ${pos[1].toString()}`);
    console.log(`Position 1 potDeposited:  ${pos[2].toString()}`);
    console.log(`Position 1 usdcDeposited: ${pos[3].toString()}`);
    return;
  }

  throw new Error(`Unknown action: ${action}`);
}

main().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
