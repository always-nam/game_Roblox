// 틸트 구슬판 — 순수 게임 로직 (DOM 없음, Node와 브라우저 공용)
//
// 레벨 문자:
//   #  벽            .  바닥
//   r g b y  색 구슬   R G B Y  같은 색 구멍
//   o  돌(굴러가지만 구멍에 빠지지 않음, 함정을 메울 수 있음)
//   *  함정(구슬이 빠지면 실패, 돌이 빠지면 메워져 바닥이 됨)
//   1 2 3 4  색깔 문(빨강·초록·파랑·노랑): 같은 색 구슬만 지나가고, 다른 구슬과 돌에게는 벽

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
export const DIR_NAMES = ['up', 'down', 'left', 'right'];
export const COLORS = ['r', 'g', 'b', 'y'];
export const GATES = { 1: 'r', 2: 'g', 3: 'b', 4: 'y' };

/** 이 조각이 이 칸에 들어갈 수 없는가(벽, 또는 색이 다른 색깔 문) */
export function blocks(c, piece) {
  if (c === '#') return true;
  const gate = GATES[c];
  return gate !== undefined && !(piece.kind === 'marble' && piece.color === gate);
}

export function parseLevel(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cells = [];
  const pieces = [];
  let id = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '#';
      if (COLORS.includes(ch)) {
        cells.push('.');
        pieces.push({ id: id++, kind: 'marble', color: ch, x, y });
      } else if (ch === 'o') {
        cells.push('.');
        pieces.push({ id: id++, kind: 'stone', color: null, x, y });
      } else if (ch === '#' || ch === '.' || ch === '*' || GATES[ch] || COLORS.includes(ch.toLowerCase())) {
        cells.push(ch);
      } else {
        throw new Error(`알 수 없는 레벨 문자 '${ch}' (${x},${y})`);
      }
    }
  }
  const level = { w, h, cells };
  validateLevel(level, pieces);
  return { level, state: { pieces, filled: [], lost: false } };
}

function validateLevel(level, pieces) {
  const marbles = {};
  const holes = {};
  for (const p of pieces) if (p.kind === 'marble') marbles[p.color] = (marbles[p.color] || 0) + 1;
  for (const c of level.cells) if (COLORS.includes(c.toLowerCase()) && c !== c.toLowerCase()) holes[c.toLowerCase()] = (holes[c.toLowerCase()] || 0) + 1;
  for (const c of COLORS) {
    if ((marbles[c] || 0) > (holes[c] || 0)) throw new Error(`'${c}' 구슬 수가 구멍 수보다 많습니다`);
  }
  if (!pieces.some((p) => p.kind === 'marble')) throw new Error('구슬이 없는 레벨입니다');
}

export function cellAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return '#';
  return level.cells[y * level.w + x];
}

export function cloneState(state) {
  return {
    pieces: state.pieces.map((p) => ({ ...p })),
    filled: state.filled.slice(),
    lost: state.lost,
  };
}

/**
 * 판을 한 방향으로 기울인다. 원래 state는 바꾸지 않는다.
 * 반환: { state, moves: [{id, path:[{x,y}...], end:'stop'|'hole'|'pit'|'plug'}], changed }
 */
export function tilt(level, state, dirName) {
  const dir = DIRS[dirName];
  if (!dir) throw new Error(`잘못된 방향: ${dirName}`);
  const next = cloneState(state);
  if (next.lost) return { state: next, moves: [], changed: false };
  const filled = new Set(next.filled);
  const alive = next.pieces.filter((p) => !p.gone);
  const occupied = new Map();
  for (const p of alive) occupied.set(p.y * level.w + p.x, p);
  // 진행 방향 앞쪽에 있는 조각부터 처리해야 뒤 조각이 올바르게 막힌다
  alive.sort((a, b) => (b.x * dir.dx + b.y * dir.dy) - (a.x * dir.dx + a.y * dir.dy));

  const moves = [];
  let changed = false;
  for (const p of alive) {
    const path = [];
    let end = 'stop';
    occupied.delete(p.y * level.w + p.x);
    for (;;) {
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;
      const c = cellAt(level, nx, ny);
      const idx = ny * level.w + nx;
      if (blocks(c, p) || occupied.has(idx)) break;
      p.x = nx;
      p.y = ny;
      path.push({ x: nx, y: ny });
      if (filled.has(idx)) continue;
      if (c === '*') {
        filled.add(idx);
        if (p.kind === 'marble') {
          end = 'pit';
          next.lost = true;
        } else {
          end = 'plug';
        }
        p.gone = true;
        break;
      }
      if (p.kind === 'marble' && c === p.color.toUpperCase()) {
        filled.add(idx);
        p.gone = true;
        end = 'hole';
        break;
      }
    }
    if (!p.gone) occupied.set(p.y * level.w + p.x, p);
    if (path.length) {
      changed = true;
      moves.push({ id: p.id, path, end });
    }
  }
  next.filled = [...filled].sort((a, b) => a - b);
  return { state: next, moves, changed };
}

export function status(state) {
  if (state.lost) return 'lost';
  return state.pieces.some((p) => p.kind === 'marble' && !p.gone) ? 'playing' : 'won';
}

export function stateKey(state) {
  const parts = state.pieces
    .filter((p) => !p.gone)
    .map((p) => `${p.kind === 'stone' ? 'o' : p.color}${p.x},${p.y}`)
    .sort();
  return parts.join(';') + '|' + state.filled.join(',');
}

/**
 * 너비 우선 탐색으로 최소 기울임 수를 찾는다.
 * 반환: { solvable, moves: [...방향], explored } — 한도 초과 시 solvable:null
 */
export function solve(level, state, { maxDepth = 40, maxNodes = 300000 } = {}) {
  if (status(state) === 'won') return { solvable: true, moves: [], explored: 1 };
  const seen = new Set([stateKey(state)]);
  let frontier = [{ state, path: [] }];
  let explored = 1;
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const nextFrontier = [];
    for (const node of frontier) {
      for (const d of DIR_NAMES) {
        const r = tilt(level, node.state, d);
        if (!r.changed) continue;
        const st = status(r.state);
        if (st === 'lost') continue;
        const path = node.path.concat(d);
        if (st === 'won') return { solvable: true, moves: path, explored };
        const key = stateKey(r.state);
        if (seen.has(key)) continue;
        seen.add(key);
        explored++;
        if (explored > maxNodes) return { solvable: null, moves: null, explored };
        nextFrontier.push({ state: r.state, path });
      }
    }
    frontier = nextFrontier;
  }
  return { solvable: frontier.length ? null : false, moves: null, explored };
}

/** 이동 수와 최소 이동 수로 별(1~3)을 계산한다 */
export function starsFor(moves, par) {
  if (moves <= par) return 3;
  if (moves <= par + Math.max(2, Math.ceil(par * 0.3))) return 2;
  return 1;
}
