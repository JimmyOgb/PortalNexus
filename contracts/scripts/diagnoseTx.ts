import { setGlobalDispatcher, Agent } from "undici";

setGlobalDispatcher(new Agent({
  connect: {
    timeout: 60_000,
  },
}));

import { ethers } from "hardhat";

async function main() {
  console.log("undici custom agent configured with connectTimeout: 60s");
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("Deployer:", deployer.address);

  const feeData = await ethers.provider.getFeeData();
  console.log("FeeData:", {
    gasPrice: feeData.gasPrice?.toString(),
    maxFeePerGas: feeData.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
  });

  const WPotFactory = await ethers.getContractFactory("WPotToken");
  const deployTx = await WPotFactory.getDeployTransaction();

  const populated = await deployer.populateTransaction(deployTx);
  console.log("Populated tx:", {
    to: populated.to,
    from: populated.from,
    type: populated.type,
    gasLimit: populated.gasLimit?.toString(),
    gasPrice: populated.gasPrice?.toString(),
    maxFeePerGas: populated.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: populated.maxPriorityFeePerGas?.toString(),
    nonce: populated.nonce,
    chainId: populated.chainId?.toString(),
    dataLength: populated.data?.length,
  });

  // Test eth_estimateGas
  try {
    const est = await ethers.provider.estimateGas(populated);
    console.log("eth_estimateGas success:", est.toString());
  } catch (err: any) {
    console.error("eth_estimateGas failed:", err.message);
    if (err.info) console.error("err.info:", err.info);
  }
}

main().catch(console.error);
