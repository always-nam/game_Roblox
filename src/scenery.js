// 장마다 바뀌는 배경 — 이미지 파일 없이 SVG(풍경)와 캔버스(떠다니는 효과)로 그린다.
//   attic  다락방 · 여름 아침  : 지붕 서까래, 둥근 창의 햇살 줄기, 떠다니는 먼지
//   summer 대청마루 · 여름 저녁 : 처마, 기둥, 마루, 먼 산, 반딧불
//   autumn 장터 · 가을 해 질 녘 : 노을, 천막 지붕, 등불 줄, 떨어지는 단풍잎
//   winter 공방 · 첫눈 오는 밤  : 창밖 눈, 작업대, 걸린 연장, 난로 불빛, 내리는 눈

const SVG = {
  attic: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c1f15"/><stop offset="1" stop-color="#140e09"/></linearGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd98a" stop-opacity=".34"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></linearGradient>
      <radialGradient id="win" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7b0"/><stop offset=".7" stop-color="#f0b860"/><stop offset="1" stop-color="#c88a3a"/></radialGradient>
      <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <circle cx="640" cy="210" r="230" fill="url(#halo)"/>
    <polygon points="580,230 700,185 640,1000 260,1000" fill="url(#beam)"/>
    <circle cx="640" cy="210" r="72" fill="#1a110b"/>
    <circle cx="640" cy="210" r="60" fill="url(#win)"/>
    <path d="M640 150v120M580 210h120" stroke="#3a2616" stroke-width="7"/>
    <polygon points="-40,420 500,30 540,60 0,470" fill="#3b2818"/>
    <polygon points="1040,420 500,30 460,60 1000,470" fill="#34231a"/>
    <path d="M120 330 L880 330" stroke="#2a1b11" stroke-width="18"/>
    <path d="M250 225 L750 225" stroke="#2a1b11" stroke-width="12"/>
    <rect x="0" y="860" width="1000" height="140" fill="#2b1c12"/>
    <path d="M0 900h1000M0 945h1000" stroke="#21150d" stroke-width="3"/>
    <rect x="40" y="740" width="170" height="125" rx="6" fill="#1e140d"/>
    <rect x="70" y="690" width="120" height="55" rx="5" fill="#24180f"/>
    <rect x="820" y="770" width="140" height="95" rx="6" fill="#1e140d"/>`,

  summer: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2a2a"/><stop offset=".55" stop-color="#2c3d2a"/><stop offset=".8" stop-color="#6a5232"/><stop offset="1" stop-color="#2a1c12"/></linearGradient>
      <radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d8"/><stop offset=".6" stop-color="#f3e3b0"/><stop offset="1" stop-color="#f3e3b0" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <circle cx="250" cy="300" r="60" fill="url(#moon)" opacity=".85"/>
    <path d="M0 640 C150 560 260 600 380 570 C520 530 640 600 760 560 C860 530 940 560 1000 545 V760 H0Z" fill="#132a20"/>
    <path d="M0 700 C200 650 340 690 520 660 C700 630 820 680 1000 650 V800 H0Z" fill="#0d1f17"/>
    <rect x="0" y="0" width="1000" height="120" fill="#140e0a"/>
    <g fill="#140e0a">${Array.from({ length: 21 }, (_, i) => `<circle cx="${i * 50}" cy="120" r="26"/>`).join('')}</g>
    <path d="M0 150 Q500 120 1000 150" stroke="#1d140d" stroke-width="10" fill="none"/>
    <rect x="30" y="100" width="60" height="900" fill="#2a1a10"/>
    <rect x="910" y="100" width="60" height="900" fill="#2a1a10"/>
    <polygon points="0,820 1000,820 1000,1000 0,1000" fill="#3a2616"/>
    <g stroke="#2a1a10" stroke-width="3">${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" y1="820" x2="${500 + (i * 100 - 500) * 1.8}" y2="1000"/>`).join('')}</g>
    <path d="M0 820h1000" stroke="#4a3220" stroke-width="6"/>`,

  autumn: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24172f"/><stop offset=".45" stop-color="#5a2a3a"/><stop offset=".75" stop-color="#b85a34"/><stop offset="1" stop-color="#2a1610"/></linearGradient>
      <radialGradient id="lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb070" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <circle cx="700" cy="640" r="90" fill="#f0a060" opacity=".35"/>
    <path d="M-20 170 Q250 260 500 190 T1020 200" stroke="#1a0f12" stroke-width="3" fill="none"/>
    ${[[80, 205], [210, 236], [345, 228], [470, 198], [600, 190], [730, 213], [860, 222], [970, 205]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y + 30}" r="62" fill="url(#lamp)"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 12}" stroke="#1a0f12" stroke-width="3"/><ellipse cx="${x}" cy="${y + 32}" rx="18" ry="22" fill="#d8452e"/><rect x="${x - 8}" y="${y + 9}" width="16" height="6" fill="#2a1410"/><rect x="${x - 7}" y="${y + 52}" width="14" height="5" fill="#2a1410"/>`).join('')}
    <polygon points="-20,760 140,660 300,760" fill="#1d1016"/>
    <polygon points="250,780 420,670 590,780" fill="#22121a"/>
    <polygon points="540,770 720,650 900,770" fill="#1d1016"/>
    <polygon points="840,780 980,690 1060,780" fill="#22121a"/>
    <rect x="0" y="760" width="1000" height="240" fill="#170c10"/>
    <g fill="#2a1418">${[60, 330, 610, 880].map((x) => `<rect x="${x}" y="790" width="110" height="70" rx="4"/>`).join('')}</g>`,

  winter: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1626"/><stop offset="1" stop-color="#1a1520"/></linearGradient>
      <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#2a3a5a"/></linearGradient>
      <radialGradient id="stove" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a4a" stop-opacity=".55"/><stop offset=".5" stop-color="#ff7a2a" stop-opacity=".18"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <rect x="300" y="90" width="400" height="330" fill="url(#night)"/>
    <path d="M300 360 Q400 330 500 352 T700 345 V420 H300Z" fill="#dfe8f5" opacity=".85"/>
    <rect x="300" y="90" width="400" height="330" fill="none" stroke="#2b1c12" stroke-width="22"/>
    <path d="M500 90v330M300 255h400" stroke="#2b1c12" stroke-width="12"/>
    <circle cx="160" cy="900" r="300" fill="url(#stove)"/>
    <rect x="95" y="760" width="120" height="150" rx="10" fill="#1b1210"/>
    <rect x="120" y="800" width="70" height="45" rx="6" fill="#ff8a3a" opacity=".75"/>
    <rect x="140" y="600" width="26" height="165" fill="#1b1210"/>
    <g fill="#120d0c">
      <rect x="760" y="140" width="10" height="120"/><polygon points="740,150 790,150 790,175 740,175"/>
      <rect x="840" y="150" width="70" height="14" rx="3"/><rect x="870" y="164" width="9" height="90"/>
      <path d="M800 300 l60 -20 l8 22 l-60 20z"/>
    </g>
    <rect x="420" y="820" width="560" height="40" rx="4" fill="#24170f"/>
    <rect x="450" y="860" width="26" height="140" fill="#1b110b"/><rect x="930" y="860" width="26" height="140" fill="#1b110b"/>
    <rect x="0" y="960" width="1000" height="40" fill="#120c09"/>`,
};

// 떠다니는 효과 설정
const FX = {
  attic: { n: 46, color: () => `rgba(255, ${210 + Math.random() * 30 | 0}, 150, ${0.25 + Math.random() * 0.45})`, size: [1, 2.6], vy: [-0.08, 0.05], vx: [-0.06, 0.06], kind: 'dust' },
  summer: { n: 26, color: () => 'rgba(214, 255, 120, 1)', size: [1.6, 2.8], vy: [-0.18, 0.18], vx: [-0.2, 0.2], kind: 'firefly' },
  autumn: { n: 22, color: () => ['#c8452a', '#e07a2e', '#d9a94e', '#a8322a'][Math.random() * 4 | 0], size: [5, 9], vy: [0.35, 0.8], vx: [-0.3, 0.4], kind: 'leaf' },
  winter: { n: 70, color: () => `rgba(235, 242, 255, ${0.35 + Math.random() * 0.55})`, size: [1, 3], vy: [0.3, 0.9], vx: [-0.15, 0.15], kind: 'snow' },
};

const rnd = ([a, b]) => a + Math.random() * (b - a);
let current = null;
let raf = 0;
let parts = [];
let canvas = null;
let reduced = false;

/** 배경을 장면에 맞게 바꾼다. root: 배경을 넣을 요소 */
export function setScene(root, name) {
  if (!SVG[name]) name = 'attic';
  document.documentElement.dataset.scene = name;
  if (current === name) return;
  current = name;
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  root.querySelector('.scene-art').innerHTML =
    `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SVG[name]}</svg>`;
  canvas = root.querySelector('.scene-fx');
  resize();
  const fx = FX[name];
  parts = Array.from({ length: fx.n }, () => spawn(fx, true));
  cancelAnimationFrame(raf);
  if (reduced) draw(fx, 0);
  else loop(fx);
}

function spawn(fx, anywhere) {
  const w = canvas.width, h = canvas.height;
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : (fx.kind === 'leaf' || fx.kind === 'snow' ? -10 : h + 10),
    r: rnd(fx.size) * (window.devicePixelRatio || 1),
    vx: rnd(fx.vx), vy: rnd(fx.vy),
    c: fx.color(),
    ph: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI,
  };
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}
if (typeof window !== 'undefined') window.addEventListener('resize', resize);

function draw(fx, t) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = canvas.width, h = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  g.clearRect(0, 0, w, h);
  for (const p of parts) {
    if (fx.kind === 'firefly') {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(t / 700 + p.ph));
      g.globalAlpha = a;
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      grd.addColorStop(0, p.c);
      grd.addColorStop(1, 'rgba(214,255,120,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); g.fill();
    } else if (fx.kind === 'leaf') {
      g.globalAlpha = 0.85;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.c;
      g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    } else {
      g.globalAlpha = 1;
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  return dpr;
}

function loop(fx) {
  let last = performance.now();
  const step = (t) => {
    const dt = Math.min(50, t - last) / 16.7;
    last = t;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width, h = canvas.height;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const sway = fx.kind === 'leaf' ? Math.sin(t / 600 + p.ph) * 0.6 : fx.kind === 'snow' ? Math.sin(t / 900 + p.ph) * 0.25 : Math.sin(t / 1500 + p.ph) * 0.1;
      p.x += (p.vx + sway) * dt * dpr;
      p.y += p.vy * dt * dpr;
      p.rot += 0.02 * dt;
      if (fx.kind === 'firefly' && Math.random() < 0.01) { p.vx = rnd(fx.vx); p.vy = rnd(fx.vy); }
      if (p.y > h + 20 || p.y < -20 || p.x < -20 || p.x > w + 20) parts[i] = spawn(fx, fx.kind === 'dust' || fx.kind === 'firefly');
    }
    draw(fx, t);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!current) return;
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduced) loop(FX[current]);
  });
}
