// 장소별 배경음악 — 음원 파일 없이 Web Audio API로 직접 연주한다(저작권 걱정 없음).
//   title  메인 화면    : 오르골 테마(다장조 5음계), 은은한 화음
//   attic  1장 다락방    : 아침 햇살 같은 오르골 아르페지오(라장조)
//   summer 2장 대청마루  : 가야금처럼 뜯는 소리(가단조 5음계) + 풀벌레 소리
//   autumn 3장 가을 장터 : 흥겨운 뜯는 소리 + 장구 같은 북(사장조)
//   winter 4장 겨울 공방 : 느린 피아노(마단조) + 난로 타닥 소리
// 작곡(composePhrase)은 같은 입력이면 늘 같은 악보를 내는 순수 함수, 연주는 아래 스케줄러가 맡는다.

import { audioOut } from './sound.js';

const MAJ = { I: [0, 4, 7], ii: [2, 5, 9], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16] };
const MIN = { i: [0, 3, 7], III: [3, 7, 10], iv: [5, 8, 12], VI: [8, 12, 15], VII: [10, 14, 17] };

export const TRACKS = {
  title: { bpm: 84, root: 60, scale: [0, 2, 4, 7, 9], prog: [MAJ.I, MAJ.vi, MAJ.IV, MAJ.V], lead: 'box', arp: 'box', arpSteps: [0, 4, 8, 12], melodyEvery: 2, density: 0.5, pad: true, bass: true },
  attic: { bpm: 76, root: 62, scale: [0, 2, 4, 7, 9], prog: [MAJ.I, MAJ.IV, MAJ.vi, MAJ.V], lead: 'box', arp: 'box', arpSteps: [0, 2, 4, 6, 8, 10, 12, 14], melodyEvery: 4, density: 0.45, pad: true, bass: false },
  summer: { bpm: 66, root: 57, scale: [0, 3, 5, 7, 10], prog: [MIN.i, MIN.VI, MIN.VII, MIN.iv], lead: 'pluck', arp: 'pluck', arpSteps: [0, 6, 10], melodyEvery: 2, density: 0.38, pad: true, bass: true, ambience: 'crickets' },
  autumn: { bpm: 100, root: 55, scale: [0, 2, 4, 7, 9], prog: [MAJ.I, MAJ.V, MAJ.vi, MAJ.IV], lead: 'pluck', arp: 'pluck', arpSteps: [0, 3, 6, 8, 11, 14], melodyEvery: 2, density: 0.55, pad: false, bass: true, drums: { kung: [0, 6, 8], deok: [4, 12, 14] }, ambience: 'crowd' },
  winter: { bpm: 60, root: 52, scale: [0, 3, 5, 7, 10], prog: [MIN.i, MIN.VI, MIN.III, MIN.VII], lead: 'piano', arp: 'piano', arpSteps: [0, 8], melodyEvery: 4, density: 0.6, pad: true, bass: true, ambience: 'crackle' },
};

export const STEPS_PER_BAR = 16;
export const BARS_PER_PHRASE = 4;

/** 작은 시드 난수(다른 모듈과 이름이 겹치지 않게) */
function musicRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 한 악절(4마디) 작곡. 반환: [{ step, inst, midi, dur(스텝), vel }]
 * 같은 곡·같은 악절 번호면 항상 같은 결과. 홀짝 악절은 선율이 달라 반복이 덜 단조롭다.
 */
export function composePhrase(name, phrase = 0) {
  const tr = TRACKS[name];
  if (!tr) return [];
  const rand = musicRand(name.length * 7919 + (phrase % 2) * 104729 + tr.bpm);
  const ev = [];
  const scaleNotes = [];
  for (let o = 0; o < 3; o++) for (const s of tr.scale) scaleNotes.push(tr.root + 12 + o * 12 + s - 12);  // 선율 음역
  let idx = Math.floor(scaleNotes.length / 2);
  for (let bar = 0; bar < BARS_PER_PHRASE; bar++) {
    const chord = tr.prog[bar % tr.prog.length];
    const base = bar * STEPS_PER_BAR;
    if (tr.bass) {
      ev.push({ step: base, inst: 'bass', midi: tr.root - 12 + chord[0], dur: 8, vel: 0.55 });
      ev.push({ step: base + 8, inst: 'bass', midi: tr.root - 12 + chord[(phrase + bar) % 2 ? 2 : 0], dur: 8, vel: 0.4 });
    }
    if (tr.pad) ev.push({ step: base, inst: 'pad', midi: tr.root + chord[0], chord: chord.map((c) => tr.root + c), dur: 16, vel: 0.3 });
    tr.arpSteps.forEach((st, k) => {
      const tone = chord[k % chord.length] + (k >= chord.length ? 12 : 0);
      ev.push({ step: base + st, inst: tr.arp, midi: tr.root + tone, dur: 4, vel: k === 0 ? 0.42 : 0.3 });
    });
    if (tr.drums) {
      for (const st of tr.drums.kung) ev.push({ step: base + st, inst: 'kung', midi: 0, dur: 2, vel: st === 0 ? 0.7 : 0.45 });
      for (const st of tr.drums.deok) ev.push({ step: base + st, inst: 'deok', midi: 0, dur: 1, vel: 0.35 });
    }
    // 선율: 박자 격자 위에서 확률적으로, 센박에는 화음 음으로
    for (let st = 0; st < STEPS_PER_BAR; st += tr.melodyEvery) {
      const strong = st % 8 === 0;
      if (!strong && rand() > tr.density) continue;
      if (strong) {
        const target = tr.root + 12 + chord[Math.floor(rand() * chord.length)];
        let best = 0;
        scaleNotes.forEach((n, i) => { if (Math.abs(n - target) < Math.abs(scaleNotes[best] - target)) best = i; });
        idx = best;
      } else {
        idx = Math.max(0, Math.min(scaleNotes.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(rand() * 6)]));
      }
      const dur = strong ? tr.melodyEvery * 2 : tr.melodyEvery;
      ev.push({ step: base + st, inst: tr.lead, midi: scaleNotes[idx], dur, vel: strong ? 0.5 : 0.36 });
    }
  }
  return ev.sort((a, b) => a.step - b.step);
}

// ---------- 연주 ----------
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const music = { on: true, want: null, track: null, gain: null, timer: 0, next: 0, step: 0, phrase: 0, events: [], ei: 0, notes: 0 };
export const MUSIC_VOLUME = 0.11;   // 효과음이 묻히지 않게 낮게(이전 0.22의 절반)

export function setMusicEnabled(on) {
  music.on = !!on;
  const a = audioOut();
  if (!music.on) stopMusic();
  else if (a && music.want) playMusic(music.want, true);
}
export function musicEnabled() { return music.on; }
export function musicInfo() { return { track: music.track, want: music.want, playing: !!music.timer, notes: music.notes }; }

/** 곡 바꾸기. 오디오가 아직 준비 전이면 원하는 곡만 기억해 둔다 */
export function playMusic(name, force = false) {
  music.want = name;
  if (!music.on || !TRACKS[name]) return;
  const a = audioOut();
  if (!a) return;
  if (!force && music.track === name && music.timer) return;
  fadeOutCurrent(a.ctx);
  const g = a.ctx.createGain();
  g.gain.value = 0.0001;
  g.connect(a.out);
  g.gain.setTargetAtTime(MUSIC_VOLUME, a.ctx.currentTime + 0.05, 0.6);
  Object.assign(music, { track: name, gain: g, next: a.ctx.currentTime + 0.1, step: 0, phrase: 0, events: composePhrase(name, 0), ei: 0 });
  clearInterval(music.timer);
  music.timer = setInterval(tick, 60);
  tick();
}

function fadeOutCurrent(c) {
  if (!music.gain) return;
  const old = music.gain;
  old.gain.setTargetAtTime(0.0001, c.currentTime, 0.25);
  setTimeout(() => { try { old.disconnect(); } catch { /* 이미 끊김 */ } }, 1500);
  music.gain = null;
}

export function stopMusic() {
  clearInterval(music.timer);
  music.timer = 0;
  const a = audioOut();
  if (a) fadeOutCurrent(a.ctx);
  music.track = null;
}

function tick() {
  const a = audioOut();
  if (!a || !music.gain) return;
  const tr = TRACKS[music.track];
  const stepDur = 60 / tr.bpm / 4;
  const horizon = a.ctx.currentTime + 0.3;
  while (music.next < horizon) {
    while (music.ei < music.events.length && music.events[music.ei].step === music.step) {
      const e = music.events[music.ei++];
      voice(a, e, music.next, e.dur * stepDur);
      music.notes++;
    }
    if (tr.ambience && music.step % 4 === 0) ambience(a, tr.ambience, music.next, stepDur * 4);
    music.next += stepDur;
    music.step++;
    if (music.step >= STEPS_PER_BAR * BARS_PER_PHRASE) {
      music.step = 0;
      music.phrase++;
      music.events = composePhrase(music.track, music.phrase);
      music.ei = 0;
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(music.timer); music.timer = 0; }
    else if (music.on && music.want) { const w = music.want; music.track = null; playMusic(w); }
  });
}

// ---------- 악기 ----------
function env(c, g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function osc(c, type, freq, t, stop, dest) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(dest);
  o.start(t);
  o.stop(stop);
  return o;
}

function voice({ ctx: c, noise }, e, t, len) {
  const out = music.gain;
  const g = c.createGain();
  g.connect(out);
  const f = mf(e.midi);
  switch (e.inst) {
    case 'box': {          // 오르골: 맑은 기본음 + 높은 배음, 빠르게 사라짐
      env(c, g, t, 0.22 * e.vel, 0.003, 1.3);
      osc(c, 'sine', f, t, t + 1.4, g);
      const g2 = c.createGain(); g2.gain.value = 0.25; g2.connect(g);
      osc(c, 'sine', f * 4.01, t, t + 0.5, g2);
      break;
    }
    case 'pluck': {        // 가야금처럼: 뜯는 순간 살짝 높았다가 내려오고, 밝은 소리가 금방 어두워짐
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(g);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.6);
      env(c, g, t, 0.28 * e.vel, 0.004, 0.9);
      const o = osc(c, 'triangle', f * 1.012, t, t + 1, lp);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      const o2 = osc(c, 'sawtooth', f, t, t + 0.6, lp);
      o2.detune.value = 4;
      break;
    }
    case 'piano': {        // 부드러운 피아노: 기본음 + 옥타브, 길게 울림
      env(c, g, t, 0.22 * e.vel, 0.006, Math.max(1.6, len * 1.4));
      osc(c, 'sine', f, t, t + len * 1.6 + 2, g);
      const g2 = c.createGain(); g2.gain.value = 0.18; g2.connect(g);
      osc(c, 'triangle', f * 2, t, t + 1.2, g2);
      break;
    }
    case 'pad': {          // 은은한 화음: 천천히 커졌다가 사라짐
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 * e.vel, t + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.05);
      for (const m of e.chord) {
        const o = osc(c, 'sawtooth', mf(m), t, t + len * 1.1, lp);
        o.detune.value = (Math.random() - 0.5) * 12;
      }
      break;
    }
    case 'bass': {
      env(c, g, t, 0.3 * e.vel, 0.01, Math.min(1.2, len));
      osc(c, 'sine', f, t, t + len + 0.2, g);
      break;
    }
    case 'kung': {         // 장구 '쿵': 낮게 떨어지는 북소리
      env(c, g, t, 0.5 * e.vel, 0.004, 0.32);
      const o = osc(c, 'sine', 120, t, t + 0.4, g);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.3);
      break;
    }
    case 'deok': {         // 장구 '덕': 짧고 높은 채 소리
      if (!noise) break;
      const src = c.createBufferSource(); src.buffer = noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
      src.connect(bp).connect(g);
      env(c, g, t, 0.35 * e.vel, 0.002, 0.07);
      src.start(t, Math.random()); src.stop(t + 0.1);
      break;
    }
    default: break;
  }
}

// 장소 소리(음악 사이사이): 풀벌레, 장터 웅성거림, 난로 타닥
function ambience({ ctx: c, noise }, kind, t, span) {
  const out = music.gain;
  if (kind === 'crickets') {
    if (Math.random() < 0.55) return;
    for (let k = 0; k < 3; k++) {
      const g = c.createGain(); g.connect(out);
      const at = t + Math.random() * span;
      env(c, g, at, 0.012, 0.005, 0.05);
      osc(c, 'sine', 4300 + Math.random() * 500, at, at + 0.08, g);
    }
  } else if (kind === 'crackle' && noise) {
    const n = Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const at = t + Math.random() * span;
      const src = c.createBufferSource(); src.buffer = noise;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      const g = c.createGain(); env(c, g, at, 0.06 + Math.random() * 0.08, 0.001, 0.03);
      src.connect(hp).connect(g).connect(out);
      src.start(at, Math.random()); src.stop(at + 0.05);
    }
  } else if (kind === 'crowd' && noise && Math.random() < 0.5) {
    const src = c.createBufferSource(); src.buffer = noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 300; bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + span * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + span * 1.2);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random()); src.stop(t + span * 1.3);
  }
}
