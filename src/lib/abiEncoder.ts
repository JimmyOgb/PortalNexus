// src/lib/abiEncoder.ts
// Lightweight, zero-dependency ABI encoder for constructor arguments
// Compliant with Ethereum Contract ABI Specification

export interface ConstructorParam {
  name: string;
  type: string;
  internalType?: string;
  components?: ConstructorParam[];
}

export interface EncodeResult {
  success: boolean;
  encodedHex?: string; // 0x prefixed hex string
  error?: string;
  fieldErrors?: Record<string, string>;
}

function pad32(hex: string, left = true): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return left ? clean.padStart(64, '0') : clean.padEnd(64, '0');
}

function utf8ToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      hex += code.toString(16).padStart(2, '0');
    } else if (code < 0x800) {
      hex += ((code >> 6) | 0xc0).toString(16).padStart(2, '0');
      hex += ((code & 0x3f) | 0x80).toString(16).padStart(2, '0');
    } else if (code < 0xd800 || code >= 0xe000) {
      hex += ((code >> 12) | 0xe0).toString(16).padStart(2, '0');
      hex += (((code >> 6) & 0x3f) | 0x80).toString(16).padStart(2, '0');
      hex += ((code & 0x3f) | 0x80).toString(16).padStart(2, '0');
    } else {
      // surrogate pair
      i++;
      const nextCode = str.charCodeAt(i);
      const full = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
      hex += ((full >> 18) | 0xf0).toString(16).padStart(2, '0');
      hex += (((full >> 12) & 0x3f) | 0x80).toString(16).padStart(2, '0');
      hex += (((full >> 6) & 0x3f) | 0x80).toString(16).padStart(2, '0');
      hex += ((full & 0x3f) | 0x80).toString(16).padStart(2, '0');
    }
  }
  return hex;
}

export function isDynamicType(type: string): boolean {
  const clean = type.trim();
  if (clean === 'string' || clean === 'bytes') return true;
  if (clean.endsWith('[]')) return true;
  // fixed size arrays of dynamic types are also dynamic, but simple types:
  return false;
}

/**
 * Validates and encodes a single ABI value.
 */
export function encodeSingleValue(type: string, value: any): { isDynamic: boolean; head: string; tail: string } {
  const t = type.trim();

  // 1. Boolean
  if (t === 'bool') {
    const b = value === true || value === 'true' || value === '1' || value === 1;
    const isFalse = value === false || value === 'false' || value === '0' || value === 0;
    if (!b && !isFalse) {
      throw new Error(`Invalid boolean value: "${value}". Expected true or false.`);
    }
    return { isDynamic: false, head: pad32(b ? '1' : '0', true), tail: '' };
  }

  // 2. Address
  if (t === 'address') {
    const s = String(value).trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(s)) {
      throw new Error(`Invalid address format: "${s}". Must be a 20-byte 0x-prefixed hex string.`);
    }
    return { isDynamic: false, head: pad32(s.slice(2).toLowerCase(), true), tail: '' };
  }

  // 3. Unsigned Integers (uint8 .. uint256)
  if (t.startsWith('uint')) {
    const bitMatch = t.match(/^uint(\d+)?$/);
    if (!bitMatch) throw new Error(`Unsupported type: ${t}`);
    const bits = bitMatch[1] ? parseInt(bitMatch[1], 10) : 256;
    if (bits % 8 !== 0 || bits < 8 || bits > 256) throw new Error(`Invalid uint bit size: ${bits}`);

    let bi: bigint;
    try {
      bi = BigInt(String(value).trim());
    } catch {
      throw new Error(`Invalid unsigned integer: "${value}".`);
    }

    if (bi < 0n) {
      throw new Error(`Unsigned integer cannot be negative: ${bi}.`);
    }
    const max = (1n << BigInt(bits)) - 1n;
    if (bi > max) {
      throw new Error(`Value ${bi} exceeds maximum range for ${t} (${max}).`);
    }

    return { isDynamic: false, head: pad32(bi.toString(16), true), tail: '' };
  }

  // 4. Signed Integers (int8 .. int256)
  if (t.startsWith('int')) {
    const bitMatch = t.match(/^int(\d+)?$/);
    if (!bitMatch) throw new Error(`Unsupported type: ${t}`);
    const bits = bitMatch[1] ? parseInt(bitMatch[1], 10) : 256;
    if (bits % 8 !== 0 || bits < 8 || bits > 256) throw new Error(`Invalid int bit size: ${bits}`);

    let bi: bigint;
    try {
      bi = BigInt(String(value).trim());
    } catch {
      throw new Error(`Invalid signed integer: "${value}".`);
    }

    const min = -(1n << BigInt(bits - 1));
    const max = (1n << BigInt(bits - 1)) - 1n;
    if (bi < min || bi > max) {
      throw new Error(`Value ${bi} out of range for ${t} [${min}, ${max}].`);
    }

    // Two's complement for 256 bits if negative
    if (bi < 0n) {
      const twosComp = (1n << 256n) + bi;
      return { isDynamic: false, head: pad32(twosComp.toString(16), true), tail: '' };
    }
    return { isDynamic: false, head: pad32(bi.toString(16), true), tail: '' };
  }

  // 5. Fixed Bytes (bytes1 .. bytes32)
  if (t.startsWith('bytes') && t !== 'bytes') {
    const byteMatch = t.match(/^bytes(\d+)$/);
    if (!byteMatch) throw new Error(`Unsupported type: ${t}`);
    const byteCount = parseInt(byteMatch[1], 10);
    if (byteCount < 1 || byteCount > 32) throw new Error(`Invalid bytes length: ${byteCount}`);

    let hex = String(value).trim();
    if (hex.startsWith('0x')) hex = hex.slice(2);
    if (hex.length > byteCount * 2) {
      throw new Error(`Hex data too long for ${t}: got ${hex.length / 2} bytes, max is ${byteCount}.`);
    }
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      throw new Error(`Invalid hex character in ${t}: "${value}".`);
    }
    return { isDynamic: false, head: pad32(hex, false), tail: '' };
  }

  // 6. Dynamic String
  if (t === 'string') {
    const str = String(value ?? '');
    const hex = utf8ToHex(str);
    const byteLength = hex.length / 2;
    const lenHex = pad32(byteLength.toString(16), true);

    // Pad hex to 32-byte chunks (64 hex characters)
    const remainder = hex.length % 64;
    const padding = remainder === 0 ? '' : '0'.repeat(64 - remainder);
    const tail = lenHex + hex + padding;
    return { isDynamic: true, head: '', tail };
  }

  // 7. Dynamic Bytes
  if (t === 'bytes') {
    let hex = String(value ?? '').trim();
    if (hex.startsWith('0x')) hex = hex.slice(2);
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      throw new Error(`Invalid hex characters in bytes input: "${value}".`);
    }
    if (hex.length % 2 !== 0) {
      throw new Error(`Hex bytes must have an even number of characters: got length ${hex.length}.`);
    }
    const byteLength = hex.length / 2;
    const lenHex = pad32(byteLength.toString(16), true);
    const remainder = hex.length % 64;
    const padding = remainder === 0 ? '' : '0'.repeat(64 - remainder);
    const tail = lenHex + hex + padding;
    return { isDynamic: true, head: '', tail };
  }

  // 8. Dynamic Array (e.g. uint256[], address[])
  if (t.endsWith('[]')) {
    const elemType = t.slice(0, -2);
    let items: any[];
    if (Array.isArray(value)) {
      items = value;
    } else {
      const s = String(value).trim();
      if (s.startsWith('[') && s.endsWith(']')) {
        try {
          items = JSON.parse(s);
        } catch {
          // Fallback comma split
          items = s.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean);
        }
      } else if (s === '') {
        items = [];
      } else {
        items = s.split(',').map(x => x.trim()).filter(Boolean);
      }
    }

    const countHex = pad32(items.length.toString(16), true);
    let arrayTail = countHex;
    for (const item of items) {
      const encoded = encodeSingleValue(elemType, item);
      if (encoded.isDynamic) {
        throw new Error(`Nested dynamic arrays (${t}) are not supported in basic constructor encoding.`);
      }
      arrayTail += encoded.head;
    }
    return { isDynamic: true, head: '', tail: arrayTail };
  }

  throw new Error(`Unsupported parameter type: "${t}".`);
}

/**
 * Encodes all constructor parameters into a single ABI-compliant hex string.
 */
export function encodeConstructorArgs(
  params: ConstructorParam[],
  values: Record<string, any>
): EncodeResult {
  if (!params || params.length === 0) {
    return { success: true, encodedHex: '' };
  }

  const fieldErrors: Record<string, string> = {};
  const processed: Array<{ isDynamic: boolean; head: string; tail: string; name: string }> = [];

  // Validate and encode each field
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const fieldKey = p.name || `param_${i}`;
    const rawVal = values[fieldKey];

    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      fieldErrors[fieldKey] = `Parameter "${fieldKey}" (${p.type}) is required.`;
      continue;
    }

    try {
      const res = encodeSingleValue(p.type, rawVal);
      processed.push({ ...res, name: fieldKey });
    } catch (err: any) {
      fieldErrors[fieldKey] = err?.message || `Invalid value for ${p.type}.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
      error: `Validation failed for ${Object.keys(fieldErrors).length} constructor argument(s).`
    };
  }

  // Calculate heads and dynamic offsets
  // Total head size in bytes = params.length * 32
  const headSizeBytes = params.length * 32;
  let currentOffsetBytes = headSizeBytes;

  const headWords: string[] = [];
  const tailChunks: string[] = [];

  for (const item of processed) {
    if (item.isDynamic) {
      // Head contains 32-byte pointer offset
      headWords.push(pad32(currentOffsetBytes.toString(16), true));
      tailChunks.push(item.tail);
      currentOffsetBytes += item.tail.length / 2; // length in bytes
    } else {
      headWords.push(item.head);
    }
  }

  const encodedHex = '0x' + headWords.join('') + tailChunks.join('');
  return {
    success: true,
    encodedHex
  };
}
