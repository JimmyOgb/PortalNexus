import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// 1. Generate a cryptographically secure random wallet
const wallet = ethers.Wallet.createRandom();

// 2. Save private key ONLY to contracts/.env (which is strictly ignored by .gitignore)
const envPath = path.resolve(__dirname, "..", ".env");
fs.writeFileSync(envPath, `PORTALDOT_PRIVATE_KEY=${wallet.privateKey}\n`, { mode: 0o600 });

// 3. Print ONLY the public EVM address
console.log(`TEMPORARY_DEPLOYER_ADDRESS=${wallet.address}`);
