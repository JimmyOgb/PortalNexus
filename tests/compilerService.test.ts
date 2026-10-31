import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as vm from 'vm';
import {
  MAX_SOURCE_SIZE_BYTES,
  validateSourceFile,
  extractPragma,
  isPragmaCompatible,
  detectImports,
  offsetToLineColumn,
  extractConstructorParams,
  parseCompilerDiagnostics,
  parseStandardOutput,
  CompilerService
} from '../src/services/compilerService';

describe('Solidity Compiler Service (Stage 3B)', () => {
  describe('File Validation', () => {
    it('accepts valid .sol file under the size limit', () => {
      const res = validateSourceFile('MyToken.sol', 1024, 'pragma solidity 0.8.24;');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects unsupported file extensions', () => {
      const invalidFiles = ['Token.js', 'Contract.ts', 'Logic.rs', 'bytecode.bin', 'source.txt'];
      for (const file of invalidFiles) {
        const res = validateSourceFile(file, 500, 'contract Test {}');
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Only Solidity source files (.sol) are supported');
      }
    });

    it('rejects files exceeding the 500 KB size limit', () => {
      const oversized = MAX_SOURCE_SIZE_BYTES + 1;
      const res = validateSourceFile('HugeContract.sol', oversized, 'contract Huge {}');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds the maximum allowed limit of 500 KB');
    });

    it('rejects empty source content', () => {
      const res = validateSourceFile('Empty.sol', 10, '   \n\t  ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Solidity source file is empty');
    });

    it('rejects files containing null bytes (binary files)', () => {
      const binaryContent = 'pragma solidity 0.8.24;\0\0contract Binary {}';
      const res = validateSourceFile('Binary.sol', binaryContent.length, binaryContent);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('contain binary data instead of valid UTF-8');
    });
  });

  describe('Pragma Extraction and Version Pinning', () => {
    it('extracts pragma statement correctly', () => {
      expect(extractPragma('// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract C {}')).toBe('^0.8.20');
      expect(extractPragma('pragma solidity   >=0.8.0 <0.9.0 ;')).toBe('>=0.8.0 <0.9.0');
      expect(extractPragma('contract NoPragma {}')).toBeNull();
    });

    it('validates compatible pragma ranges for pinned 0.8.24', () => {
      expect(isPragmaCompatible('^0.8.0').compatible).toBe(true);
      expect(isPragmaCompatible('^0.8.20').compatible).toBe(true);
      expect(isPragmaCompatible('^0.8.24').compatible).toBe(true);
      expect(isPragmaCompatible('0.8.24').compatible).toBe(true);
      expect(isPragmaCompatible('v0.8.24').compatible).toBe(true);
      expect(isPragmaCompatible('>=0.8.20 <0.9.0').compatible).toBe(true);
      expect(isPragmaCompatible('>=0.8.0 <=0.8.24').compatible).toBe(true);
    });

    it('rejects incompatible pragma versions', () => {
      // Pinned version 0.8.24 does not satisfy ^0.8.25
      const tooHigh = isPragmaCompatible('^0.8.25');
      expect(tooHigh.compatible).toBe(false);
      expect(tooHigh.error).toContain('pinned compiler is 0.8.24');

      // Different major/minor
      const oldMinor = isPragmaCompatible('^0.7.0');
      expect(oldMinor.compatible).toBe(false);

      // Exact mismatch
      const exactMismatch = isPragmaCompatible('0.8.20');
      expect(exactMismatch.compatible).toBe(false);
      expect(exactMismatch.error).toContain('exact version');

      // Operator out of range
      const aboveMax = isPragmaCompatible('>=0.8.25');
      expect(aboveMax.compatible).toBe(false);

      const belowMin = isPragmaCompatible('<0.8.24');
      expect(belowMin.compatible).toBe(false);
    });
  });

  describe('Import Detection & Diagnostics Mapping', () => {
    it('detects multiple import statements without network resolution', () => {
      const source = `
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.20;
        import "./SafeMath.sol";
        import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
        import * as Lib from "./Utils.sol";
        contract Vault {}
      `;
      const imports = detectImports(source);
      expect(imports).toEqual([
        './SafeMath.sol',
        '@openzeppelin/contracts/token/ERC20/IERC20.sol',
        './Utils.sol'
      ]);
    });

    it('calculates 1-based line and column from offset', () => {
      const source = 'line1\nline2\nline3 is here';
      // 'line3' starts at index 12
      const pos = offsetToLineColumn(source, 12);
      expect(pos.line).toBe(3);
      expect(pos.column).toBe(1);

      // 'is' starts at index 18
      const pos2 = offsetToLineColumn(source, 18);
      expect(pos2.line).toBe(3);
      expect(pos2.column).toBe(7);
    });

    it('classifies errors and warnings correctly from compiler output', () => {
      const rawErrors = [
        {
          severity: 'warning',
          message: 'SPDX license identifier not provided in source file.',
          errorCode: '1878'
        },
        {
          severity: 'error',
          message: 'ParserError: Expected identifier but got ";" ',
          errorCode: '2314',
          sourceLocation: { file: 'Token.sol', start: 10, end: 11 }
        }
      ];

      const { errors, warnings } = parseCompilerDiagnostics(rawErrors, 'line 1\nline 2;\nline 3');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].errorCode).toBe('2314');
      expect(errors[0].line).toBe(2);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].errorCode).toBe('1878');
    });
  });

  describe('Constructor ABI and Contract Output Extraction', () => {
    it('extracts constructor parameters with types and internalTypes', () => {
      const abi = [
        {
          type: 'constructor',
          inputs: [
            { name: 'name_', type: 'string', internalType: 'string' },
            { name: 'symbol_', type: 'string', internalType: 'string' },
            { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
            { name: 'owner', type: 'address', internalType: 'address' }
          ],
          stateMutability: 'nonpayable'
        },
        {
          type: 'function',
          name: 'totalSupply',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }]
        }
      ];

      const { hasConstructor, params } = extractConstructorParams(abi);
      expect(hasConstructor).toBe(true);
      expect(params).toHaveLength(4);
      expect(params[0]).toEqual({ name: 'name_', type: 'string', internalType: 'string', components: undefined });
      expect(params[2]).toEqual({ name: 'initialSupply', type: 'uint256', internalType: 'uint256', components: undefined });
    });

    it('detects contract without constructor or with empty constructor', () => {
      const abiNoConstructor = [
        { type: 'function', name: 'getValue', inputs: [], outputs: [] }
      ];
      expect(extractConstructorParams(abiNoConstructor).hasConstructor).toBe(false);

      const abiEmptyConstructor = [
        { type: 'constructor', inputs: [], stateMutability: 'nonpayable' }
      ];
      const res = extractConstructorParams(abiEmptyConstructor);
      expect(res.hasConstructor).toBe(true);
      expect(res.params).toHaveLength(0);
    });

    it('extracts multiple contracts and formats 0x bytecodes', () => {
      const standardOutput = {
        contracts: {
          'Multi.sol': {
            Token: {
              abi: [{ type: 'function', name: 'transfer' }],
              evm: {
                bytecode: { object: '6080604052348015' },
                deployedBytecode: { object: '60806040' }
              }
            },
            TokenSale: {
              abi: [{ type: 'constructor', inputs: [{ name: 'rate', type: 'uint256' }] }],
              evm: {
                bytecode: { object: '0x123456' },
                deployedBytecode: { object: '1234' }
              }
            }
          }
        }
      };

      const contracts = parseStandardOutput(standardOutput, 'Multi.sol');
      expect(Object.keys(contracts)).toEqual(['Token', 'TokenSale']);

      expect(contracts.Token.bytecode).toBe('0x6080604052348015');
      expect(contracts.Token.deployedBytecode).toBe('0x60806040');
      expect(contracts.Token.hasConstructor).toBe(false);

      expect(contracts.TokenSale.bytecode).toBe('0x123456');
      expect(contracts.TokenSale.hasConstructor).toBe(true);
      expect(contracts.TokenSale.constructorParams[0].name).toBe('rate');
    });
  });

  describe('Worker Lifecycle, Timeouts, and Cancellation', () => {
    let service: CompilerService;

    beforeEach(() => {
      service = new CompilerService();
    });

    afterEach(() => {
      service.terminateWorker();
    });

    it('returns error when file validation fails before invoking worker', async () => {
      const res = await service.compile('contract C {}', { fileName: 'Contract.py' });
      expect(res.success).toBe(false);
      expect(res.errors[0].message).toContain('Only Solidity source files (.sol) are supported');
      expect(service.isCompiling()).toBe(false);
    });

    it('returns error when pragma is incompatible before invoking worker', async () => {
      const source = 'pragma solidity ^0.7.0;\ncontract C {}';
      const res = await service.compile(source, { fileName: 'Old.sol' });
      expect(res.success).toBe(false);
      expect(res.errors[0].message).toContain('pinned compiler is 0.8.24');
      expect(service.isCompiling()).toBe(false);
    });

    it('handles worker compilation success through mocked worker', async () => {
      // Mock worker
      const mockWorker: any = {
        onmessage: null,
        onerror: null,
        terminate: vi.fn(),
        postMessage: vi.fn((data: any) => {
          setTimeout(() => {
            if (mockWorker.onmessage) {
              mockWorker.onmessage({
                data: {
                  id: data.id,
                  success: true,
                  version: '0.8.24',
                  output: {
                    contracts: {
                      'Token.sol': {
                        Token: {
                          abi: [],
                          evm: {
                            bytecode: { object: '6080' },
                            deployedBytecode: { object: '60' }
                          }
                        }
                      }
                    },
                    errors: []
                  }
                }
              } as MessageEvent);
            }
          }, 10);
        })
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const source = 'pragma solidity ^0.8.20;\ncontract Token {}';
      const result = await service.compile(source, { fileName: 'Token.sol' });

      expect(result.success).toBe(true);
      expect(result.contractNames).toEqual(['Token']);
      expect(result.contracts.Token.bytecode).toBe('0x6080');
      expect(result.compilerVersion).toBe('0.8.24');
      expect(result.compilationTimeMs).toBeGreaterThanOrEqual(0);
      expect(service.isCompiling()).toBe(false);
    });

    it('handles compilation errors from worker', async () => {
      const mockWorker: any = {
        onmessage: null,
        onerror: null,
        terminate: vi.fn(),
        postMessage: vi.fn((data: any) => {
          setTimeout(() => {
            if (mockWorker.onmessage) {
              mockWorker.onmessage({
                data: {
                  id: data.id,
                  success: true,
                  version: '0.8.24',
                  output: {
                    errors: [
                      {
                        severity: 'error',
                        message: 'ParserError: Expected "contract", "interface" or "library"',
                        errorCode: '2314'
                      }
                    ]
                  }
                }
              } as MessageEvent);
            }
          }, 10);
        })
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const result = await service.compile('invalid solidity code;', { fileName: 'Bad.sol' });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errorCode).toBe('2314');
    });

    it('cancels active compilation on request', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        onmessage: null as any,
        onerror: null as any,
        terminate: vi.fn()
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const compilePromise = service.compile('pragma solidity ^0.8.20;\ncontract Slow {}');
      expect(service.isCompiling()).toBe(true);

      service.cancelCurrentCompilation();
      expect(service.isCompiling()).toBe(false);
      expect(mockWorker.terminate).toHaveBeenCalled();

      await expect(compilePromise).rejects.toThrow('Compilation cancelled by user.');
    });

    it('times out when worker fails to respond within timeoutMs', async () => {
      const mockWorker = {
        postMessage: vi.fn(), // Never replies
        onmessage: null as any,
        onerror: null as any,
        terminate: vi.fn()
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const compilePromise = service.compile('pragma solidity ^0.8.20;\ncontract Hang {}', {
        timeoutMs: 50 // Short timeout for test
      });

      await expect(compilePromise).rejects.toThrow('Compilation timed out after 0.05 seconds.');
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('handles worker crashes and error events', async () => {
      const mockWorker: any = {
        onmessage: null,
        onerror: null,
        terminate: vi.fn(),
        postMessage: vi.fn(() => {
          setTimeout(() => {
            if (mockWorker.onerror) {
              mockWorker.onerror({ message: 'Out of memory in Emscripten WASM' } as ErrorEvent);
            }
          }, 10);
        })
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const compilePromise = service.compile('pragma solidity ^0.8.20;\ncontract Crash {}');
      await expect(compilePromise).rejects.toThrow('Solidity worker crash: Out of memory in Emscripten WASM');
    });

    it('cancels previous compilation when a new concurrent compilation is started', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        onmessage: null as any,
        onerror: null as any,
        terminate: vi.fn()
      };

      service.setWorkerFactory(() => mockWorker as unknown as Worker);

      const firstPromise = service.compile('pragma solidity ^0.8.20;\ncontract First {}');
      const secondPromise = service.compile('pragma solidity ^0.8.20;\ncontract Second {}');

      // First compilation should be rejected due to cancellation
      await expect(firstPromise).rejects.toThrow('Compilation cancelled by user.');

      // Second compilation remains active
      expect(service.isCompiling()).toBe(true);
      const secondCatch = expect(secondPromise).rejects.toThrow('Compilation cancelled by user.');
      service.cancelCurrentCompilation();
      await secondCatch;
    });
  });

  describe('Real Pinned Soljson (0.8.24) End-to-End Simulation', () => {
    let compileStandard: any;

    beforeAll(() => {
      // Load real downloaded compiler binary once in a sandbox VM to test actual compilation
      const compilerPath = path.resolve('public/compilers/soljson-v0.8.24.js');
      expect(fs.existsSync(compilerPath)).toBe(true);

      const code = fs.readFileSync(compilerPath, 'utf8');
      const ctx: any = { console, importScripts: () => {} };
      ctx.self = ctx;
      ctx.self.location = { href: 'http://localhost/workers/solcWorker.js' };
      vm.createContext(ctx);
      vm.runInContext(code, ctx);
      compileStandard = ctx.Module.cwrap('solidity_compile', 'string', ['string', 'number']);
      expect(typeof compileStandard).toBe('function');
    }, 30000);

    it('compiles an ERC-20 contract and extracts creation bytecode and ABI', () => {
      const source = `
        // SPDX-License-Identifier: MIT
        pragma solidity 0.8.24;
        contract SimpleToken {
            string public name = "Portal Token";
            string public symbol = "POT";
            uint8 public decimals = 18;
            uint256 public totalSupply;
            mapping(address => uint256) public balanceOf;

            constructor(uint256 initialSupply) {
                totalSupply = initialSupply;
                balanceOf[msg.sender] = initialSupply;
            }

            function transfer(address to, uint256 amount) external returns (bool) {
                require(balanceOf[msg.sender] >= amount, "Insufficient balance");
                balanceOf[msg.sender] -= amount;
                balanceOf[to] += amount;
                return true;
            }
        }
      `;

      const input = {
        language: 'Solidity',
        sources: {
          'SimpleToken.sol': { content: source }
        },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
            }
          }
        }
      };

      const rawOutput = compileStandard(JSON.stringify(input), 0);
      const output = JSON.parse(rawOutput);

      const contracts = parseStandardOutput(output, 'SimpleToken.sol');
      expect(contracts.SimpleToken).toBeDefined();
      expect(contracts.SimpleToken.bytecode.startsWith('0x')).toBe(true);
      expect(contracts.SimpleToken.bytecode.length).toBeGreaterThan(100);
      expect(contracts.SimpleToken.hasConstructor).toBe(true);
      expect(contracts.SimpleToken.constructorParams).toHaveLength(1);
      expect(contracts.SimpleToken.constructorParams[0].name).toBe('initialSupply');
      expect(contracts.SimpleToken.constructorParams[0].type).toBe('uint256');

      const transferFunc = contracts.SimpleToken.abi.find((item: any) => item.name === 'transfer');
      expect(transferFunc).toBeDefined();
      expect(transferFunc.inputs).toHaveLength(2);
    }, 30000);

    it('returns compiler error when unresolved import is referenced', () => {
      const source = `
        // SPDX-License-Identifier: MIT
        pragma solidity 0.8.24;
        import "./NonExistent.sol";
        contract Test {}
      `;

      const input = {
        language: 'Solidity',
        sources: { 'Test.sol': { content: source } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
      };

      const rawOutput = compileStandard(JSON.stringify(input), 0);
      const output = JSON.parse(rawOutput);

      const { errors } = parseCompilerDiagnostics(output.errors, source);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe('error');
      // Solc returns explicit import error without network fetch
      expect(errors[0].message).toMatch(/not found/i);
    });
  });
});
