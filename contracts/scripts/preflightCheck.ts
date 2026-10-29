import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const balance = await ethers.provider.getBalance(deployer.address);
  const blockNumber = await ethers.provider.getBlockNumber();
  const feeData = await ethers.provider.getFeeData();

  console.log("PREFLIGHT_STATUS=OK");
  console.log(`CHAIN_ID=${chainId}`);
  console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
  console.log(`BALANCE_WEI=${balance.toString()}`);
  console.log(`BALANCE_POT=${ethers.formatEther(balance)}`);
  console.log(`BLOCK_NUMBER=${blockNumber}`);
  console.log(`GAS_PRICE_WEI=${feeData.gasPrice?.toString() ?? "unknown"}`);
}

main().catch((err) => {
  console.error("PREFLIGHT_ERROR:", err.message);
});
