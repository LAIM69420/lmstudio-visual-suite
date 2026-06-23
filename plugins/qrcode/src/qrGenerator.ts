// ---------------------------------------------------------------------------
// QR Code generator — Version 1-L (21×21 modules, numeric mode)
// Pure TypeScript, no external dependencies.
// ---------------------------------------------------------------------------

// GF(256) tables for QR code (generator polynomial: x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);

function initGF(): void {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  GF_EXP[255] = 1; // treat GF_EXP[255] as GF_EXP[0]
}
initGF();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function gfPolyMul(poly: Uint8Array, factor: number): Uint8Array {
  const result = new Uint8Array(poly.length);
  for (let i = 0; i < poly.length; i++) {
    result[i] = gfMul(poly[i], factor);
  }
  return result;
}

// Generator polynomial for 7 EC codewords (ECC level L, version 1)
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]); // start with 1
  for (let i = 0; i < degree; i++) {
    // multiply by (x + GF_EXP[i])
    const shifted = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) shifted[j + 1] = poly[j];
    const multiplied = gfPolyMul(poly, GF_EXP[i]);
    for (let j = 0; j < multiplied.length; j++) {
      shifted[j] ^= multiplied[j];
    }
    poly = shifted;
  }
  return poly;
}

const RS_GEN = rsGeneratorPoly(7);

function rsEncode(data: Uint8Array, degree: number): Uint8Array {
  // Polynomial division in GF(256)
  const remainder = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < degree - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(factor, RS_GEN[j]);
    }
    remainder[degree - 1] = gfMul(factor, RS_GEN[degree - 1]);
  }
  return remainder;
}

// ---------------------------------------------------------------------------
// Module matrix (21x21 for version 1)
// ---------------------------------------------------------------------------

const SIZE = 21;

function makeMatrix(): Uint8Array[] {
  const m: Uint8Array[] = [];
  for (let y = 0; y < SIZE; y++) {
    m.push(new Uint8Array(SIZE));
  }
  return m;
}

function setFinderPatterns(m: Uint8Array[]): void {
  // Finder pattern at (0,0)
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const v = (y === 0 || y === 6 || x === 0 || x === 6 ||
                 (y >= 2 && y <= 4 && x >= 2 && x <= 4)) ? 1 : 0;
      m[y][x] = v;
      m[y][x + (SIZE - 7)] = v;
      m[y + (SIZE - 7)][x] = v;
    }
  }
}

function setTimingPatterns(m: Uint8Array[]): void {
  for (let i = 8; i < SIZE - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

function setDarkModule(m: Uint8Array[]): void {
  m[SIZE - 8][8] = 1;
}

// Format info (for version 1, L error correction, mask pattern)
const FORMAT_TABLES: Record<string, number> = {
  // mask 0..7 for ECC L
  "L0": 0x72, "L1": 0x47, "L2": 0x5a, "L3": 0x6f,
  "L4": 0x36, "L5": 0x03, "L6": 0x1e, "L7": 0x2b,
};

function setFormatInfo(m: Uint8Array[], maskIdx: number): void {
  const bits = FORMAT_TABLES[`L${maskIdx}`] ?? 0x72;
  // Horizontal: columns 0..8 in row 8, skipping timing
  for (let i = 0; i <= 5; i++)  m[8][i] = (bits >> (14 - i)) & 1;
  m[8][7] = (bits >> 8) & 1;
  m[8][8] = (bits >> 7) & 1;
  m[7][8] = (bits >> 6) & 1;
  // Vertical: rows 0..8 in column 8, skipping timing
  for (let i = 0; i <= 5; i++)  m[i > 5 ? i + 1 : i][8] = (bits >> (14 - i)) & 1;
  // Remaining format bits at bottom-left and top-right corners
  for (let i = 9; i <= 14; i++) {
    m[SIZE - 1 - (14 - i)][8] = (bits >> (14 - i)) & 1;
    m[8][SIZE - 1 - (14 - i)] = (bits >> (14 - i)) & 1;
  }
}

// ---------------------------------------------------------------------------
// Numeric encoding
// ---------------------------------------------------------------------------

function encodeNumeric(text: string): { data: Uint8Array; bitLen: number } {
  const digits = text.replace(/[^0-9]/g, "");
  const bits: number[] = [];

  // Mode indicator: 0001 (4 bits)
  bits.push(0, 0, 0, 1);

  // Character count (10 bits for version 1 numeric)
  const count = digits.length;
  for (let i = 9; i >= 0; i--) {
    bits.push((count >> i) & 1);
  }

  // Encode groups of 3 digits
  let i = 0;
  while (i < digits.length) {
    const remaining = digits.length - i;
    let val: number;
    let bitCount: number;
    if (remaining >= 3) {
      val = parseInt(digits.substring(i, i + 3), 10);
      bitCount = 10;
    } else if (remaining === 2) {
      val = parseInt(digits.substring(i, i + 2), 10);
      bitCount = 7;
    } else {
      val = parseInt(digits.substring(i, i + 1), 10);
      bitCount = 4;
    }
    for (let b = bitCount - 1; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
    i += remaining >= 3 ? 3 : remaining;
  }

  return { data: new Uint8Array(bits), bitLen: bits.length };
}

// ---------------------------------------------------------------------------
// Data codewords
// ---------------------------------------------------------------------------

function bitsToBytes(bits: number[], padLen: number): Uint8Array {
  const result = new Uint8Array(padLen);
  for (let i = 0; i < padLen * 8; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - (i % 8);
    if (i < bits.length && bits[i]) {
      result[byteIdx] |= (1 << bitIdx);
    }
  }
  return result;
}

const PAD_BYTES = [0xec, 0x11];

function makeDataCodewords(text: string): Uint8Array {
  const encoded = encodeNumeric(text);
  const totalDataBits = 152; // 19 bytes * 8 for version 1-L
  const bits: number[] = Array.from(encoded.data);

  // Terminator: up to 4 zero bits
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad to full capacity
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    bits.push((PAD_BYTES[padIdx % 2] >> 7) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 6) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 5) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 4) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 3) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 2) & 1);
    bits.push((PAD_BYTES[padIdx % 2] >> 1) & 1);
    bits.push(PAD_BYTES[padIdx % 2] & 1);
    padIdx++;
  }

  return bitsToBytes(bits, 19);
}

// ---------------------------------------------------------------------------
// Data placement (version 1)
// ---------------------------------------------------------------------------

function placeData(m: Uint8Array[], dataBytes: Uint8Array, ecBytes: Uint8Array, maskIdx: number): void {
  const allBytes = new Uint8Array(dataBytes.length + ecBytes.length);
  allBytes.set(dataBytes);
  allBytes.set(ecBytes, dataBytes.length);

  let bitIdx = 0;
  const totalBits = allBytes.length * 8;

  // Traverse in QR zig-zag pattern (bottom-right to top-left)
  let col = SIZE - 1;
  let row = SIZE - 1;
  let direction = -1; // -1 = up, 1 = down
  let pass = 0; // 0 = right column, 1 = left column

  while (col > 0) {
    // Skip column 6 (timing pattern)
    if (col === 6) { col--; continue; }

    const x1 = col - pass;
    const x2 = col - (1 - pass);
    const cells: { x: number; y: number }[] = [];

    if (direction === -1) {
      cells.push({ x: x1, y: row });
      cells.push({ x: x2, y: row });
      row--;
      if (row < 0) {
        direction = 1;
        row = 0;
        pass = 1 - pass;
        if (pass === 0) col -= 2;
      }
    } else {
      cells.push({ x: x1, y: row });
      cells.push({ x: x2, y: row });
      row++;
      if (row >= SIZE) {
        direction = -1;
        row = SIZE - 1;
        pass = 1 - pass;
        if (pass === 0) col -= 2;
      }
    }

    for (const cell of cells) {
      // Skip reserved areas
      if (m[cell.y][cell.x] !== 0) continue;
      // Skip format/timing
      if (cell.y === 8 || cell.x === 8) continue;
      if (cell.y === 6 || cell.x === 6) continue;

      // Skip finder patterns
      if ((cell.y < 7 && cell.x < 7) ||
          (cell.y < 7 && cell.x >= SIZE - 7) ||
          (cell.y >= SIZE - 7 && cell.x < 7)) continue;

      let bit = 0;
      if (bitIdx < totalBits) {
        const byteVal = allBytes[Math.floor(bitIdx / 8)];
        bit = (byteVal >> (7 - (bitIdx % 8))) & 1;
        bitIdx++;
      }

      // Apply mask
      let masked = bit;
      switch (maskIdx) {
        case 0: masked = bit ^ ((cell.y + cell.x) % 2 === 0 ? 1 : 0); break;
        case 1: masked = bit ^ (cell.y % 2 === 0 ? 1 : 0); break;
        case 2: masked = bit ^ (cell.x % 3 === 0 ? 1 : 0); break;
        case 3: masked = bit ^ ((cell.y + cell.x) % 3 === 0 ? 1 : 0); break;
        case 4: masked = bit ^ ((Math.floor(cell.y / 2) + Math.floor(cell.x / 3)) % 2 === 0 ? 1 : 0); break;
        case 5: masked = bit ^ (((cell.y * cell.x) % 2) + ((cell.y * cell.x) % 3) === 0 ? 1 : 0); break;
        case 6: masked = bit ^ ((((cell.y * cell.x) % 2) + ((cell.y * cell.x) % 3)) % 2 === 0 ? 1 : 0); break;
        case 7: masked = bit ^ (((cell.y + cell.x) % 2) + ((cell.y * cell.x) % 3) % 2 === 0 ? 1 : 0); break;
      }
      m[cell.y][cell.x] = masked;
    }
  }
}

// ---------------------------------------------------------------------------
// Mask penalty scoring (choose best mask)
// ---------------------------------------------------------------------------

function penaltyScore(m: Uint8Array[]): number {
  let score = 0;

  // Adjacent modules in same color (row)
  for (let y = 0; y < SIZE; y++) {
    let runLen = 1;
    for (let x = 1; x < SIZE; x++) {
      if (m[y][x] === m[y][x - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) score += runLen + (runLen >= 5 ? -2 : 0);
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen + (runLen >= 5 ? -2 : 0);
  }

  // Adjacent modules in same color (col)
  for (let x = 0; x < SIZE; x++) {
    let runLen = 1;
    for (let y = 1; y < SIZE; y++) {
      if (m[y][x] === m[y - 1][x]) {
        runLen++;
      } else {
        if (runLen >= 5) score += runLen + (runLen >= 5 ? -2 : 0);
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen + (runLen >= 5 ? -2 : 0);
  }

  // 2x2 blocks
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      if (m[y][x] === m[y][x + 1] &&
          m[y][x] === m[y + 1][x] &&
          m[y][x] === m[y + 1][x + 1]) {
        score += 3;
      }
    }
  }

  // Finder-like patterns (1:1:3:1:1)
  const pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]; // dark-light-dark-dark-dark-light-dark
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE - 10; x++) {
      let match = true;
      for (let k = 0; k < 11; k++) {
        if (m[y][x + k] !== pattern[k]) { match = false; break; }
      }
      if (match) score += 40;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE - 10; y++) {
      let match = true;
      for (let k = 0; k < 11; k++) {
        if (m[y + k][x] !== pattern[k]) { match = false; break; }
      }
      if (match) score += 40;
    }
  }

  // Balance penalty
  let darkCount = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (m[y][x] === 1) darkCount++;
    }
  }
  const total = SIZE * SIZE;
  const ratio = (darkCount / total) * 100;
  const prev = Math.abs(Math.floor(ratio / 5) * 5 - 50);
  const next = Math.abs(Math.ceil(ratio / 5) * 5 - 50);
  score += Math.min(prev, next) * 10;

  return score;
}

// ---------------------------------------------------------------------------
// Main encode function
// ---------------------------------------------------------------------------

export function qrEncode(text: string): string {
  // Sanitize: only digits for numeric mode
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length === 0) throw new Error("QR code numeric mode requires at least one digit.");
  if (digits.length > 41) throw new Error(`Numeric data too long (${digits.length} > 41 max for version 1-L).`);

  // Encode data
  const dataCW = makeDataCodewords(digits);
  const ecCW = rsEncode(dataCW, 7);

  // Try all mask patterns, pick best
  let bestScore = Infinity;
  let bestMatrix: Uint8Array[] | null = null;
  let bestMask = 0;

  for (let mask = 0; mask < 8; mask++) {
    const m = makeMatrix();
    setFinderPatterns(m);
    setTimingPatterns(m);
    setDarkModule(m);
    placeData(m, dataCW, ecCW, mask);
    setFormatInfo(m, mask);

    const sc = penaltyScore(m);
    if (sc < bestScore) {
      bestScore = sc;
      bestMatrix = m;
      bestMask = mask;
    }
  }

  // Render to SVG
  const moduleSize = 8;
  const quietZone = 4;
  const qz = quietZone;
  const size = (SIZE + qz * 2) * moduleSize;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">\n`;
  svg += `  <rect width="${size}" height="${size}" fill="white"/>\n`;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (bestMatrix![y][x] === 1) {
        svg += `  <rect x="${(x + qz) * moduleSize}" y="${(y + qz) * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>\n`;
      }
    }
  }
  svg += `</svg>`;

  return svg;
}
