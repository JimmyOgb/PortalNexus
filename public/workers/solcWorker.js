// public/workers/solcWorker.js
// Dedicated Web Worker for in-browser Solidity 0.8.24 compilation.
// Does NOT touch UI thread.

let compilerLoaded = false;
let compileStandard = null;

const PINNED_VERSION = '0.8.24';
const COMPILER_SCRIPT_PATH = '/compilers/soljson-v0.8.24.js';

function initCompiler() {
  if (compilerLoaded && compileStandard) return;
  try {
    // importScripts loads soljson into worker scope
    importScripts(COMPILER_SCRIPT_PATH);
    if (!self.Module || typeof self.Module.cwrap !== 'function') {
      throw new Error('Solidity Emscripten Module failed to initialize or cwrap is missing.');
    }
    compileStandard = self.Module.cwrap('solidity_compile', 'string', ['string', 'number']);
    compilerLoaded = true;
  } catch (err) {
    throw new Error('Failed to load Solidity compiler binary: ' + (err.message || String(err)));
  }
}

self.onmessage = function (event) {
  const { id, type, source, fileName = 'Contract.sol', settings = {} } = event.data || {};

  if (type === 'ping') {
    self.postMessage({ id, type: 'pong', version: PINNED_VERSION });
    return;
  }

  if (type !== 'compile') {
    self.postMessage({ id, success: false, error: 'Unknown worker action: ' + type });
    return;
  }

  try {
    initCompiler();

    // Prepare Standard JSON input
    const input = {
      language: 'Solidity',
      sources: {
        [fileName]: {
          content: source
        }
      },
      settings: {
        optimizer: {
          enabled: settings.optimizer !== false,
          runs: settings.optimizerRuns || 200
        },
        evmVersion: settings.evmVersion || 'cancun',
        outputSelection: {
          '*': {
            '*': [
              'abi',
              'evm.bytecode.object',
              'evm.bytecode.opcodes',
              'evm.deployedBytecode.object',
              'metadata'
            ],
            '': ['ast']
          }
        }
      }
    };

    // Callback 0 prevents arbitrary local/network file resolution
    const outputRaw = compileStandard(JSON.stringify(input), 0);
    const output = JSON.parse(outputRaw);

    self.postMessage({
      id,
      success: true,
      output,
      version: PINNED_VERSION
    });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message || String(error)
    });
  }
};
