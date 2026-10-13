// 틸트 구슬판 — 화면과 입력 처리
import { parseLevel, tilt, status, starsFor, cloneState } from './engine.js';
import { LEVELS } from './levels.js';
import { generatePuzzle, dateSeed } from './generator.js';
import { createTiltDetector, SENSITIVITY, createFlowGate } from './motion.js';
import { rollKeyframes, rollDuration } from './anim.js';
import {
  unlockAudio, setSoundEnabled, soundEnabled, soundStats,
  playRoll, playHit, playHole, playPit, playPlug, playBump, playClick, playWin, playLose,
} from './sound.js';

const $ = (sel) => document.querySelector(sel);
const STORE_KEY = 'tilt-marble-v1';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const SINK_MS = reducedMotion ? 0 : 320;

// ---------- 저장 (브라우저 저장소가 막혀 있어도 게임은 동작) ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { best: data.best || {}, daily: data.daily || {}, last: data.last || 0, motion: !!data.motion, full: !!data.full, sens: SENSITIVITY[data.sens] ? data.sens : 'normal', origin: data.origin || null, sound: data.sound !== false };
  } catch {
    return { best: {}, daily: {}, last: 0, motion: false, full: false, sens: 'normal', origin: null, sound: true };
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
  lastMoveEnd: -Infinity,
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
  // 단계 시작은 항상 사용자의 탭에서 일어나므로, 권한이 필요한 전체 화면·센서도 여기서 요청할 수 있다
  if (progress.full && fullscreenSupported() && !fullscreenElement()) enterFullscreen();
  motion.last = null;
  motion.paused = false;
  // 원점은 저장된 것을 그대로 쓴다(단계마다 다시 잡지 않음 — 기운 채 시작해도 원점은 그대로)
  if (motion.on) { /* 계속 사용 */ } else if (motion.supported && progress.motion) enableMotion(false);
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
    if (p.kind === 'marble') {
      // 구슬: 무늬가 있는 공(.ball) — 굴러갈 때 무늬가 진행 방향으로 돌아간다
      const ball = document.createElement('span');
      ball.className = 'ball';
      el.append(ball);
    }
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
  const cell = Math.max(24, Math.floor(Math.min(availW / game.level.w, availH / game.level.h, 150)));
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
// silent: 움직일 게 없을 때 흔들림 표시 없이 false만 돌려준다(기울기 흐름 조작용)
function doTilt(dir, { silent = false } = {}) {
  if (game.ended || $('#game').hidden) return false;
  if (game.animating) { if (!silent) game.queued = dir; return false; }
  const r = tilt(game.level, game.state, dir);
  const frame = $('#frame');
  if (!r.changed) {
    if (silent) return false;
    playBump();
    frame.classList.remove('shake');
    void frame.offsetWidth;
    frame.classList.add('shake');
    return false;
  }
  motion.last = dir;
  const before = game.state;
  game.history.push(game.state);
  game.state = r.state;
  game.moves++;
  updateHud();
  animateMoves(r.moves, dir, before);
  return true;
}

// 실제 공처럼 굴리기: 점점 빨라지다가 벽에 부딪혀 살짝 튕기고, 표면 무늬가 굴러간 만큼 돈다(anim.js)
function animateMoves(moves, dir, before) {
  const board = $('#board');
  const frame = $('#frame');
  frame.classList.remove('live');
  frame.className = `frame tilt-${dir}`;
  game.animating = true;
  const cell = parseFloat(getComputedStyle($('#app')).getPropertyValue('--cell')) || 56;
  const vol = 1 / Math.sqrt(Math.max(1, moves.length));   // 여러 개가 함께 구르면 하나하나는 작게
  let longest = 0;
  for (const m of moves) {
    const el = board.querySelector(`.piece[data-id="${m.id}"]`);
    const last = m.path[m.path.length - 1];
    const prevPiece = before.pieces.find((p) => p.id === m.id);
    const ball = el.querySelector('.ball');
    const skin = { x: Number(el.dataset.sx) || 0, y: Number(el.dataset.sy) || 0 };
    const k = rollKeyframes({ from: prevPiece, to: last, cell, end: m.end, kind: prevPiece.kind, skin });
    const dur = reducedMotion ? 1 : k.duration;
    el.style.setProperty('--x', last.x);
    el.style.setProperty('--y', last.y);
    if (el.animate) {
      el.animate(k.frames, { duration: dur, fill: 'none' });
      if (ball && k.skinFrames) ball.animate(k.skinFrames, { duration: dur, fill: 'none' });
    }
    // 소리: 굴러감(빨라질수록 커짐) → 벽 충돌 / 구멍 / 함정
    const cells = m.path.length;
    const travel = reducedMotion ? 0 : rollDuration(cells, { bounce: false }) / 1000;
    playRoll({ dur: travel, cells, kind: prevPiece.kind, vol });
    if (m.end === 'stop') playHit({ at: travel, speed: Math.min(1, cells / 5), kind: prevPiece.kind, vol });
    else if (m.end === 'hole') playHole({ at: travel, vol });
    else if (m.end === 'pit') playPit({ at: travel });
    else if (m.end === 'plug') playPlug({ at: travel });
    if (ball) {
      el.dataset.sx = String(k.skinEnd.x);
      el.dataset.sy = String(k.skinEnd.y);
      ball.style.backgroundPosition = `${k.skinEnd.x}px ${k.skinEnd.y}px`;
    }
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
    game.lastMoveEnd = performance.now();
    const st = status(game.state);
    if (st !== 'playing') return finish(st);
    if (game.queued) { const q = game.queued; game.queued = null; doTilt(q); }
  }, longest + 20);
}

function undo() {
  if (game.animating || !game.history.length) return;
  motion.last = null;
  motion.paused = motion.on;
  game.state = game.history.pop();
  game.moves = Math.max(0, game.moves - 1);
  game.ended = false;
  hideOverlay();
  syncPieces(true);
  updateHud();
}

function restart() {
  if (game.animating) return;
  motion.last = null;
  motion.paused = motion.on;
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
    playWin(stars);
    showOverlay({ title: stars === 3 ? '완벽해요!' : '완성!', text: msg, stars, actions, lost: false });
  } else {
    playLose();
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

// ---------- 휴대폰 기울기 조작 ----------
const debugOn = location.hash === '#debug';   // 주소 끝에 #debug를 붙이면 센서 원래 값을 화면에 보여 준다
// 휴대폰을 기울이면 그 방향으로 판을 기울인다. 처음 든 각도를 수평으로 보고, 한 번 기울인 뒤에는
// 처음 각도 근처로 돌아와야 다음 기울이기를 받는다.
const motion = {
  supported: 'DeviceOrientationEvent' in window && (navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches),
  on: false,
  detector: createTiltDetector({ on: SENSITIVITY[progress.sens], origin: progress.origin }),
  gotEvent: false,
  watchdog: 0,
  last: null,      // 마지막에 적용한 방향(같은 방향은 다시 적용해도 변화가 없으므로 건너뛴다)
  gate: createFlowGate(),
  paused: false,
};

function screenAngle() {
  const a = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  return Number(a) || 0;
}

function setMotionButton() {
  const b = $('#btn-motion');
  b.hidden = !motion.supported;
  b.setAttribute('aria-pressed', String(motion.on));
  $('#meter').hidden = !motion.on;
  $('#sens').hidden = !motion.on;
  $('#debug').hidden = !(debugOn && motion.on);
  document.querySelectorAll('#sens button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sens === progress.sens)));
}

// 수평계: 점이 고리(입력 기준 각도) 밖으로 나가면 그 방향으로 기울어진다. 회색이면 되돌아오기를 기다리는 중.
// 상태: 고리가 깜빡이면 기준을 잡는 중(잠깐 멈추세요), 점이 회색이면 되돌아오기를 기다리는 중.
const METER_R = 13;
function updateMeter(r) {
  const m = $('#meter');
  const k = (v) => Math.max(-1.25, Math.min(1.25, v / motion.detector.threshold)) * METER_R;
  m.style.setProperty('--mx', `${k(r.x).toFixed(1)}px`);
  m.style.setProperty('--my', `${k(r.y).toFixed(1)}px`);
  m.classList.toggle('calib', r.state === 'calib');
}

function flashHint(text) {
  $('#hint').textContent = text;
}

function onOrientation(e) {
  if (!motion.on) return;
  // 센서가 없는 기기는 값이 빈(null) 이벤트를 한 번 보내기도 하므로 실제 값이 있을 때만 '동작 중'으로 본다
  if (e.beta == null || e.gamma == null) return;
  motion.gotEvent = true;
  const angle = screenAngle();
  const r = motion.detector.feed(e.beta, e.gamma, angle, performance.now());
  if (r.origin) {                      // 앞뒤 원점을 새로 잡았으면 저장
    progress.origin = r.origin;
    saveProgress();
    flashHint('원점을 잡았습니다. 기울이는 쪽으로 구슬이 흘러갑니다. 원점을 바꾸려면 오른쪽 위 수평계를 누르세요.');
  }
  updateMeter(r);
  if (debugOn) {
    const f = (v) => (v == null ? '-' : v.toFixed(1));
    $('#debug').textContent = `α ${f(e.alpha)} β ${f(e.beta)} γ ${f(e.gamma)} · 화면 ${angle}° → x ${f(r.x)} y ${f(r.y)} · ${r.state}${r.dir ? ` ▶ ${r.dir}` : ''}`;
  }
  const frame = $('#frame');
  if (!game.animating && !$('#game').hidden) {
    const clamp = (v) => Math.max(-6, Math.min(6, v / 3));
    frame.classList.add('live');
    frame.style.setProperty('--rx', `${-clamp(r.y)}deg`);
    frame.style.setProperty('--ry', `${clamp(r.x)}deg`);
  }
  if ($('#overlay').hidden) motionStep(r);
}

// 흐름 조작: 지금 기울어진 방향 중 마지막에 적용한 방향이 아닌 것을 적용한다(움직일 게 있을 때만).
// 대각선이면 두 방향이 번갈아 적용되어 더 움직이지 않을 때까지 굴러간다.
function motionStep(r) {
  if (game.animating || game.ended || $('#game').hidden) return;
  if (motion.paused) {                 // 되돌리기·처음부터 직후: 판을 수평으로 돌릴 때까지 대기
    if (r.dirs.length) return;
    motion.paused = false;
  }
  // 적용할 수 있는(실제로 움직이는) 방향만 후보로, 잠깐 기울어 있어야 하고 앞 움직임 뒤 쉬었다가 적용
  const cands = r.dirs.filter((dir) => dir !== motion.last && tilt(game.level, game.state, dir).changed);
  const dir = motion.gate.decide(cands, performance.now(), game.lastMoveEnd);
  if (dir) doTilt(dir, { silent: true });
}

async function enableMotion(fromButton) {
  if (!motion.supported || motion.on) return;
  const DOE = window.DeviceOrientationEvent;
  if (typeof DOE.requestPermission === 'function') {
    try {
      const res = await DOE.requestPermission();
      if (res !== 'granted') {
        flashHint('기울기 센서 사용이 허용되지 않았습니다. 스와이프나 방향 버튼으로 조작하세요.');
        return;
      }
    } catch {
      if (fromButton) flashHint('기울기 센서를 켜지 못했습니다. 다시 한 번 눌러 주세요.');
      return;
    }
  }
  motion.on = true;
  motion.gotEvent = false;
  window.addEventListener('deviceorientation', onOrientation);
  setMotionButton();
  if (fromButton) { progress.motion = true; saveProgress(); }
  updateMeter({ x: 0, y: 0, state: motion.detector.state });
  flashHint(motion.detector.state === 'calib'
    ? '원점 잡기: 휴대폰을 편한 앞뒤 각도로 들고 잠깐 멈추세요. 좌우는 실제 수평이 원점입니다.'
    : '기울이는 쪽으로 구슬이 흘러갑니다. 대각선으로 기울이면 두 방향으로 흘러가요. 원점은 수평계를 눌러 다시 잡을 수 있습니다.');
  clearTimeout(motion.watchdog);
  motion.watchdog = setTimeout(() => {
    if (motion.on && !motion.gotEvent) {
      disableMotion(false);
      flashHint('이 기기에서는 기울기 센서 값을 받을 수 없습니다. 스와이프나 방향 버튼으로 조작하세요.');
    }
  }, 2500);
}

function disableMotion(fromButton) {
  motion.on = false;
  clearTimeout(motion.watchdog);
  window.removeEventListener('deviceorientation', onOrientation);
  const frame = $('#frame');
  frame.classList.remove('live');
  frame.style.removeProperty('--rx');
  frame.style.removeProperty('--ry');
  setMotionButton();
  if (fromButton) { progress.motion = false; saveProgress(); updateHud(); }
}

$('#btn-motion').addEventListener('click', () => (motion.on ? disableMotion(true) : enableMotion(true)));
$('#meter').addEventListener('click', () => {
  motion.detector.calibrate();
  progress.origin = null;
  saveProgress();
  updateMeter({ x: 0, y: 0, state: 'calib' });
  flashHint('원점을 다시 잡습니다. 편한 앞뒤 각도로 들고 잠깐 멈추세요. 좌우는 실제 수평이 원점입니다.');
});
document.querySelectorAll('#sens button').forEach((b) => b.addEventListener('click', () => {
  progress.sens = b.dataset.sens;
  saveProgress();
  motion.detector = createTiltDetector({ on: SENSITIVITY[progress.sens], origin: progress.origin });
  setMotionButton();
  flashHint(`감도: ${b.textContent} (원점에서 ${SENSITIVITY[progress.sens]}° 기울이면 흐릅니다).`);
}));
setMotionButton();

// ---------- 전체 화면 ----------
function fullscreenSupported() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}
function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function enterFullscreen() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    p?.catch?.(() => {});
  } catch { /* 지원하지 않는 환경 */ }
}
function exitFullscreen() {
  try {
    const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.();
    p?.catch?.(() => {});
  } catch { /* 무시 */ }
}
function setFullButton() {
  const b = $('#btn-full');
  b.hidden = !fullscreenSupported();
  const on = !!fullscreenElement();
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? '전체 화면 끝내기' : '전체 화면');
}
$('#btn-full').addEventListener('click', () => {
  if (fullscreenElement()) { progress.full = false; exitFullscreen(); }
  else { progress.full = true; enterFullscreen(); }
  saveProgress();
});
['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
  setFullButton();
  requestAnimationFrame(layoutBoard);
}));
setFullButton();

// ---------- 소리 ----------
// 브라우저는 사용자가 누르기 전에는 소리를 못 내므로, 첫 탭·키 입력에서 오디오를 준비한다
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => unlockAudio(), { capture: true }));
function setSoundButton() {
  const b = $('#btn-sound');
  b.setAttribute('aria-pressed', String(progress.sound));
  b.setAttribute('aria-label', progress.sound ? '소리 끄기' : '소리 켜기');
}
function toggleSound() {
  progress.sound = !progress.sound;
  saveProgress();
  setSoundEnabled(progress.sound);
  setSoundButton();
  playClick();
}
$('#btn-sound').addEventListener('click', toggleSound);
document.addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) toggleSound(); });
document.addEventListener('click', (e) => { if (e.target.closest('.btn, .level-btn, .sens button')) playClick(); });
setSoundEnabled(progress.sound);
setSoundButton();

// 자동 테스트용 읽기 전용 정보
window.__tilt = {
  motion: () => ({ supported: motion.supported, on: motion.on }),
  sound: () => ({ ...soundStats, enabled: soundEnabled() }),
  info: () => ({ key: game.def?.key, moves: game.moves, status: game.state ? status(game.state) : null, animating: game.animating, par: game.def?.par }),
  rows: () => game.def?.rows,
};

renderMenu();

// 앱 설치(PWA)·오프라인 실행: 매니페스트가 있는 정식 페이지에서만 서비스 워커를 등록한다
if ('serviceWorker' in navigator && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
