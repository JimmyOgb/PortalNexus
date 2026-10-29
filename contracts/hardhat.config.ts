import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as fs from "fs";
import * as path from "path";
import dns from "dns";
import { setGlobalDispatcher, Agent } from "undici";

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

if (setGlobalDispatcher && Agent) {
  setGlobalDispatcher(new Agent({ connect: { timeout: 60000 } }));
}

// Safely load local .env without printing or storing secrets
function loadLocalPrivateKey(): string[] {
  const envPath = path.resolve(__dirname, ".env");
  let key = process.env.PORTALDOT_PRIVATE_KEY || process.env.DEPLOYER_KEY;

  if (!key && fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("PORTALDOT_PRIVATE_KEY=") || trimmed.startsWith("PRIVATE_KEY=")) {
          key = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  if (key && key.trim()) {
    const cleanKey = key.trim();
    return [cleanKey.startsWith("0x") ? cleanKey : `0x${cleanKey}`];
  }
  return [];
}

const accounts = loadLocalPrivateKey();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 420420777,
    },
    portaldotTestnet: {
      url: "https://test-evm-rpc-v3.portaldot.dev",
      chainId: 420420777,
      accounts: accounts,
      timeout: 60000,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
