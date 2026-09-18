/* ============================================================
   KURSI QR — embedded offline QR encoder (no network needed)
   Byte mode, versions 1–4, ECC levels L/M/Q/H, full mask
   evaluation. Returns an SVG string, or null when the payload
   exceeds capacity (caller falls back to the QR API).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- GF(256) ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  function rsGenPoly(nsym) {
    let g = [1];
    for (let i = 0; i < nsym; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { ng[j] ^= mul(g[j], EXP[i]); ng[j + 1] ^= g[j]; }
      g = ng;
    }
    return g; // leading coeff 1
  }
  function rsEncode(msg, nsym) {
    const gen = rsGenPoly(nsym);
    const out = msg.slice().concat(new Array(nsym).fill(0));
    for (let i = 0; i < msg.length; i++) {
      const c = out[i];
      if (c) for (let j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], c);
    }
    return out.slice(msg.length);
  }

  /* ---------- tables (byte-mode capacity + block structure) ---------- */
  // LEVEL order: L, M, Q, H —  ecPerBlock, [dataCodewords per block]
  const STRUCT = {
    1: { L: [7, [19]], M: [10, [16]], Q: [13, [13]], H: [17, [9]] },
    2: { L: [10, [34]], M: [16, [28]], Q: [22, [22]], H: [28, [16]] },
    3: { L: [15, [55]], M: [26, [44]], Q: [18, [17, 17]], H: [22, [13, 13]] },
    4: { L: [20, [80]], M: [18, [32, 32]], Q: [26, [24, 24]], H: [16, [9, 9, 9, 9]] }
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };
  const EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function capacityOf(v, lvl) { // byte-mode max payload
    const dataCw = STRUCT[v][lvl][1].reduce((a, b) => a + b, 0);
    return Math.max(0, dataCw - 2); // 12 bits header ≈ 2 codewords
  }

  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff) { // surrogate pair
        const c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  /* ---------- bit buffer ---------- */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (val, len) { for (let i = len - 1; i >= 0; i--) this.bits.push((val >> i) & 1); };

  function buildDataCodewords(bytes, v, lvl) {
    const totalData = STRUCT[v][lvl][1].reduce((a, b) => a + b, 0);
    const buf = new BitBuf();
    buf.put(0x4, 4);            // byte mode
    buf.put(bytes.length, 8);   // 8-bit length (v 1–9)
    bytes.forEach(b => buf.put(b, 8));
    const cap = totalData * 8;
    buf.put(0, Math.min(4, cap - buf.bits.length)); // terminator
    while (buf.bits.length % 8) buf.bits.push(0);
    const cw = [];
    for (let i = 0; i < buf.bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | buf.bits[i + j];
      cw.push(b);
    }
    const pads = [0xec, 0x11]; let p = 0;
    while (cw.length < totalData) cw.push(pads[p++ % 2]);
    return cw;
  }

  function interleave(dataCw, v, lvl) {
    const [ecLen, blocks] = STRUCT[v][lvl];
    const dataBlocks = []; let off = 0;
    for (const dlen of blocks) { dataBlocks.push(dataCw.slice(off, off + dlen)); off += dlen; }
    const ecBlocks = dataBlocks.map(b => rsEncode(b, ecLen));
    const out = [];
    const maxD = Math.max(...blocks);
    for (let i = 0; i < maxD; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ecLen; i++) for (const b of ecBlocks) out.push(b[i]);
    return out;
  }

  /* ---------- matrix ---------- */
  function newMatrix(n) { return Array.from({ length: n }, () => new Array(n).fill(null)); }

  function placeFinder(m, x, y) {
    const n = m.length;
    for (let r = -1; r < 8; r++) for (let c = -1; c < 8; c++) {
      const i = y + r, j = x + c;
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const inF = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      m[i][j] = inF && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0;
    }
  }
  function placeAlignment(m, cx, cy) {
    const n = m.length;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const ring = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      m[cy + r][cx + c] = ring ? 1 : 0;
    }
  }

  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i, j) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => (i * j) % 2 + (i * j) % 3 === 0,
    (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0,
    (i, j) => ((i + j) % 2 + (i * j) % 3) % 2 === 0
  ];

  function buildMatrix(bytes, v, lvl, maskIdx) {
    const n = 17 + v * 4;
    const m = newMatrix(n);
    const fn = Array.from({ length: n }, () => new Array(n).fill(false));

    placeFinder(m, 0, 0); placeFinder(m, n - 7, 0); placeFinder(m, 0, n - 7);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      fn[r][c] = fn[r][n - 8 + c] = fn[n - 8 + r][c] = true;
    }
    // timing
    for (let k = 8; k < n - 8; k++) {
      const b = k % 2 === 0 ? 1 : 0;
      if (m[6][k] === null) m[6][k] = b; if (!fn[6][k]) fn[6][k] = true;
      if (m[k][6] === null) m[k][6] = b; if (!fn[k][6]) fn[k][6] = true;
    }
    // alignment
    const ac = ALIGN[v];
    if (ac.length) placeAlignment(m, ac[1], ac[1]);
    if (ac.length) for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) fn[ac[1] + r][ac[1] + c] = true;
    // dark module + format areas reserved (per ISO 18004 placement)
    m[n - 8][8] = 1; fn[n - 8][8] = true;
    for (let i = 0; i <= 5; i++) fn[i][8] = true;
    fn[7][8] = true; fn[8][8] = true;
    for (let i = 8; i < 15; i++) fn[n - 15 + i][8] = true;      // below BL finder
    for (let i = 0; i < 8; i++) fn[8][n - 1 - i] = true;        // right of TR finder
    fn[8][7] = true;
    for (let i = 9; i < 15; i++) fn[8][15 - i - 1] = true;

    // data placement
    const stream = interleave(buildDataCodewords(bytes, v, lvl), v, lvl);
    const bits = [];
    stream.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
    const totalCells = n * n - fn.flat().filter(Boolean).length;
    while (bits.length < totalCells) bits.push(0);

    let idx = 0, dir = -1;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < n; step++) {
        const row = dir === -1 ? n - 1 - step : step;
        for (let c = 0; c < 2; c++) {
          const j = col - c;
          if (fn[row][j]) continue;
          let bit = bits[idx++];
          if (MASKS[maskIdx](row, j)) bit ^= 1;
          m[row][j] = bit;
        }
      }
      dir = -dir;
    }
    return m;
  }

  function formatBits(lvl, maskIdx) {
    const data = (EC_BITS[lvl] << 3) | maskIdx;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
    return ((data << 10) | rem) ^ 0x5412; // 15 bits
  }

  function placeFormat(m, lvl, maskIdx) {
    const n = m.length, bits = formatBits(lvl, maskIdx);
    const bit = i => (bits >> i) & 1; // LSB first, Arase placement
    for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
    m[7][8] = bit(6); m[8][8] = bit(7);
    for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
    for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
    m[8][7] = bit(8);
    for (let i = 9; i < 15; i++) m[8][15 - i - 1] = bit(i);
    m[n - 8][8] = 1; // dark module
  }

  /* ---------- mask penalty (ISO 18004 rules) ---------- */
  function penalty(m) {
    const n = m.length; let score = 0;
    const rows = m, cols = Array.from({ length: n }, (_, j) => m.map(r => r[j]));
    // R1 runs
    for (const line of rows.concat(cols)) {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
    }
    // R2 2x2 blocks
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      if (m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j] && m[i][j] === m[i + 1][j + 1]) score += 3;
    }
    // R3 finder-like patterns
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const patRev = pat.slice().reverse();
    const match = (arr, p, s) => { for (let k = 0; k < 11; k++) if (arr[s + k] !== p[k]) return false; return true; };
    for (const line of rows.concat(cols)) {
      for (let i = 0; i <= n - 11; i++) {
        if (match(line, pat, i) || match(line, patRev, i)) score += 40;
      }
    }
    // R4 dark ratio
    let dark = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) dark += m[i][j];
    const pct = dark * 100 / (n * n);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  /* ---------- public: matrix + svg ---------- */
  function encodeMatrix(text) {
    const bytes = utf8Bytes(text);
    let chosen = null;
    outer:
    for (let v = 1; v <= 4; v++) {
      for (const lvl of ['Q', 'M', 'H', 'L']) {
        if (bytes.length <= capacityOf(v, lvl)) { chosen = { v, lvl }; break outer; }
      }
    }
    if (!chosen) return null;
    let best = null, bestScore = Infinity, bestMask = 0;
    for (let mask = 0; mask < 8; mask++) {
      const m = buildMatrix(bytes, chosen.v, chosen.lvl, mask);
      placeFormat(m, chosen.lvl, mask);
      const s = penalty(m);
      if (s < bestScore) { bestScore = s; best = m; bestMask = mask; }
    }
    return { matrix: best, size: best.length, version: chosen.v, level: chosen.lvl, mask: bestMask };
  }

  function qrSvg(text, px) {
    const enc = encodeMatrix(text);
    if (!enc) return null;
    const n = enc.size, q = 4, cell = Math.max(1, Math.floor(px / (n + q * 2)));
    const dim = (n + q * 2) * cell;
    let rects = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (enc.matrix[i][j]) rects += 'M' + (j + q) * cell + ' ' + (i + q) * cell + 'h' + cell + 'v' + cell + 'h-' + cell + 'z';
    }
    return '<svg class="qr-img" width="' + dim + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code">' +
      '<path d="' + rects + '" fill="#231a10"/></svg>';
  }

  window.KursiQR = { encodeMatrix, qrSvg, capacityOf };
})();
