// 오프라인 실행용 서비스 워커.
// 게임 파일: 네트워크 우선(새 버전 즉시 반영) → 실패 시 캐시. 글꼴: 캐시 우선.
const CACHE = 'tilt-marble-v14';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'src/main.js', 'src/engine.js', 'src/levels.js', 'src/generator.js', 'src/motion.js', 'src/anim.js', 'src/sound.js', 'src/story.js', 'src/scenery.js', 'src/music.js', 'src/title.js', 'src/platform.js', 'src/workshop.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tilt-marble-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // 저장해 둔 사본: 그 파일이 없으면(첫 화면 요청 등) index.html
  const cached = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }
    // GitHub 서버 장애(5xx, 유니콘 화면)일 때는 한 번이라도 받아 둔 사본으로 게임을 연다
    if (res.status >= 500) return cached().then((hit) => hit || res);
    return res;
  }).catch(() => cached().then((hit) => hit || Response.error())));
});
