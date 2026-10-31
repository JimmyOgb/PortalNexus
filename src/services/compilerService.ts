// src/services/compilerService.ts
// In-browser Solidity compilation service for PortalNexus V3.0
// Pinned compiler: Solidity 0.8.24 (soljson-v0.8.24.js)

export const PINNED_SOLC_VERSION = '0.8.24';
export const MAX_SOURCE_SIZE_BYTES = 500 * 1024; // 500 KB limit
export const DEFAULT_COMPILATION_TIMEOUT_MS = 30000;

export interface ConstructorParam {
  name: string;
  type: string;
  internalType?: string;
  components?: ConstructorParam[];
}

export interface CompiledContract {
  name: string;
  abi: any[];
  bytecode: string; // 0x prefixed creation bytecode
  deployedBytecode: string; // 0x prefixed runtime bytecode
  constructorParams: ConstructorParam[];
  hasConstructor: boolean;
}

export interface CompilerDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  formattedMessage?: string;
  errorCode?: string;
  line?: number;
  column?: number;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

export interface CompilationResult {
  success: boolean;
  contracts: Record<string, CompiledContract>;
  contractNames: string[];
  errors: CompilerDiagnostic[];
  warnings: CompilerDiagnostic[];
  compilerVersion: string;
  compilationTimeMs: number;
  detectedImports: string[];
}

export interface CompilerOptions {
  fileName?: string;
  optimizer?: boolean;
  optimizerRuns?: number;
  evmVersion?: string;
  timeoutMs?: number;
}

/**
 * Validates the file extension, size, and content.
 */
export function validateSourceFile(
  fileName: string,
  fileSizeBytes: number,
  content?: string
): { valid: boolean; error?: string } {
  if (!fileName || !fileName.toLowerCase().endsWith('.sol')) {
    return {
      valid: false,
      error: `Invalid file type for "${fileName}". Only Solidity source files (.sol) are supported.`
    };
  }

  if (fileSizeBytes > MAX_SOURCE_SIZE_BYTES) {
    const sizeKb = (fileSizeBytes / 1024).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeKb} KB) exceeds the maximum allowed limit of 500 KB.`
    };
  }

  if (content !== undefined) {
    if (content.trim().length === 0) {
      return {
        valid: false,
        error: 'Solidity source file is empty.'
      };
    }
    // Check for null characters indicating binary data
    if (content.includes('\0')) {
      return {
        valid: false,
        error: 'File appears to contain binary data instead of valid UTF-8 Solidity source.'
      };
    }
  }

  return { valid: true };
}

/**
 * Extracts pragma solidity directive from source.
 */
export function extractPragma(source: string): string | null {
  const match = source.match(/pragma\s+solidity\s+([^;]+);/i);
  return match ? match[1].trim() : null;
}

/**
 * Helper to parse semver string into [major, minor, patch].
 */
function parseVersion(v: string): [number, number, number] | null {
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function compareVersions(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

/**
 * Checks whether a pragma requirement is satisfied by the pinned compiler version.
 */
export function isPragmaCompatible(
  pragmaRequirement: string,
  targetVersion: string = PINNED_SOLC_VERSION
): { compatible: boolean; error?: string } {
  const target = parseVersion(targetVersion);
  if (!target) {
    return { compatible: false, error: `Invalid pinned compiler version: ${targetVersion}` };
  }

  const cleaned = pragmaRequirement
    .replace(/pragma\s+solidity\s+/i, '')
    .replace(/;/g, '')
    .trim();

  // Caret range, e.g. ^0.8.0 or ^0.8.24
  const caretMatch = cleaned.match(/^\^(\d+\.\d+\.\d+)$/);
  if (caretMatch) {
    const min = parseVersion(caretMatch[1]);
    if (!min) return { compatible: false, error: `Invalid pragma version: ${cleaned}` };
    const max: [number, number, number] = [min[0], min[1] + 1, 0];
    const satisfies = compareVersions(target, min) >= 0 && compareVersions(target, max) < 0;
    if (!satisfies) {
      return {
        compatible: false,
        error: `Pragma "${cleaned}" requires Solidity ${caretMatch[1]} up to <0.${min[1] + 1}.0, but pinned compiler is ${targetVersion}.`
      };
    }
    return { compatible: true };
  }

  // Exact version, e.g. 0.8.24
  const exactMatch = cleaned.match(/^v?(\d+\.\d+\.\d+)$/);
  if (exactMatch) {
    const exact = parseVersion(exactMatch[1]);
    if (!exact || compareVersions(target, exact) !== 0) {
      return {
        compatible: false,
        error: `Pragma requires exact version ${cleaned}, but pinned compiler is ${targetVersion}.`
      };
    }
    return { compatible: true };
  }

  // Compound / operator ranges, e.g. ">=0.8.20 <0.9.0" or ">=0.8.0 <=0.8.24"
  const conditions = cleaned.split(/\s+/);
  for (const cond of conditions) {
    const opMatch = cond.match(/^([><]=?|==?)(v?\d+\.\d+\.\d+)$/);
    if (!opMatch) continue;
    const op = opMatch[1];
    const ver = parseVersion(opMatch[2]);
    if (!ver) continue;
    const c = compareVersions(target, ver);
    if (op === '>=' && c < 0) {
      return { compatible: false, error: `Pragma requires ${cond}, but compiler is ${targetVersion}.` };
    }
    if (op === '>' && c <= 0) {
      return { compatible: false, error: `Pragma requires ${cond}, but compiler is ${targetVersion}.` };
    }
    if (op === '<=' && c > 0) {
      return { compatible: false, error: `Pragma requires ${cond}, but compiler is ${targetVersion}.` };
    }
    if (op === '<' && c >= 0) {
      return { compatible: false, error: `Pragma requires ${cond}, but compiler is ${targetVersion}.` };
    }
    if ((op === '=' || op === '==') && c !== 0) {
      return { compatible: false, error: `Pragma requires ${cond}, but compiler is ${targetVersion}.` };
    }
  }

  return { compatible: true };
}

/**
 * Detects import statements in the source code.
 */
export function detectImports(source: string): string[] {
  const imports: string[] = [];
  const regex = /import\s+(?:(?:(?:\*\s+as\s+[\w$]+)|(?:\{[^}]+\})|[\w$]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  return imports;
}

/**
 * Calculates 1-based line and column from source string character offset.
 */
export function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
  if (offset < 0 || offset > source.length) return { line: 1, column: 1 };
  const lines = source.slice(0, offset).split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

/**
 * Inspects constructor ABI for parameter definitions.
 */
export function extractConstructorParams(abi: any[]): { hasConstructor: boolean; params: ConstructorParam[] } {
  if (!Array.isArray(abi)) return { hasConstructor: false, params: [] };
  const constructorItem = abi.find((item) => item.type === 'constructor');
  if (!constructorItem) {
    return { hasConstructor: false, params: [] };
  }
  const params: ConstructorParam[] = (constructorItem.inputs || []).map((input: any) => ({
    name: input.name || '',
    type: input.type || '',
    internalType: input.internalType || input.type || '',
    components: Array.isArray(input.components)
      ? input.components.map((c: any) => ({
          name: c.name || '',
          type: c.type || '',
          internalType: c.internalType || c.type || ''
        }))
      : undefined
  }));
  return { hasConstructor: true, params };
}

/**
 * Classifies raw compiler output errors into errors vs warnings.
 */
export function parseCompilerDiagnostics(
  rawErrors: any[] | undefined,
  source?: string
): { errors: CompilerDiagnostic[]; warnings: CompilerDiagnostic[] } {
  const errors: CompilerDiagnostic[] = [];
  const warnings: CompilerDiagnostic[] = [];

  if (!Array.isArray(rawErrors)) {
    return { errors, warnings };
  }

  for (const item of rawErrors) {
    const isError = item.severity === 'error';
    let line: number | undefined;
    let column: number | undefined;

    if (source && item.sourceLocation && typeof item.sourceLocation.start === 'number' && item.sourceLocation.start >= 0) {
      const pos = offsetToLineColumn(source, item.sourceLocation.start);
      line = pos.line;
      column = pos.column;
    }

    const diagnostic: CompilerDiagnostic = {
      severity: isError ? 'error' : item.severity === 'info' ? 'info' : 'warning',
      message: item.message || item.formattedMessage || 'Unknown compiler diagnostic',
      formattedMessage: item.formattedMessage,
      errorCode: item.errorCode,
      line,
      column,
      sourceLocation: item.sourceLocation
    };

    if (isError) {
      errors.push(diagnostic);
    } else {
      warnings.push(diagnostic);
    }
  }

  return { errors, warnings };
}

/**
 * Parses Standard JSON output into record of compiled contracts.
 */
export function parseStandardOutput(output: any, _fileName?: string): Record<string, CompiledContract> {
  const contracts: Record<string, CompiledContract> = {};
  if (!output || !output.contracts) return contracts;

  // Include all compiled contracts across source files
  for (const [_fileKey, fileObj] of Object.entries<any>(output.contracts)) {
    for (const [contractName, contractData] of Object.entries<any>(fileObj)) {
      const abi = contractData.abi || [];
      const rawBytecode = contractData.evm?.bytecode?.object || '';
      const rawDeployedBytecode = contractData.evm?.deployedBytecode?.object || '';

      const bytecode = rawBytecode
        ? rawBytecode.startsWith('0x')
          ? rawBytecode
          : '0x' + rawBytecode
        : '';

      const deployedBytecode = rawDeployedBytecode
        ? rawDeployedBytecode.startsWith('0x')
          ? rawDeployedBytecode
          : '0x' + rawDeployedBytecode
        : '';

      const { hasConstructor, params } = extractConstructorParams(abi);

      contracts[contractName] = {
        name: contractName,
        abi,
        bytecode,
        deployedBytecode,
        constructorParams: params,
        hasConstructor
      };
    }
  }

  return contracts;
}

export type WorkerFactory = () => Worker;

/**
 * Service managing compilation requests, worker lifecycle, timeouts, and cancellation.
 */
export class CompilerService {
  private worker: Worker | null = null;
  private workerFactory: WorkerFactory | null = null;
  private currentRequestId: string | null = null;
  private activePending: {
    resolve: (res: CompilationResult) => void;
    reject: (err: any) => void;
    timer: any;
    source: string;
    fileName: string;
    startTime: number;
    detectedImports: string[];
  } | null = null;

  /**
   * Set custom worker factory (useful for testing or custom environments).
   */
  public setWorkerFactory(factory: WorkerFactory | null): void {
    this.workerFactory = factory;
    this.terminateWorker();
  }

  public isCompiling(): boolean {
    return this.activePending !== null;
  }

  /**
   * Gracefully terminate the current Web Worker instance.
   */
  public terminateWorker(): void {
    if (this.activePending) {
      clearTimeout(this.activePending.timer);
      this.activePending.reject(new Error('Compilation cancelled: worker terminated.'));
      this.activePending = null;
      this.currentRequestId = null;
    }
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Ignore termination errors
      }
      this.worker = null;
    }
  }

  /**
   * Cancels any active compilation in flight.
   */
  public cancelCurrentCompilation(): void {
    if (this.activePending) {
      const pending = this.activePending;
      clearTimeout(pending.timer);
      this.activePending = null;
      this.currentRequestId = null;
      if (this.worker) {
        try {
          this.worker.terminate();
        } catch {}
        this.worker = null;
      }
      pending.reject(new Error('Compilation cancelled by user.'));
    }
  }

  /**
   * Initializes or returns the active Web Worker instance.
   */
  private getWorker(): Worker {
    if (this.worker) return this.worker;

    if (this.workerFactory) {
      this.worker = this.workerFactory();
    } else {
      if (typeof Worker === 'undefined') {
        throw new Error('Web Workers are not supported in this runtime environment.');
      }
      this.worker = new Worker('/workers/solcWorker.js');
    }

    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = this.handleWorkerError.bind(this);

    return this.worker;
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || !this.activePending || data.id !== this.currentRequestId) {
      return;
    }

    const { resolve, timer, source, fileName, startTime, detectedImports } = this.activePending;
    clearTimeout(timer);
    this.activePending = null;
    this.currentRequestId = null;

    const compilationTimeMs = Math.round(performance.now() - startTime);

    if (!data.success) {
      // Runtime or compiler failure
      const errorMsg = data.error || 'Solidity compiler encountered an unknown error.';
      resolve({
        success: false,
        contracts: {},
        contractNames: [],
        errors: [
          {
            severity: 'error',
            message: errorMsg
          }
        ],
        warnings: [],
        compilerVersion: PINNED_SOLC_VERSION,
        compilationTimeMs,
        detectedImports
      });
      return;
    }

    const output = data.output || {};
    const { errors, warnings } = parseCompilerDiagnostics(output.errors, source);
    const contracts = parseStandardOutput(output, fileName);
    const contractNames = Object.keys(contracts);
    const success = errors.length === 0 && contractNames.length > 0;

    resolve({
      success,
      contracts,
      contractNames,
      errors,
      warnings,
      compilerVersion: data.version || PINNED_SOLC_VERSION,
      compilationTimeMs,
      detectedImports
    });
  }

  private handleWorkerError(event: ErrorEvent): void {
    if (!this.activePending) return;
    const { reject, timer } = this.activePending;
    clearTimeout(timer);
    this.activePending = null;
    this.currentRequestId = null;
    this.terminateWorker();
    reject(new Error(`Solidity worker crash: ${event.message || 'Worker error'}`));
  }

  /**
   * Main compilation entry point.
   */
  public async compile(source: string, options: CompilerOptions = {}): Promise<CompilationResult> {
    const fileName = options.fileName || 'Contract.sol';
    const timeoutMs = options.timeoutMs || DEFAULT_COMPILATION_TIMEOUT_MS;
    const startTime = performance.now();

    // 1. File validation
    const valResult = validateSourceFile(fileName, new Blob([source]).size, source);
    if (!valResult.valid) {
      return {
        success: false,
        contracts: {},
        contractNames: [],
        errors: [
          {
            severity: 'error',
            message: valResult.error || 'Invalid source file'
          }
        ],
        warnings: [],
        compilerVersion: PINNED_SOLC_VERSION,
        compilationTimeMs: 0,
        detectedImports: []
      };
    }

    // 2. Pragma compatibility check
    const pragma = extractPragma(source);
    const warnings: CompilerDiagnostic[] = [];
    if (!pragma) {
      warnings.push({
        severity: 'warning',
        message: `No "pragma solidity" directive found. Compiling with default pinned version ${PINNED_SOLC_VERSION}.`
      });
    } else {
      const pragmaCheck = isPragmaCompatible(pragma, PINNED_SOLC_VERSION);
      if (!pragmaCheck.compatible) {
        return {
          success: false,
          contracts: {},
          contractNames: [],
          errors: [
            {
              severity: 'error',
              message: pragmaCheck.error || `Pragma incompatible with compiler ${PINNED_SOLC_VERSION}.`
            }
          ],
          warnings,
          compilerVersion: PINNED_SOLC_VERSION,
          compilationTimeMs: 0,
          detectedImports: []
        };
      }
    }

    // 3. Import detection & notice
    const detectedImports = detectImports(source);

    // Cancel any previous compilation still running
    if (this.activePending) {
      this.cancelCurrentCompilation();
    }

    // 4. Delegate to Web Worker
    const worker = this.getWorker();
    const requestId = `compile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentRequestId = requestId;

    return new Promise<CompilationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.currentRequestId === requestId) {
          this.activePending = null;
          this.currentRequestId = null;
          if (this.worker) {
            try {
              this.worker.terminate();
            } catch {}
            this.worker = null;
          }
          reject(new Error(`Compilation timed out after ${timeoutMs / 1000} seconds.`));
        }
      }, timeoutMs);

      this.activePending = {
        resolve,
        reject,
        timer,
        source,
        fileName,
        startTime,
        detectedImports
      };

      worker.postMessage({
        id: requestId,
        type: 'compile',
        source,
        fileName,
        settings: {
          optimizer: options.optimizer !== false,
          optimizerRuns: options.optimizerRuns || 200,
          evmVersion: options.evmVersion || 'cancun'
        }
      });
    });
  }
}

export const compilerService = new CompilerService();
