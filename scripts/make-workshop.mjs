// 공방 모드 1000단계 생성기. 사용: node scripts/make-workshop.mjs  (결과: src/workshop.js)
//
// 사람이 1000단계를 직접 만들고 풀어 볼 수는 없으므로,
//   1) 상자(50단계)마다 판 크기·구슬 수·장애물·목표 최소 수를 정하고 (난이도 곡선)
//   2) 시드로 무작위 판을 만들어 풀이기(너비 우선 탐색)로 최소 수를 구한 뒤
//   3) 목표 최소 수와 정확히 맞는 판만 골라 넣는다.
// 같은 시드는 항상 같은 판을 만들므로, 다시 실행해도 결과가 같다.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { parseLevel, solve } from '../src/engine.js';
import { mulberry32 } from '../src/generator.js';

export const BOX = 50;
// 상자별 설정: 판 크기, 구슬 색 수, 돌·함정·색깔 문 개수(최대), 최소 수 범위 [처음, 끝]
export const TIERS = [
  { boxes: [0, 1], w: 5, h: 5, colors: [1, 2], stone: 0, pit: 0, gate: 0, par: [2, 5] },
  { boxes: [2, 4], w: 6, h: 6, colors: [2, 2], stone: 1, pit: 0, gate: 0, par: [3, 7] },
  { boxes: [5, 7], w: 6, h: 6, colors: [2, 3], stone: 1, pit: 1, gate: 0, par: [5, 9] },
  { boxes: [8, 11], w: 7, h: 7, colors: [3, 3], stone: 1, pit: 1, gate: 0, par: [7, 12] },
  { boxes: [12, 15], w: 7, h: 7, colors: [3, 4], stone: 1, pit: 1, gate: 2, par: [8, 13] },
  { boxes: [16, 19], w: 7, h: 8, colors: [4, 4], stone: 2, pit: 1, gate: 2, par: [10, 15] },
];
const GATE = { r: '1', g: '2', b: '3', y: '4' };
const LETTER = { up: 'U', down: 'D', left: 'L', right: 'R' };

/** i번째(0부터) 단계의 목표 최소 수. 상자 안에서 천천히 오르고, 10단계마다 쉬어 가는 판과 큰 판이 있다 */
export function targetPar(i) {
  const box = Math.floor(i / BOX);
  const k = i % BOX;
  const t = TIERS.find((x) => box >= x.boxes[0] && box <= x.boxes[1]);
  const span = t.boxes[1] - t.boxes[0] + 1;
  const pos = ((box - t.boxes[0]) * BOX + k) / (span * BOX - 1);   // 0~1: 구간 안의 위치
  let p = Math.round(t.par[0] + (t.par[1] - t.par[0]) * pos);
  if (k % 10 === 0 && k > 0) p = Math.max(t.par[0], p - 2);   // 쉬어 가는 판
  if (k === BOX - 1) p = t.par[1];                             // 상자의 마지막 판은 그 구간에서 가장 어렵게
  return p;
}

function makeBoard(rand, t) {
  const { w, h } = t;
  const colors = t.colors[0] + Math.floor(rand() * (t.colors[1] - t.colors[0] + 1));
  const palette = ['r', 'g', 'b', 'y'].slice(0, colors);
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  const free = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) free.push([x, y]);
  const take = () => free.splice(Math.floor(rand() * free.length), 1)[0];
  const walls = Math.floor(w * h * (0.1 + rand() * 0.14));
  for (let i = 0; i < walls; i++) { const [x, y] = take(); grid[y][x] = '#'; }
  for (const c of palette) { let [x, y] = take(); grid[y][x] = c.toUpperCase(); [x, y] = take(); grid[y][x] = c; }
  const stones = Math.floor(rand() * (t.stone + 1));
  for (let i = 0; i < stones; i++) { const [x, y] = take(); grid[y][x] = 'o'; }
  const pits = Math.floor(rand() * (t.pit + 1));
  for (let i = 0; i < pits; i++) { const [x, y] = take(); grid[y][x] = '*'; }
  const gates = t.gate ? 1 + Math.floor(rand() * t.gate) : 0;
  for (let i = 0; i < gates; i++) { const [x, y] = take(); grid[y][x] = GATE[palette[Math.floor(rand() * palette.length)]]; }
  return grid.map((r) => r.join(''));
}

/** 색깔 문이 있는 판은 문이 실제로 풀이에 영향을 줄 때만 쓴다(문을 지우면 더 짧게 풀림) */
function gateMatters(rows, par) {
  const alt = parseLevel(rows.map((s) => s.replace(/[1-4]/g, '.')));
  const r = solve(alt.level, alt.state, { maxDepth: par, maxNodes: 200000 });
  return r.solvable === true && r.moves.length < par;
}

if (!isMainThread) {
  // 작업자: 한 구간(tier)의 시드를 stride 간격으로 훑으며 원하는 최소 수의 판을 보고한다
  const { tierIdx, start, stride, want } = workerData;
  const t = TIERS[tierIdx];
  const need = new Set(want);
  for (let n = start; ; n += stride) {
    const seed = (tierIdx + 1) * 10_000_000 + n;
    const rows = makeBoard(mulberry32(seed), t);
    const { level, state } = parseLevel(rows);
    const r = solve(level, state, { maxDepth: t.par[1] + 1, maxNodes: 300000 });
    if (r.solvable !== true || !need.has(r.moves.length)) continue;
    if (t.gate && !gateMatters(rows, r.moves.length)) continue;
    parentPort.postMessage({ seed, rows, par: r.moves.length, sol: r.moves.map((d) => LETTER[d]).join('') });
  }
} else {
  const total = 20 * BOX;
  const slots = Array.from({ length: total }, (_, i) => targetPar(i));
  const out = new Array(total);
  const used = new Set();
  const nWorkers = Math.max(1, cpus().length);
  const t0 = Date.now();
  for (let ti = 0; ti < TIERS.length; ti++) {
    const t = TIERS[ti];
    const idx = [];
    for (let i = t.boxes[0] * BOX; i < (t.boxes[1] + 1) * BOX; i++) idx.push(i);
    const want = [...new Set(idx.map((i) => slots[i]))];
    const left = new Map();
    for (const i of idx) left.set(slots[i], (left.get(slots[i]) || 0) + 1);
    const buckets = new Map();
    await new Promise((resolve) => {
      const workers = [];
      const done = () => [...left.values()].every((v) => v <= 0);
      for (let k = 0; k < nWorkers; k++) {
        const wk = new Worker(new URL(import.meta.url), { workerData: { tierIdx: ti, start: k, stride: nWorkers, want } });
        wk.on('message', (m) => {
          if (used.has(m.rows.join('/')) || (left.get(m.par) ?? 0) <= 0) return;
          used.add(m.rows.join('/'));
          if (!buckets.has(m.par)) buckets.set(m.par, []);
          buckets.get(m.par).push(m);
          left.set(m.par, left.get(m.par) - 1);
          if (done()) { workers.forEach((x) => x.terminate()); resolve(); }
        });
        workers.push(wk);
      }
    });
    // 같은 최소 수 안에서는 시드 순서대로 배치(실행할 때마다 같은 결과)
    for (const b of buckets.values()) b.sort((a, b2) => a.seed - b2.seed);
    for (const i of idx) out[i] = buckets.get(slots[i]).shift();
    console.log(`구간 ${ti + 1}/${TIERS.length} (상자 ${t.boxes[0] + 1}~${t.boxes[1] + 1}) 완료 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  }
  const lines = out.map((m) => JSON.stringify(`${m.par}|${m.sol}|${m.rows.join('/')}`));
  const src = `// 공방 모드 1000단계 — scripts/make-workshop.mjs가 만든 파일입니다. 직접 고치지 말고 스크립트로 다시 만드세요.
// 한 줄 형식: "최소수|풀이(U·D·L·R)|판(줄을 /로 구분)". 모든 판은 풀이기로 최소 수를 확인했습니다.
export const WORKSHOP_BOX = ${BOX};
const WORKSHOP_RAW = [
${lines.join(',\n')},
];
const WORKSHOP_DIR = { U: 'up', D: 'down', L: 'left', R: 'right' };
export const WORKSHOP = WORKSHOP_RAW.map((s, i) => {
  const [par, sol, rows] = s.split('|');
  return { id: \`W\${i + 1}\`, par: Number(par), solution: [...sol].map((c) => WORKSHOP_DIR[c]), rows: rows.split('/') };
});
`;
  writeFileSync(new URL('../src/workshop.js', import.meta.url), src);
  console.log(`src/workshop.js 저장: ${total}단계 (${(src.length / 1024).toFixed(0)} KB)`);
}
