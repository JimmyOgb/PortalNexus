import { SELECTORS, isAddress, decodeWords } from '../contracts/abi';
import {
  NETWORK_CONFIG,
  CONTRACT_REGISTRY,
  PORTAL_TEST_STORAGE_DEPLOYMENT,
  ContractDescriptor,
  VerifiedContract
} from '../contracts/config';

export interface PortalTestStorageInspection {
  contractAddress: string;
  chainId: number;
  network: string;
  deployerAddress: string;
  deploymentTxHash: string;
  blockNumber: number;
  explorerUrl: string;
  txExplorerUrl: string;
  runtimeBytecodeSize: number;
  getValue: bigint | null;
  creator: string | null;
  isVerified: boolean;
  verificationError?: string;
  inspectedAt: string;
}

export class ContractInspectionService {
  private rpcUrl: string;

  constructor(rpcUrl: string = NETWORK_CONFIG.evmRpcUrl) {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Internal JSON-RPC client for read-only state calls.
   */
  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!res.ok) {
      throw new Error(`RPC HTTP error (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`RPC call ${method} error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data.result;
  }

  /**
   * Validates EVM address format.
   */
  public isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  /**
   * Looks up a registered contract by registry key.
   */
  public getContractByKey(key: keyof typeof CONTRACT_REGISTRY): ContractDescriptor | null {
    return CONTRACT_REGISTRY[key] || null;
  }

  /**
   * Looks up a registered contract by deployed address (case-insensitive).
   */
  public getContractByAddress(address: string): (ContractDescriptor & { id: string }) | null {
    if (!this.isValidAddress(address)) return null;
    const norm = address.toLowerCase();
    for (const [key, desc] of Object.entries(CONTRACT_REGISTRY)) {
      if (desc.deployedAddress && desc.deployedAddress.toLowerCase() === norm) {
        return { ...desc, id: key };
      }
    }
    return null;
  }

  /**
   * Returns all contracts currently registered.
   */
  public listRegisteredContracts(): Array<ContractDescriptor & { id: string }> {
    return Object.entries(CONTRACT_REGISTRY).map(([id, desc]) => ({
      ...desc,
      id
    }));
  }

  /**
   * Returns the canonical static verified metadata for PortalTestStorage.
   */
  public getPortalTestStorageStatic(): VerifiedContract {
    return PORTAL_TEST_STORAGE_DEPLOYMENT;
  }

  /**
   * Performs an authoritative, fresh read-only RPC inspection of the on-chain PortalTestStorage contract.
   * STRICT FAIL-CLOSED: Does NOT mark verified unless runtime bytecode exists and getters match expected state.
   */
  public async inspectPortalTestStorage(): Promise<PortalTestStorageInspection> {
    const target = PORTAL_TEST_STORAGE_DEPLOYMENT;
    const inspectedAt = new Date().toISOString();

    const baseResult: PortalTestStorageInspection = {
      contractAddress: target.address,
      chainId: target.chainId,
      network: target.network,
      deployerAddress: target.deployer,
      deploymentTxHash: target.deploymentTxHash,
      blockNumber: target.blockNumber,
      explorerUrl: target.verificationMetadata.explorerUrl,
      txExplorerUrl: target.verificationMetadata.txExplorerUrl,
      runtimeBytecodeSize: 0,
      getValue: null,
      creator: null,
      isVerified: false,
      inspectedAt
    };

    try {
      // 1. Verify Chain ID (Fail-Closed on network mismatch)
      const chainIdHex = await this.rpcCall('eth_chainId');
      const chainId = parseInt(chainIdHex, 16);
      if (chainId !== target.chainId) {
        baseResult.verificationError = `Network mismatch: connected to Chain ID ${chainId}, expected ${target.chainId} (${target.network})`;
        return baseResult;
      }

      // 2. Verify Deployed Runtime Bytecode
      const codeHex = await this.rpcCall('eth_getCode', [target.address, 'latest']);
      if (!codeHex || codeHex === '0x' || codeHex === '0x0') {
        baseResult.verificationError = `Contract bytecode missing or uninitialized at ${target.address}`;
        return baseResult;
      }

      const codeSizeBytes = (codeHex.length - 2) / 2;
      baseResult.runtimeBytecodeSize = codeSizeBytes;

      // 3. Query getValue() via selector 0x20965255
      const getValueHex = await this.rpcCall('eth_call', [
        { to: target.address, data: SELECTORS.getValue },
        'latest'
      ]);
      const valueWords = decodeWords(getValueHex, 1);
      const onChainValue = valueWords[0];
      baseResult.getValue = onChainValue;

      // 4. Query creator() via selector 0x02d05d3f
      const creatorHex = await this.rpcCall('eth_call', [
        { to: target.address, data: SELECTORS.creator },
        'latest'
      ]);
      if (typeof creatorHex !== 'string' || creatorHex.length < 66) {
        baseResult.verificationError = 'Malformed creator() response from contract';
        return baseResult;
      }
      const onChainCreator = '0x' + creatorHex.slice(26).toLowerCase();
      baseResult.creator = onChainCreator;

      // 5. Invariant Checks (Value must be 42 and Creator must match authorized deployer)
      const isCreatorMatch = onChainCreator === target.deployer.toLowerCase();
      const isValueMatch = onChainValue === 42n;

      if (!isCreatorMatch) {
        baseResult.verificationError = `Creator mismatch: on-chain ${onChainCreator} != authorized ${target.deployer}`;
        return baseResult;
      }

      if (!isValueMatch) {
        baseResult.verificationError = `getValue() mismatch: on-chain ${onChainValue} != expected 42`;
        return baseResult;
      }

      // All on-chain assertions confirmed
      baseResult.isVerified = true;
      return baseResult;
    } catch (err: any) {
      baseResult.verificationError = err?.message || 'Unknown inspection error';
      return baseResult;
    }
  }
}

export const contractInspectionService = new ContractInspectionService();
