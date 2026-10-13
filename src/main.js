// 틸트 구슬판 — 화면과 입력 처리
import { parseLevel, tilt, status, starsFor, cloneState } from './engine.js';
import { LEVELS } from './levels.js';
import { generatePuzzle, dateSeed } from './generator.js';

const $ = (sel) => document.querySelector(sel);
const STORE_KEY = 'tilt-marble-v1';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const STEP_MS = reducedMotion ? 0 : 55;
const BASE_MS = reducedMotion ? 0 : 70;
const SINK_MS = reducedMotion ? 0 : 230;

// ---------- 저장 (브라우저 저장소가 막혀 있어도 게임은 동작) ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { best: data.best || {}, daily: data.daily || {}, last: data.last || 0 };
  } catch {
    return { best: {}, daily: {}, last: 0 };
  }
}
function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* 저장 불가 환경 */ }
}
const progress = loadProgress();

// ---------- 게임 상태 ----------
const game = {
  def: null,        // { key, label, name, hint, par, rows }
  level: null,
  initial: null,
  state: null,
  history: [],
  moves: 0,
  animating: false,
  queued: null,
  ended: false,
};

let daily = null;
function getDaily() {
  const seed = dateSeed();
  if (!daily || daily.seed !== seed) {
    const p = generatePuzzle(seed);
    const d = String(seed);
    daily = {
      seed,
      key: `daily-${seed}`,
      label: `오늘의 퍼즐 ${d.slice(4, 6)}.${d.slice(6)}`,
      name: '오늘의 퍼즐',
      hint: '매일 바뀌는 자동 생성 퍼즐입니다. 모든 퍼즐은 풀이가 있는지 미리 검증됩니다.',
      par: p.par,
      rows: p.rows,
    };
  }
  return daily;
}

function levelDef(index) {
  const lv = LEVELS[index];
  return { key: String(index), index, label: `${index + 1}단계`, name: lv.name, hint: lv.hint || '', par: lv.par, rows: lv.rows };
}

function bestFor(def) {
  return def.key.startsWith('daily-') ? progress.daily[def.seed ?? def.key.slice(6)] : progress.best[def.key];
}

function unlockedCount() {
  let n = 1;
  while (n < LEVELS.length && progress.best[String(n - 1)] != null) n++;
  return n;
}

// ---------- 메뉴 ----------
function renderMenu() {
  const grid = $('#level-grid');
  grid.textContent = '';
  const unlocked = unlockedCount();
  let total = 0;
  LEVELS.forEach((lv, i) => {
    const best = progress.best[String(i)];
    const stars = best != null ? starsFor(best, lv.par) : 0;
    total += stars;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level-btn' + (i === unlocked - 1 && best == null ? ' current' : '');
    b.disabled = i >= unlocked;
    b.dataset.level = String(i);
    b.setAttribute('aria-label', `${i + 1}단계 ${lv.name}${b.disabled ? ' (잠김)' : best != null ? `, 별 ${stars}개` : ''}`);
    b.innerHTML = `<span class="n">${i + 1}</span><span class="s">${best != null ? [1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">●</i>`).join('') : ''}</span>`;
    b.addEventListener('click', () => startLevel(levelDef(i)));
    li.append(b);
    grid.append(li);
  });
  $('#star-total').textContent = `★ ${total} / ${LEVELS.length * 3}`;
  const next = Math.min(unlocked - 1, LEVELS.length - 1);
  $('#btn-continue').textContent = progress.best['0'] == null ? '시작하기' : `이어서 하기 · ${next + 1}단계`;
  $('#btn-continue').onclick = () => startLevel(levelDef(next));
  const d = getDaily();
  const dBest = progress.daily[d.seed];
  $('#daily-label').textContent = dBest != null ? `완료 ${dBest}수` : `최소 ${d.par}수`;
}

function showScreen(name) {
  $('#menu').hidden = name !== 'menu';
  $('#game').hidden = name !== 'game';
  if (name === 'menu') renderMenu();
  else layoutBoard();
}

// ---------- 퍼즐판 그리기 ----------
function startLevel(def) {
  const { level, state } = parseLevel(def.rows);
  Object.assign(game, { def, level, initial: state, state: cloneState(state), history: [], moves: 0, animating: false, queued: null, ended: false });
  if (def.index != null) { progress.last = def.index; saveProgress(); }
  hideOverlay();
  $('#hud-num').textContent = def.label;
  $('#hud-name').textContent = def.name;
  $('#hud-par').textContent = String(def.par);
  buildBoard();
  showScreen('game');
  updateHud();
}

function buildBoard() {
  const board = $('#board');
  board.textContent = '';
  const { level } = game;
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const c = level.cells[y * level.w + x];
      if (c === '.') continue;
      const el = document.createElement('div');
      el.className = 'cell';
      if (c === '#') el.classList.add('wall');
      else if (c === '*') el.classList.add('pit');
      else el.classList.add('hole', `c-${c.toLowerCase()}`);
      el.dataset.idx = String(y * level.w + x);
      el.style.left = `calc(${x} * var(--cell))`;
      el.style.top = `calc(${y} * var(--cell))`;
      board.append(el);
    }
  }
  for (const p of game.state.pieces) {
    const el = document.createElement('div');
    el.className = `piece ${p.kind}` + (p.color ? ` c-${p.color}` : '');
    el.dataset.id = String(p.id);
    board.append(el);
  }
  syncPieces(true);
}

function syncPieces(instant) {
  const board = $('#board');
  const filled = new Set(game.state.filled);
  board.querySelectorAll('.cell').forEach((el) => el.classList.toggle('filled', filled.has(Number(el.dataset.idx))));
  for (const p of game.state.pieces) {
    const el = board.querySelector(`.piece[data-id="${p.id}"]`);
    if (instant) el.style.transitionDuration = '0ms';
    el.style.setProperty('--x', p.x);
    el.style.setProperty('--y', p.y);
    el.classList.remove('sink', 'drop');
    el.hidden = !!p.gone;
  }
}

function layoutBoard() {
  if (!game.level || $('#game').hidden) return;
  const area = $('#board-area');
  const pad = 20; // 테두리 두께 × 2
  const availW = area.clientWidth - pad;
  const availH = area.clientHeight - pad;
  const cell = Math.max(24, Math.floor(Math.min(availW / game.level.w, availH / game.level.h, 72)));
  const root = $('#app');
  root.style.setProperty('--cell', `${cell}px`);
  const board = $('#board');
  board.style.width = `${cell * game.level.w}px`;
  board.style.height = `${cell * game.level.h}px`;
}

function updateHud() {
  $('#hud-moves').textContent = String(game.moves);
  $('#btn-undo').disabled = game.history.length === 0;
  const best = bestFor(game.def);
  $('#hint').textContent = game.def.hint || (best != null ? `최고 기록 ${best}수` : `최소 ${game.def.par}수로 풀 수 있습니다.`);
}

// ---------- 조작 ----------
function doTilt(dir) {
  if (game.ended || $('#game').hidden) return;
  if (game.animating) { game.queued = dir; return; }
  const r = tilt(game.level, game.state, dir);
  const frame = $('#frame');
  if (!r.changed) {
    frame.classList.remove('shake');
    void frame.offsetWidth;
    frame.classList.add('shake');
    return;
  }
  game.history.push(game.state);
  game.state = r.state;
  game.moves++;
  updateHud();
  animateMoves(r.moves, dir);
}

function animateMoves(moves, dir) {
  const board = $('#board');
  const frame = $('#frame');
  frame.className = `frame tilt-${dir}`;
  game.animating = true;
  let longest = 0;
  for (const m of moves) {
    const el = board.querySelector(`.piece[data-id="${m.id}"]`);
    const last = m.path[m.path.length - 1];
    const dur = BASE_MS + STEP_MS * m.path.length;
    el.style.transitionDuration = `${dur}ms`;
    el.style.setProperty('--x', last.x);
    el.style.setProperty('--y', last.y);
    let total = dur;
    if (m.end !== 'stop') {
      total += SINK_MS;
      setTimeout(() => {
        el.classList.add(m.end === 'hole' ? 'sink' : 'drop');
        if (m.end === 'hole' || m.end === 'plug') {
          board.querySelector(`.cell[data-idx="${last.y * game.level.w + last.x}"]`)?.classList.add('filled');
        }
      }, dur);
    }
    longest = Math.max(longest, total);
  }
  setTimeout(() => {
    frame.className = 'frame';
    syncPieces(false);
    game.animating = false;
    const st = status(game.state);
    if (st !== 'playing') return finish(st);
    if (game.queued) { const q = game.queued; game.queued = null; doTilt(q); }
  }, longest + 20);
}

function undo() {
  if (game.animating || !game.history.length) return;
  game.state = game.history.pop();
  game.moves = Math.max(0, game.moves - 1);
  game.ended = false;
  hideOverlay();
  syncPieces(true);
  updateHud();
}

function restart() {
  if (game.animating) return;
  game.state = cloneState(game.initial);
  game.history = [];
  game.moves = 0;
  game.ended = false;
  hideOverlay();
  syncPieces(true);
  updateHud();
}

// ---------- 결과 ----------
function finish(st) {
  game.ended = true;
  const { def } = game;
  if (st === 'won') {
    const stars = starsFor(game.moves, def.par);
    const prev = bestFor(def);
    const isDaily = def.key.startsWith('daily-');
    if (prev == null || game.moves < prev) {
      if (isDaily) progress.daily[def.key.slice(6)] = game.moves;
      else progress.best[def.key] = game.moves;
      saveProgress();
    }
    const actions = [];
    if (!isDaily && def.index < LEVELS.length - 1) actions.push(['다음 단계', 'btn-primary', () => startLevel(levelDef(def.index + 1))]);
    actions.push(['다시 하기', '', restart]);
    actions.push(['단계 목록', '', () => { hideOverlay(); showScreen('menu'); }]);
    const record = prev != null && game.moves < prev ? ' · 새 기록' : '';
    const msg = !isDaily && def.index === LEVELS.length - 1
      ? `${game.moves}수 만에 마지막 단계를 풀었습니다. 최소 ${def.par}수${record}`
      : `${game.moves}수 만에 성공 · 최소 ${def.par}수${record}`;
    showOverlay({ title: stars === 3 ? '완벽해요!' : '완성!', text: msg, stars, actions, lost: false });
  } else {
    showOverlay({
      title: '함정에 빠졌어요',
      text: '구슬이 검은 함정으로 굴러갔습니다. 한 수 되돌려 다른 방향을 시도해 보세요.',
      stars: null,
      lost: true,
      actions: [['한 수 되돌리기', 'btn-primary', undo], ['처음부터', '', restart]],
    });
  }
}

function showOverlay({ title, text, stars, actions, lost }) {
  const ov = $('#overlay');
  ov.querySelector('.dialog').classList.toggle('lost', lost);
  $('#dlg-title').textContent = title;
  $('#dlg-text').textContent = text;
  $('#dlg-stars').innerHTML = stars == null ? '' : [1, 2, 3].map((k) => `<span class="${k <= stars ? 'on' : ''}"></span>`).join('');
  const box = $('#dlg-actions');
  box.textContent = '';
  for (const [label, cls, fn] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', fn);
    box.append(b);
  }
  ov.hidden = false;
  $('#game').inert = true;
  box.querySelector('button')?.focus();
}
function hideOverlay() {
  $('#overlay').hidden = true;
  $('#game').inert = false;
}

// ---------- 입력 연결 ----------
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};
document.addEventListener('keydown', (e) => {
  if ($('#game').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  const dir = KEY_DIRS[e.key];
  if (dir && $('#overlay').hidden) { e.preventDefault(); doTilt(dir); return; }
  if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'Backspace') { e.preventDefault(); undo(); }
  else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); }
  else if (e.key === 'Escape') { hideOverlay(); showScreen('menu'); }
});

// 스와이프: 판 영역에서 손가락/마우스를 끌어서 놓으면 그 방향으로 기울인다
let swipe = null;
const area = $('#board-area');
area.addEventListener('pointerdown', (e) => {
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  try { area.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
});
area.addEventListener('pointerup', (e) => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  doTilt(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
area.addEventListener('pointercancel', () => { swipe = null; });

document.querySelectorAll('.pad').forEach((b) => b.addEventListener('click', () => doTilt(b.dataset.dir)));
$('#btn-undo').addEventListener('click', undo);
$('#btn-restart').addEventListener('click', restart);
$('#btn-menu').addEventListener('click', () => { hideOverlay(); showScreen('menu'); });
$('#btn-daily').addEventListener('click', () => startLevel(getDaily()));
window.addEventListener('resize', layoutBoard);
if (window.ResizeObserver) new ResizeObserver(layoutBoard).observe(area);

// 자동 테스트용 읽기 전용 정보
window.__tilt = {
  info: () => ({ key: game.def?.key, moves: game.moves, status: game.state ? status(game.state) : null, animating: game.animating, par: game.def?.par }),
  rows: () => game.def?.rows,
};

renderMenu();
