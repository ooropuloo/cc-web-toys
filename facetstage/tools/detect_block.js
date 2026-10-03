/* ---------- 自動偵測面：照片 → 平面多邊形 ----------
// ROOT = this project's folder (the parent of tools/)
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');

   同一個平面受光一致、顏色平滑；兩個面交界（折線）會有明暗跳變。
   流程：縮圖 → Lab → 保邊平滑 → 梯度 → SLIC 超像素 → 依「共用邊界的平均梯度」由弱到強合併
   → 清掉碎塊 → 外輪廓追蹤 → Douglas–Peucker 簡化成 3–8 點 → 相鄰面的角點吸附成同一點。 */
const yieldUI = () => new Promise(r => setTimeout(r, 0));
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

async function detectFacets(src, detail = 5, prog = () => {}, outRes = S.res) {
  const t0 = performance.now();
  const im = await loadImg(src);
  const LONG = 360, k = LONG / Math.max(im.naturalWidth, im.naturalHeight);
  const w = Math.max(24, Math.round(im.naturalWidth * k)), h = Math.max(24, Math.round(im.naturalHeight * k)), N = w * h;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data;
  prog('轉換色彩…'); await yieldUI();
  // sRGB → CIELab
  let L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  for (let i = 0; i < N; i++) {
    const r = lin[px[i * 4]], g = lin[px[i * 4 + 1]], b = lin[px[i * 4 + 2]];
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089;
    const fx = f(X), fy = f(Y), fz = f(Z);
    L[i] = 116 * fy - 16; A[i] = 500 * (fx - fy); B[i] = 200 * (fy - fz);
  }
  // 保邊平滑（簡化雙邊濾波，權重查表）兩輪
  const SIGC = 7, LUT = new Float32Array(1200);
  for (let i = 0; i < LUT.length; i++) LUT[i] = Math.exp(-(i / 4) / (2 * SIGC * SIGC));
  const SP = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) SP.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / 4.5)]);
  for (let pass = 0; pass < 2; pass++) {
    prog(`平滑雜訊（${pass + 1}/2）…`); await yieldUI();
    const L2 = new Float32Array(N), A2 = new Float32Array(N), B2 = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let sw = 0, sl = 0, sa = 0, sb = 0;
      for (const [dx, dy, ws] of SP) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx, dl = L[j] - L[i], da = A[j] - A[i], db = B[j] - B[i];
        const wt = ws * LUT[Math.min(1199, Math.round((dl * dl + da * da + db * db) * 4))];
        sw += wt; sl += wt * L[j]; sa += wt * A[j]; sb += wt * B[j];
      }
      L2[i] = sl / sw; A2[i] = sa / sw; B2[i] = sb / sw;
    }
    L = L2; A = A2; B = B2;
  }
  // 梯度強度（Sobel，三通道）
  const G = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let s = 0;
    for (const C of [L, A, B]) {
      const gx = (C[i - w + 1] + 2 * C[i + 1] + C[i + w + 1] - C[i - w - 1] - 2 * C[i - 1] - C[i + w - 1]) / 8;
      const gy = (C[i + w - 1] + 2 * C[i + w] + C[i + w + 1] - C[i - w - 1] - 2 * C[i - w] - C[i - w + 1]) / 8;
      s += gx * gx + gy * gy;
    }
    G[i] = Math.sqrt(s);
  }
  // SLIC 超像素
  prog('切超像素…'); await yieldUI();
  const K = 450, Sg = Math.max(4, Math.round(Math.sqrt(N / K))), M = 9;
  const ctr = [];
  for (let y = Sg >> 1; y < h; y += Sg) for (let x = Sg >> 1; x < w; x += Sg) {
    let bx = x, by = y, bg = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.min(w - 2, Math.max(1, x + dx)), yy = Math.min(h - 2, Math.max(1, y + dy)); if (G[yy * w + xx] < bg) { bg = G[yy * w + xx]; bx = xx; by = yy; } }
    const j = by * w + bx; ctr.push([L[j], A[j], B[j], bx, by]);
  }
  const lab = new Int32Array(N).fill(-1), dist = new Float32Array(N);
  const wS = (M / Sg) * (M / Sg);
  for (let it = 0; it < 6; it++) {
    dist.fill(Infinity);
    ctr.forEach((c, ci) => {
      const x0 = Math.max(0, Math.round(c[3] - 2 * Sg)), x1 = Math.min(w - 1, Math.round(c[3] + 2 * Sg));
      const y0 = Math.max(0, Math.round(c[4] - 2 * Sg)), y1 = Math.min(h - 1, Math.round(c[4] + 2 * Sg));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x, dl = L[i] - c[0], da = A[i] - c[1], db = B[i] - c[2], dx = x - c[3], dy = y - c[4];
        const d = dl * dl + da * da + db * db + (dx * dx + dy * dy) * wS;
        if (d < dist[i]) { dist[i] = d; lab[i] = ci; }
      }
    });
    const acc = ctr.map(() => [0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < N; i++) { const a = acc[lab[i]]; a[0] += L[i]; a[1] += A[i]; a[2] += B[i]; a[3] += i % w; a[4] += (i / w) | 0; a[5]++; }
    acc.forEach((a, ci) => { if (a[5]) ctr[ci] = [a[0] / a[5], a[1] / a[5], a[2] / a[5], a[3] / a[5], a[4] / a[5]]; });
    if (it % 2) await yieldUI();
  }
  // 連通性：每個連通塊一個新編號，太小的塊併給鄰居
  const reg = new Int32Array(N).fill(-1), stack = new Int32Array(N);
  let nReg = 0; const minSP = (Sg * Sg) >> 2, size = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (reg[s0] >= 0) continue;
    let adj = -1; const x0 = s0 % w, y0 = (s0 / w) | 0;
    if (x0 > 0 && reg[s0 - 1] >= 0) adj = reg[s0 - 1]; else if (y0 > 0 && reg[s0 - w] >= 0) adj = reg[s0 - w];
    let sp = 0, cnt = 0; stack[sp++] = s0; reg[s0] = nReg; const members = [];
    while (sp) {
      const i = stack[--sp]; members.push(i); cnt++;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && reg[i - 1] < 0 && lab[i - 1] === lab[i]) { reg[i - 1] = nReg; stack[sp++] = i - 1; }
      if (x < w - 1 && reg[i + 1] < 0 && lab[i + 1] === lab[i]) { reg[i + 1] = nReg; stack[sp++] = i + 1; }
      if (y > 0 && reg[i - w] < 0 && lab[i - w] === lab[i]) { reg[i - w] = nReg; stack[sp++] = i - w; }
      if (y < h - 1 && reg[i + w] < 0 && lab[i + w] === lab[i]) { reg[i + w] = nReg; stack[sp++] = i + w; }
    }
    if (cnt < minSP && adj >= 0) { for (const i of members) reg[i] = adj; size[adj] += cnt; }
    else { size[nReg] = cnt; nReg++; }
  }
  prog(`合併相似區塊（${nReg} 塊）…`); await yieldUI();
  // 區域鄰接圖：每條共用邊界累積兩側梯度
  const R = [];
  for (let r = 0; r < nReg; r++) R.push({ n: 0, l: 0, a: 0, b: 0, nb: new Map() });
  for (let i = 0; i < N; i++) { const r = R[reg[i]]; r.n++; r.l += L[i]; r.a += A[i]; r.b += B[i]; }
  const addEdge = (p, q) => {
    const a = reg[p], b = reg[q]; if (a === b) return;
    const g = Math.max(G[p], G[q]);
    let e = R[a].nb.get(b); if (!e) { e = { s: 0, c: 0 }; R[a].nb.set(b, e); R[b].nb.set(a, e); }
    e.s += g; e.c++;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x < w - 1) addEdge(i, i + 1); if (y < h - 1) addEdge(i, i + w); }
  const parent = new Int32Array(nReg).map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const alive = new Set(R.map((_, i) => i));
  const meanDiff = (a, b) => { const A1 = R[a], B1 = R[b]; return Math.hypot(A1.l / A1.n - B1.l / B1.n, A1.a / A1.n - B1.a / B1.n, A1.b / A1.n - B1.b / B1.n); };
  // 成本：邊界平均梯度為主，區域平均色差為輔（平面上的光線漸層只會讓色差緩慢變化）
  const cost = (a, b, e) => e.s / e.c + 0.12 * meanDiff(a, b);
  const merge = (a, b) => {
    const ra = R[a], rb = R[b];
    ra.n += rb.n; ra.l += rb.l; ra.a += rb.a; ra.b += rb.b;
    for (const [x, e] of rb.nb) {
      if (x === a) continue;
      const rx = R[x]; rx.nb.delete(b);
      const ea = ra.nb.get(x);
      if (ea) { ea.s += e.s; ea.c += e.c; } else { ra.nb.set(x, e); rx.nb.set(a, e); }
    }
    ra.nb.delete(b); rb.nb.clear(); parent[b] = a; alive.delete(b);
  };
  const T = 2.6 * Math.pow(0.82, detail - 5);           // 細緻度越高，門檻越低 → 面越多
  const minArea = N * 0.006 * Math.pow(0.8, detail - 5);
  const minEdge = (filter) => {
    let best = null, bc = Infinity;
    for (const a of alive) {
      if (filter && !filter(a)) continue;
      for (const [b, e] of R[a].nb) { if (b < a && !filter) continue; const c = cost(a, b, e); if (c < bc) { bc = c; best = [a, b]; } }
    }
    return [best, bc];
  };
  let guard = 0;
  while (guard++ < nReg) {
    const [best, bc] = minEdge(null); if (!best || bc > T) break;
    merge(best[0], best[1]);
    if (guard % 60 === 0) { prog(`合併相似區塊（剩 ${alive.size} 塊）…`); await yieldUI(); }
  }
  // 碎塊併入最像的鄰居
  guard = 0;
  while (guard++ < nReg) {
    const [best] = minEdge(a => R[a].n < minArea && R[a].nb.size > 0); if (!best) break;
    merge(best[1], best[0]);
  }
  prog('描出多邊形…'); await yieldUI();
  const final = new Int32Array(N); for (let i = 0; i < N; i++) final[i] = find(reg[i]);
  const sx = outRes[0] / w, sy = outRes[1] / h;
  const polys = [];
  for (const r of alive) {
    if (R[r].n < minArea) continue;
    if (R[r].n > N * 0.85) continue;             // 整張照片幾乎同一塊：不是面
    const poly = traceRegion(final, w, h, r);
    if (!poly) continue;
    const area = Math.abs(polyArea(poly)), hull = Math.abs(polyArea(convexHull(poly)));
    if (hull <= 0 || area / hull < 0.72) continue; // 形狀太破碎（人影、雜物、植物）不當成平面
    const simp = simplifyClosed(poly, Math.sqrt(R[r].n) * 0.06, 8);
    if (simp.length >= 3) polys.push(simp.map(p => [p[0] * sx, p[1] * sy]));
  }
  const snapped = snapPolys(polys, Math.min(outRes[0], outRes[1]) * 0.028, outRes);
  return { polys: snapped, ms: Math.round(performance.now() - t0), w, h, superpixels: nReg, regions: alive.size };
}
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function convexHull(pts) {
  const P = pts.map(p => p.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// Moore 鄰域外輪廓追蹤（回傳像素中心座標，順時針）
function traceRegion(lbl, w, h, r) {
  let s = -1; for (let i = 0; i < lbl.length; i++) if (lbl[i] === r) { s = i; break; }
  if (s < 0) return null;
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1];
  const inR = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lbl[y * w + x] === r;
  const sx = s % w, sy = (s / w) | 0;
  let x = sx, y = sy, back = 0; const pts = [[x + 0.5, y + 0.5]];
  let firstMove = -1;
  for (let it = 0; it < 4 * lbl.length; it++) {
    let found = -1;
    for (let i = 1; i <= 8; i++) { const d = (back + i) % 8; if (inR(x + DX[d], y + DY[d])) { found = d; break; } }
    if (found < 0) return null;
    const prev = (found + 7) % 8, nx = x + DX[found], ny = y + DY[found];
    const bx = x + DX[prev] - nx, by = y + DY[prev] - ny;
    let nb = 0; for (let d = 0; d < 8; d++) if (DX[d] === bx && DY[d] === by) { nb = d; break; }
    if (x === sx && y === sy) { if (firstMove < 0) firstMove = found; else if (found === firstMove) break; }
    x = nx; y = ny; back = nb;
    pts.push([x + 0.5, y + 0.5]);
  }
  pts.pop();
  return pts.length >= 3 ? pts : null;
}
function dpOpen(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let md = -1, mi = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len; if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [a, b];
  const l = dpOpen(pts.slice(0, mi + 1), eps), r = dpOpen(pts.slice(mi), eps);
  return l.slice(0, -1).concat(r);
}
function simplifyClosed(pts, eps, maxV) {
  // 從離起點最遠的點切成兩段，各自做 Douglas–Peucker；點數太多就放寬門檻
  let far = 0, fd = -1; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  let out = [];
  for (let e = Math.max(1, eps), k = 0; k < 20; k++, e *= 1.25) {
    const A1 = dpOpen(pts.slice(0, far + 1), e), B1 = dpOpen(pts.slice(far).concat([pts[0]]), e);
    out = A1.slice(0, -1).concat(B1.slice(0, -1));
    // 去掉幾乎共線的點
    out = out.filter((p, i) => { const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length]; const cr = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); return cr > e * 0.5; });
    if (out.length <= maxV) break;
  }
  return out;
}
// 相鄰面的角點吸附成同一個座標（編輯器把重疊的點當成同一個頂點一起拖），貼近邊框的點貼齊邊框
function snapPolys(polys, rad, res) {
  const cl = [];
  for (const P of polys) for (const p of P) {
    let best = null, bd = rad;
    for (const c of cl) { const d = Math.hypot(c.x - p[0], c.y - p[1]); if (d < bd) { bd = d; best = c; } }
    if (best) { best.sx += p[0]; best.sy += p[1]; best.n++; best.x = best.sx / best.n; best.y = best.sy / best.n; best.m.push(p); }
    else cl.push({ x: p[0], y: p[1], sx: p[0], sy: p[1], n: 1, m: [p] });
  }
  for (const c of cl) {
    let x = Math.round(c.x), y = Math.round(c.y);
    if (x < rad) x = 0; if (y < rad) y = 0; if (x > res[0] - rad) x = res[0]; if (y > res[1] - rad) y = res[1];
    for (const p of c.m) { p[0] = x; p[1] = y; }
  }
  return polys.map(P => P.filter((p, i) => { const q = P[(i + 1) % P.length]; return !(p[0] === q[0] && p[1] === q[1]); }))
    .filter(P => P.length >= 3 && Math.abs(polyArea(P)) > rad * rad);
}
