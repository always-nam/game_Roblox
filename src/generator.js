// 시드 기반 퍼즐 생성기 — 오늘의 퍼즐에 사용. 같은 시드는 항상 같은 퍼즐을 만든다.
import { parseLevel, solve } from './engine.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateSeed(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function candidate(rand, size, colors, opts) {
  const grid = Array.from({ length: size }, () => Array(size).fill('.'));
  const free = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) free.push([x, y]);
  const take = () => free.splice(Math.floor(rand() * free.length), 1)[0];
  const walls = Math.floor(size * size * (0.12 + rand() * 0.1));
  for (let i = 0; i < walls; i++) {
    const [x, y] = take();
    grid[y][x] = '#';
  }
  for (const c of colors) {
    const [hx, hy] = take();
    grid[hy][hx] = c.toUpperCase();
    const [mx, my] = take();
    grid[my][mx] = c;
  }
  if (opts.stone) {
    const [x, y] = take();
    grid[y][x] = 'o';
  }
  if (opts.pit) {
    const [x, y] = take();
    grid[y][x] = '*';
  }
  return grid.map((r) => r.join(''));
}

/**
 * 풀 수 있고 최소 이동 수가 [minPar, maxPar] 범위인 퍼즐을 만든다.
 * 반환: { rows, par, solution, seed, attempts }
 */
export function generatePuzzle(seed, { size = 6, colors = 3, minPar = 6, maxPar = 14, maxAttempts = 400 } = {}) {
  const rand = mulberry32(seed);
  const palette = ['r', 'g', 'b', 'y'].slice(0, colors);
  let best = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = candidate(rand, size, palette, { stone: rand() < 0.6, pit: rand() < 0.4 });
    const { level, state } = parseLevel(rows);
    const res = solve(level, state, { maxDepth: maxPar, maxNodes: 60000 });
    if (!res.solvable) continue;
    const par = res.moves.length;
    if (par >= minPar) return { rows, par, solution: res.moves, seed, attempts: attempt };
    if (!best || par > best.par) best = { rows, par, solution: res.moves, seed, attempts: attempt };
  }
  return best;
}
