// 레벨 탐색 도구(색깔 문 포함). 사용:
//   node scripts/curate2.mjs '<JSON 옵션>'
//   옵션: {name, size|width,height, colors, minPar, maxPar, stone, pit, gates, needGate, needStone, start, count, timeMs}
import { parseLevel, solve } from '../src/engine.js';
import { mulberry32 } from '../src/generator.js';

const o = { size: 7, colors: 3, minPar: 10, maxPar: 14, stone: 0, pit: 0, gates: 0, needGate: 0, needStone: 0,
  start: 1, count: 1, wallMin: 0.1, wallMax: 0.22, maxNodes: 400000, ...JSON.parse(process.argv[2] || '{}') };
const palette = ['r', 'g', 'b', 'y'].slice(0, o.colors);
const GATE = { r: '1', g: '2', b: '3', y: '4' };
const w = o.width || o.size, h = o.height || o.size;
let found = 0;
const t0 = Date.now();
for (let seed = o.start; found < o.count && Date.now() - t0 < (o.timeMs || 280000); seed++) {
  const rand = mulberry32(seed * 7919 + o.colors * 31 + o.gates);
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  const free = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) free.push([x, y]);
  const take = () => free.splice(Math.floor(rand() * free.length), 1)[0];
  const walls = Math.floor(w * h * (o.wallMin + rand() * (o.wallMax - o.wallMin)));
  for (let i = 0; i < walls; i++) { const [x, y] = take(); grid[y][x] = '#'; }
  for (const c of palette) { let [x, y] = take(); grid[y][x] = c.toUpperCase(); [x, y] = take(); grid[y][x] = c; }
  for (let i = 0; i < o.stone; i++) { const [x, y] = take(); grid[y][x] = 'o'; }
  for (let i = 0; i < o.pit; i++) { const [x, y] = take(); grid[y][x] = '*'; }
  for (let i = 0; i < o.gates; i++) { const [x, y] = take(); grid[y][x] = GATE[palette[Math.floor(rand() * palette.length)]]; }
  const rows = grid.map((r) => r.join(''));
  const { level, state } = parseLevel(rows);
  const r = solve(level, state, { maxDepth: o.maxPar, maxNodes: o.maxNodes });
  if (!r.solvable || r.moves.length < o.minPar) continue;
  if (o.needGate) {   // 문이 실제로 퍼즐에 영향을 준다: 문을 바닥으로 바꾸면 더 짧게 풀림
    const alt = parseLevel(rows.map((s) => s.replace(/[1-4]/g, '.')));
    const r2 = solve(alt.level, alt.state, { maxDepth: o.maxPar, maxNodes: o.maxNodes });
    if (r2.solvable && r2.moves.length >= r.moves.length) continue;
  }
  if (o.needStone) {
    const alt = parseLevel(rows.map((s) => s.replace('o', '.')));
    const r2 = solve(alt.level, alt.state, { maxDepth: 40, maxNodes: o.maxNodes });
    if (r2.solvable) continue;
  }
  found++;
  console.log(JSON.stringify({ name: o.name, seed, par: r.moves.length, rows, solution: r.moves.join(' ') }));
}
if (!found) console.log(JSON.stringify({ name: o.name, error: 'not found' }));
