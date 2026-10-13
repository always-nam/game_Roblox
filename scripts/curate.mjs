// 레벨 큐레이션 보조 스크립트: 조건에 맞는 퍼즐을 시드 탐색으로 찾는다.
// 사용: node scripts/curate.mjs <size> <colors> <minPar> <maxPar> <stone 0/1> <pit 0/1> <needStone 0/1> [startSeed]
import { parseLevel, solve } from '../src/engine.js';
import { mulberry32 } from '../src/generator.js';
const [size, colors, minPar, maxPar, stone, pit, needStone, start = 1] = process.argv.slice(2).map(Number);
const palette = ['r', 'g', 'b', 'y'].slice(0, colors);
let found = 0;
for (let seed = start; seed < start + 20000 && found < 4; seed++) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: size }, () => Array(size).fill('.'));
  const free = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) free.push([x, y]);
  const take = () => free.splice(Math.floor(rand() * free.length), 1)[0];
  const walls = Math.floor(size * size * (0.1 + rand() * 0.12));
  for (let i = 0; i < walls; i++) { const [x, y] = take(); grid[y][x] = '#'; }
  for (const c of palette) { let [x, y] = take(); grid[y][x] = c.toUpperCase(); [x, y] = take(); grid[y][x] = c; }
  if (stone) { const [x, y] = take(); grid[y][x] = 'o'; }
  if (pit) { const [x, y] = take(); grid[y][x] = '*'; }
  const rows = grid.map((r) => r.join(''));
  const { level, state } = parseLevel(rows);
  const r = solve(level, state, { maxDepth: maxPar, maxNodes: 200000 });
  if (!r.solvable || r.moves.length < minPar) continue;
  if (needStone) {
    const alt = parseLevel(rows.map((s) => s.replace('o', '.')));
    const r2 = solve(alt.level, alt.state, { maxDepth: 40, maxNodes: 200000 });
    if (r2.solvable) continue;
  }
  if (pit && !needStone) {
    // 함정이 실제로 방해가 되는지: 함정을 바닥으로 바꾸면 더 짧게 풀려야 한다
    const alt = parseLevel(rows.map((s) => s.replace('*', '.')));
    const r2 = solve(alt.level, alt.state, { maxDepth: 40, maxNodes: 200000 });
    if (!r2.solvable || r2.moves.length >= r.moves.length) continue;
  }
  found++;
  console.log(`seed ${seed} par ${r.moves.length} ${r.moves.join(' ')}`);
  console.log(rows.map((s) => `    '${s}',`).join('\n'));
}
