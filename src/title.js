// 시작 화면의 움직이는 시연 판: 실제 게임 규칙(engine)과 구르기 연출(anim)로 퍼즐을 스스로 푼다.
// 판이 기울어지는 방향으로 3D로 기울고, 다 풀면 잠시 쉬었다가 처음부터 다시 보여 준다.
import { parseLevel, tilt, solve, GATES } from './engine.js';
import { rollKeyframes } from './anim.js';

export function createTitleDemo({ board, frame, rows }) {
  let timer = 0;
  let running = false;
  let level = null;
  let state = null;
  let start = null;
  let solution = [];
  let step = 0;
  let cell = 40;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function build() {
    const parsed = parseLevel(rows);
    level = parsed.level;
    start = parsed.state;
    if (!solution.length) solution = solve(level, start, { maxDepth: 30, maxNodes: 200000 }).moves || [];
    state = start;
    step = 0;
    board.textContent = '';
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const c = level.cells[y * level.w + x];
        if (c === '.') continue;
        const el = document.createElement('div');
        el.className = 'cell';
        if (c === '#') el.classList.add('wall');
        else if (c === '*') el.classList.add('pit');
        else if (GATES[c]) el.classList.add('gate', `c-${GATES[c]}`);
        else el.classList.add('hole', `c-${c.toLowerCase()}`);
        el.dataset.idx = String(y * level.w + x);
        el.style.left = `calc(${x} * var(--cell))`;
        el.style.top = `calc(${y} * var(--cell))`;
        board.append(el);
      }
    }
    for (const p of state.pieces) {
      const el = document.createElement('div');
      el.className = `piece ${p.kind}` + (p.color ? ` c-${p.color}` : '');
      el.dataset.id = String(p.id);
      el.style.setProperty('--x', p.x);
      el.style.setProperty('--y', p.y);
      if (p.kind === 'marble') { const b = document.createElement('span'); b.className = 'ball'; el.append(b); }
      board.append(el);
    }
    layout();
  }

  function layout() {
    if (!level) return;
    const box = frame.parentElement;
    const avail = Math.min(box.clientWidth, box.clientHeight) - 20;
    cell = Math.max(14, Math.floor(avail / Math.max(level.w, level.h)));
    frame.style.setProperty('--cell', `${cell}px`);
    board.style.width = `${cell * level.w}px`;
    board.style.height = `${cell * level.h}px`;
  }

  function next() {
    if (!running) return;
    if (step >= solution.length) {
      timer = setTimeout(() => { if (running) { build(); timer = setTimeout(next, 900); } }, 2200);
      return;
    }
    const dir = solution[step++];
    const r = tilt(level, state, dir);
    const before = state;
    state = r.state;
    frame.dataset.tilt = dir;
    let longest = 0;
    for (const m of r.moves) {
      const el = board.querySelector(`.piece[data-id="${m.id}"]`);
      const prev = before.pieces.find((p) => p.id === m.id);
      const last = m.path[m.path.length - 1];
      const skin = { x: Number(el.dataset.sx) || 0, y: Number(el.dataset.sy) || 0 };
      const k = rollKeyframes({ from: prev, to: last, cell, end: m.end, kind: prev.kind, skin, calm: reduced() });
      const dur = k.duration;
      el.style.setProperty('--x', last.x);
      el.style.setProperty('--y', last.y);
      el.animate?.(k.frames, { duration: dur });
      const ball = el.querySelector('.ball');
      if (ball && k.skinFrames) {
        ball.animate?.(k.skinFrames, { duration: dur });
        el.dataset.sx = String(k.skinEnd.x);
        el.dataset.sy = String(k.skinEnd.y);
        ball.style.backgroundPosition = `${k.skinEnd.x}px ${k.skinEnd.y}px`;
      }
      if (m.end !== 'stop') {
        setTimeout(() => {
          el.classList.add(m.end === 'hole' ? 'sink' : 'drop');
          if (m.end === 'hole' || m.end === 'plug') board.querySelector(`.cell[data-idx="${last.y * level.w + last.x}"]`)?.classList.add('filled');
        }, dur);
      }
      longest = Math.max(longest, dur + (m.end === 'stop' ? 0 : 320));
    }
    timer = setTimeout(() => { delete frame.dataset.tilt; timer = setTimeout(next, 520); }, longest + 60);
  }

  return {
    start() {
      if (running) return;
      running = true;
      build();
      timer = setTimeout(next, 1600);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      delete frame.dataset.tilt;
    },
    layout,
    get running() { return running; },
    get steps() { return solution.length; },
  };
}
