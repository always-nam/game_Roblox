// 장마다 바뀌는 배경 — 이미지 파일 없이 SVG(풍경)와 캔버스(떠다니는 효과)로 그린다.
//   attic  다락방 · 여름 아침  : 지붕 서까래, 둥근 창의 햇살 줄기, 떠다니는 먼지
//   summer 대청마루 · 여름 한낮 : 파란 하늘, 처마, 기둥, 마루, 초록 산, 떠다니는 민들레 씨앗
//   autumn 장터 · 가을 오후   : 맑은 하늘, 줄무늬 천막, 등불 줄, 떨어지는 단풍잎
//   winter 공방 · 눈 오는 낮   : 자작나무 벽, 창밖 설경, 작업대, 난로 불빛, 내리는 눈

const SVG = {
  // 다락방 · 여름 아침: 밝은 원목 다락, 둥근 창으로 쏟아지는 햇살
  attic: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dcb2"/><stop offset="1" stop-color="#d9b07a"/></linearGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".85"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
      <radialGradient id="win" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#fff2c8"/><stop offset="1" stop-color="#ffd98a"/></radialGradient>
      <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8" stop-opacity=".9"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <circle cx="640" cy="210" r="260" fill="url(#halo)"/>
    <polygon points="580,230 700,185 640,1000 260,1000" fill="url(#beam)" opacity=".6"/>
    <circle cx="640" cy="210" r="74" fill="#a8743f"/>
    <circle cx="640" cy="210" r="62" fill="url(#win)"/>
    <path d="M640 150v120M580 210h120" stroke="#a8743f" stroke-width="7"/>
    <polygon points="-40,420 500,30 540,60 0,470" fill="#c08a52"/>
    <polygon points="1040,420 500,30 460,60 1000,470" fill="#b47f49"/>
    <path d="M120 330 L880 330" stroke="#a87443" stroke-width="18"/>
    <path d="M250 225 L750 225" stroke="#a87443" stroke-width="12"/>
    <rect x="0" y="860" width="1000" height="140" fill="#c99a62"/>
    <path d="M0 900h1000M0 945h1000" stroke="#b5864f" stroke-width="3"/>
    <rect x="40" y="740" width="170" height="125" rx="6" fill="#a8763f"/>
    <rect x="70" y="690" width="120" height="55" rx="5" fill="#b8854c"/>
    <rect x="820" y="770" width="140" height="95" rx="6" fill="#a8763f"/>`,

  // 대청마루 · 여름 한낮: 파란 하늘, 초록 산, 처마와 기둥, 반짝이는 마루
  summer: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ef"/><stop offset=".55" stop-color="#d6f0f3"/><stop offset=".8" stop-color="#f6efd6"/><stop offset="1" stop-color="#e2b77a"/></linearGradient>
      <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffef0"/><stop offset=".5" stop-color="#fff7c0" stop-opacity=".8"/><stop offset="1" stop-color="#fff7c0" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <circle cx="270" cy="290" r="120" fill="url(#sun)"/>
    <g fill="#ffffff" opacity=".85"><ellipse cx="640" cy="260" rx="90" ry="26"/><ellipse cx="700" cy="245" rx="60" ry="24"/><ellipse cx="200" cy="420" rx="70" ry="18"/></g>
    <path d="M0 640 C150 560 260 600 380 570 C520 530 640 600 760 560 C860 530 940 560 1000 545 V760 H0Z" fill="#8cc47a"/>
    <path d="M0 700 C200 650 340 690 520 660 C700 630 820 680 1000 650 V800 H0Z" fill="#6aaa5e"/>
    <rect x="0" y="0" width="1000" height="120" fill="#5a3d26"/>
    <g fill="#5a3d26">${Array.from({ length: 21 }, (_, i) => `<circle cx="${i * 50}" cy="120" r="26"/>`).join('')}</g>
    <path d="M0 150 Q500 120 1000 150" stroke="#7a5434" stroke-width="10" fill="none"/>
    <rect x="30" y="100" width="60" height="900" fill="#9a6a3e"/>
    <rect x="910" y="100" width="60" height="900" fill="#9a6a3e"/>
    <polygon points="0,820 1000,820 1000,1000 0,1000" fill="#dcaa6a"/>
    <g stroke="#c08c50" stroke-width="3">${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" y1="820" x2="${500 + (i * 100 - 500) * 1.8}" y2="1000"/>`).join('')}</g>
    <path d="M0 820h1000" stroke="#b8844a" stroke-width="6"/>`,

  // 장터 · 가을 오후: 맑은 가을 하늘, 줄무늬 천막, 등불 줄
  autumn: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd2ea"/><stop offset=".55" stop-color="#fbe7c2"/><stop offset=".78" stop-color="#f6c98e"/><stop offset="1" stop-color="#d9a066"/></linearGradient>
      <radialGradient id="lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd8a0" stop-opacity=".6"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient>
      <pattern id="stripe" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#fff4e6"/><rect width="20" height="40" fill="#e0573c"/></pattern>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <path d="M0 600 C180 540 320 580 460 550 C620 515 760 570 1000 530 V700 H0Z" fill="#e8a25a" opacity=".7"/>
    <path d="M-20 170 Q250 260 500 190 T1020 200" stroke="#7a4a2a" stroke-width="3" fill="none"/>
    ${[[80, 205], [210, 236], [345, 228], [470, 198], [600, 190], [730, 213], [860, 222], [970, 205]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y + 30}" r="52" fill="url(#lamp)"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 12}" stroke="#7a4a2a" stroke-width="3"/><ellipse cx="${x}" cy="${y + 32}" rx="18" ry="22" fill="#e2483a"/><rect x="${x - 8}" y="${y + 9}" width="16" height="6" fill="#6a3a1a"/><rect x="${x - 7}" y="${y + 52}" width="14" height="5" fill="#6a3a1a"/>`).join('')}
    <polygon points="-20,760 140,650 300,760" fill="url(#stripe)"/>
    <polygon points="250,780 420,660 590,780" fill="#f2c14a"/>
    <polygon points="540,770 720,640 900,770" fill="url(#stripe)"/>
    <polygon points="840,780 980,680 1060,780" fill="#5aa0c8"/>
    <rect x="0" y="760" width="1000" height="240" fill="#c99560"/>
    <g fill="#a87443">${[60, 330, 610, 880].map((x) => `<rect x="${x}" y="790" width="110" height="70" rx="4"/>`).join('')}</g>
    <g fill="#e2483a">${[90, 360, 640, 910].map((x) => `<circle cx="${x}" cy="785" r="10"/><circle cx="${x + 28}" cy="785" r="10" fill="#f2b632"/><circle cx="${x + 56}" cy="785" r="10" fill="#3f9a6a"/>`).join('')}</g>`,

  // 공방 · 눈 오는 낮: 밝은 자작나무 벽, 커다란 창밖 설경, 따뜻한 난로
  winter: `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c3a2"/><stop offset="1" stop-color="#bfa27c"/></linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9dcef"/><stop offset="1" stop-color="#eef4fa"/></linearGradient>
      <radialGradient id="stove" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb070" stop-opacity=".55"/><stop offset=".5" stop-color="#ffa060" stop-opacity=".18"/><stop offset="1" stop-color="#ffa060" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#sg)"/>
    <rect x="260" y="80" width="480" height="380" fill="url(#sky)"/>
    <path d="M260 300 L360 220 L450 290 L560 200 L680 300 L740 260 V460 H260Z" fill="#ffffff"/>
    <path d="M260 380 Q400 340 500 372 T740 360 V460 H260Z" fill="#f4f8fc"/>
    <g fill="#5c7a5a">${[330, 420, 610, 690].map((x) => `<polygon points="${x},390 ${x - 22},440 ${x + 22},440"/><polygon points="${x},370 ${x - 16},405 ${x + 16},405"/>`).join('')}</g>
    <rect x="260" y="80" width="480" height="380" fill="none" stroke="#8a5d36" stroke-width="22"/>
    <path d="M500 80v380M260 270h480" stroke="#8a5d36" stroke-width="12"/>
    <circle cx="160" cy="900" r="300" fill="url(#stove)"/>
    <rect x="95" y="760" width="120" height="150" rx="10" fill="#5a4a42"/>
    <rect x="120" y="800" width="70" height="45" rx="6" fill="#ff9a4a" opacity=".85"/>
    <rect x="140" y="600" width="26" height="165" fill="#5a4a42"/>
    <g fill="#7a5434">
      <rect x="800" y="140" width="10" height="120"/><polygon points="780,150 830,150 830,175 780,175"/>
      <rect x="860" y="150" width="70" height="14" rx="3"/><rect x="890" y="164" width="9" height="90"/>
    </g>
    <rect x="420" y="820" width="560" height="40" rx="4" fill="#a8763f"/>
    <rect x="450" y="860" width="26" height="140" fill="#8a5d36"/><rect x="930" y="860" width="26" height="140" fill="#8a5d36"/>
    <rect x="0" y="960" width="1000" height="40" fill="#9a7048"/>`,
};

// 떠다니는 효과 설정
const FX = {
  attic: { n: 46, color: () => `rgba(255, ${235 + Math.random() * 20 | 0}, 190, ${0.45 + Math.random() * 0.45})`, size: [1.2, 2.8], vy: [-0.08, 0.05], vx: [-0.06, 0.06], kind: 'dust' },
  summer: { n: 22, color: () => `rgba(255, 255, 255, ${0.7 + Math.random() * 0.3})`, size: [2, 3.4], vy: [-0.25, -0.08], vx: [0.1, 0.35], kind: 'seed' },
  autumn: { n: 22, color: () => ['#d9452a', '#e8782e', '#e2a83a', '#b8322a'][Math.random() * 4 | 0], size: [5, 9], vy: [0.35, 0.8], vx: [-0.3, 0.4], kind: 'leaf' },
  winter: { n: 70, color: () => `rgba(255, 255, 255, ${0.6 + Math.random() * 0.4})`, size: [1.4, 3.2], vy: [0.3, 0.9], vx: [-0.15, 0.15], kind: 'snow' },
};

const rnd = ([a, b]) => a + Math.random() * (b - a);
let current = null;
let raf = 0;
let parts = [];
let canvas = null;
let reduced = false;

let uid = 0;
/** 장면 SVG 마크업. 같은 화면에 여러 장면이 있어도 그라데이션 id가 겹치지 않게 접두어를 붙인다 */
export function sceneSVG(name, cls = '') {
  const p = `s${++uid}-`;
  const body = (SVG[name] || SVG.attic).replace(/id="([\w-]+)"/g, `id="${p}$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${p}$1)`);
  return `<svg class="${cls}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
}

/** 배경을 장면에 맞게 바꾼다(이전 장면 위로 새 장면이 천천히 겹쳐 나타남). root: 배경 요소 */
export function setScene(root, name) {
  if (!SVG[name]) name = 'attic';
  document.documentElement.dataset.scene = name;
  if (current === name) return;
  current = name;
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const art = root.querySelector('.scene-art');
  const layer = document.createElement('div');
  layer.className = 'scene-layer';
  layer.innerHTML = sceneSVG(name);
  art.append(layer);
  const old = [...art.children].slice(0, -1);
  if (reduced || !old.length) { old.forEach((n) => n.remove()); layer.classList.add('in'); }
  else {
    requestAnimationFrame(() => layer.classList.add('in'));
    setTimeout(() => old.forEach((n) => n.remove()), 1300);
  }
  canvas = root.querySelector('.scene-fx');
  resize();
  const fx = FX[name];
  parts = Array.from({ length: fx.n }, () => spawn(fx, true));
  cancelAnimationFrame(raf);
  if (reduced) draw(fx, 0);
  else loop(fx);
}

/** 지금 배경 장면 이름 */
export function currentScene() { return current; }

function spawn(fx, anywhere) {
  const w = canvas.width, h = canvas.height;
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : (fx.kind === 'leaf' || fx.kind === 'snow' ? -10 : h + 10),
    // 씨앗은 화면 왼쪽 아래에서 떠오른다
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
    } else if (fx.kind === 'seed') {
      g.globalAlpha = 0.9;
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 0.6 * dpr;
      for (let k = 0; k < 6; k++) {
        const a = p.rot + (k * Math.PI) / 3;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(a) * p.r * 2.2, p.y + Math.sin(a) * p.r * 2.2); g.stroke();
      }
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2); g.fill();
    } else {
      g.globalAlpha = 1;
      if (fx.kind === 'snow') { g.fillStyle = 'rgba(120,140,170,0.25)'; g.beginPath(); g.arc(p.x, p.y + 0.6 * dpr, p.r + 0.6 * dpr, 0, Math.PI * 2); g.fill(); }
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
      if (p.y > h + 20 || p.y < -20 || p.x < -20 || p.x > w + 20) parts[i] = spawn(fx, fx.kind === 'dust');
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
