import { test, expect } from '@playwright/test';
import { parseLevel, solve } from '../../src/engine.js';
import { eulerToMatrix, matrixToEuler, mul, axisRotation } from '../../src/motion.js';
import { LEVELS } from '../../src/levels.js';
import { WORKSHOP, WORKSHOP_BOX } from '../../src/workshop.js';

const solutionFor = (rows) => {
  const { level, state } = parseLevel(rows);
  return solve(level, state, { maxDepth: 40, maxNodes: 500000 }).moves;
};
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
// 저장 기록(v2: 단계 id로 기록)을 만들어 앞의 n단계를 깬 상태로
const clearedBest = (n, moves = 50) => Object.fromEntries(LEVELS.slice(0, n).map((l) => [l.id, moves]));
const idxOf = (id) => LEVELS.findIndex((l) => l.id === id);
/** 이전 1단계(L1 '첫 기울기': ↓로 벽까지 2칸 → →로 구멍)를 열어 시작한다 */
async function openL1(page) {
  const i = idxOf('L1');
  await page.evaluate((best) => localStorage.setItem('tilt-marble-v1', JSON.stringify({ v: 2, best })), clearedBest(i));
  await page.reload();
  await page.locator('.level-btn').nth(i).click();
}

async function waitIdle(page) {
  await page.waitForFunction(() => !window.__tilt.info().animating);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  // 이야기 장면 자동 재생은 이야기 전용 테스트에서만 확인한다
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('story-on')) window.__TILT_SKIP_STORY = true;
    if (!sessionStorage.getItem('title-on')) window.__TILT_SKIP_TITLE = true;   // 시작 화면은 전용 테스트에서만
  });
  await page.addInitScript((ids) => { window.__LV = ids; }, LEVELS.map((l) => l.id));
  await page.goto('index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('메뉴가 열리고 1단계만 잠금 해제되어 있다', async ({ page }) => {
  await expect(page.locator('#menu-title')).toBeVisible();
  await expect(page.locator('.level-btn')).toHaveCount(48);
  await expect(page.locator('.level-btn').first()).toBeEnabled();
  await expect(page.locator('.level-btn').nth(1)).toBeDisabled();
});

test('키보드로 1단계를 최소 수로 풀면 별 3개가 나오고 2단계가 열린다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#game')).toBeVisible();
  for (const d of solutionFor(LEVELS[0].rows)) {
    await page.keyboard.press(KEYS[d]);
    await waitIdle(page);
  }
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#dlg-stars span.on')).toHaveCount(3);
  await page.getByRole('button', { name: '다음 단계' }).click();
  await expect(page.locator('#hud-num')).toHaveText('1장 · 2단계');
  await page.locator('#btn-menu').click();
  await expect(page.locator('.level-btn').nth(1)).toBeEnabled();
});

test('되돌리기와 처음부터가 이동 수를 복원한다', async ({ page }) => {
  await openL1(page);
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await page.locator('#btn-undo').click();
  await expect(page.locator('#hud-moves')).toHaveText('0');
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await page.keyboard.press('r');
  await expect(page.locator('#hud-moves')).toHaveText('0');
});

test('함정에 빠지면 실패 창이 뜨고 되돌리기로 복구된다', async ({ page }) => {
  const i = idxOf('L5');                                 // '검은 함정': 구슬 바로 아래 함정
  await page.evaluate((best) => localStorage.setItem('tilt-marble-v1', JSON.stringify({ v: 2, best })), clearedBest(i));
  await page.reload();
  await page.locator('.level-btn').nth(i).click();
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#dlg-title')).toHaveText('함정에 빠졌어요');
  await page.getByRole('button', { name: '한 수 되돌리기' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect((await page.evaluate(() => window.__tilt.info())).status).toBe('playing');
});

test('화면의 방향 버튼으로도 풀 수 있다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  const names = { up: '위로 기울이기', down: '아래로 기울이기', left: '왼쪽으로 기울이기', right: '오른쪽으로 기울이기' };
  for (const d of solutionFor(LEVELS[0].rows)) {
    await page.getByRole('button', { name: names[d] }).click();
    await waitIdle(page);
  }
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('스와이프(포인터 드래그)로 기울일 수 있다', async ({ page }) => {
  await openL1(page);
  const box = await page.locator('#board').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const drag = async (dx, dy) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
    await waitIdle(page);
  };
  await drag(0, 80);   // down
  await drag(80, 0);   // right
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('오늘의 퍼즐이 열리고 자동 풀이로 완료할 수 있다', async ({ page }) => {
  await page.locator('#btn-daily').click();
  await expect(page.locator('#hud-name')).toHaveText('오늘의 퍼즐');
  const rows = await page.evaluate(() => window.__tilt.rows());
  for (const d of solutionFor(rows)) {
    await page.keyboard.press(KEYS[d]);
    await waitIdle(page);
  }
  await expect(page.locator('#overlay')).toBeVisible();
  await page.getByRole('button', { name: '단계 목록', exact: true }).click();
  await expect(page.locator('#daily-label')).toContainText('완료');
});

test('48단계(4장) 전체를 브라우저에서 순서대로 풀 수 있다', async ({ page }) => {
  test.setTimeout(360_000);
  await page.addInitScript(() => { window.__TILT_FAST = true; });   // 32단계를 빨리 돌리려고 연출만 생략
  await page.reload();
  await page.locator('#btn-continue').click();
  for (let i = 0; i < LEVELS.length; i++) {
    await expect(page.locator('#hud-num')).toHaveText(`${Math.floor(i / 12) + 1}장 · ${(i % 12) + 1}단계`);
    for (const d of solutionFor(LEVELS[i].rows)) {
      await page.keyboard.press(KEYS[d]);
      await waitIdle(page);
    }
    await expect(page.locator('#overlay')).toBeVisible();
    if (i % 12 === 11) {
      await page.locator('#dlg-actions .btn-primary').click();      // 할아버지 편지
      await expect(page.locator('#letter')).toBeVisible();
      while (await page.locator('#story').isVisible()) await page.locator('#story-next').click();
    } else {
      await page.getByRole('button', { name: '다음 단계' }).click();
    }
  }
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#star-total')).toHaveText('★ 144 / 144');
});

test('가로 스크롤이 없고 판이 화면 안에 들어온다', async ({ page }) => {
  for (const idx of [0, 15]) {
    await page.evaluate((data) => localStorage.setItem('tilt-marble-v1', JSON.stringify(data)), { v: 2, best: clearedBest(LEVELS.length, 99) });
    await page.reload();
    await page.locator('.level-btn').nth(idx).click();
    const vw = page.viewportSize().width, vh = page.viewportSize().height;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
    const frame = await page.locator('#frame').boundingBox();
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(vw);
    const pad = await page.locator('.dpad').boundingBox();
    expect(pad.y + pad.height).toBeLessThanOrEqual(vh);
    await page.locator('#btn-menu').click();
  }
});

test('저장소가 막혀 있어도 게임이 동작한다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto('index.html');
  await page.locator('.level-btn').first().click();
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('단일 파일 빌드(dist)도 그대로 실행된다', async ({ page }) => {
  const res = await page.goto(process.env.BASE_URL ? 'single.html' : 'dist/tilt-marble.html');
  test.skip(!res || !res.ok(), 'dist가 없습니다. npm run build를 먼저 실행하세요.');
  await page.locator('.level-btn').first().click();
  for (const d of solutionFor(LEVELS[0].rows)) {
    await page.keyboard.press(KEYS[d]);
    await waitIdle(page);
  }
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

// ---------- 휴대폰 기울기 조작 ----------
// 실제 휴대폰처럼 센서 값을 약 30ms 간격으로 계속 보낸다. 자세는 행렬로 만들어 정확한 각도로 바꾼다.
const posture = (pitch, alpha = 30) => eulerToMatrix(alpha, pitch, 0);
const turn = (R, axis, deg) => mul(R, axisRotation(axis, deg));

async function hold(page, R, ms) {
  const [alpha, beta, gamma] = matrixToEuler(R);
  await page.evaluate(async ([a, b, g, dur]) => {
    const end = performance.now() + dur;
    do {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g }));
      await new Promise((r) => setTimeout(r, 30));
    } while (performance.now() < end);
  }, [alpha, beta, gamma, ms]);
}
async function orient(page, gamma, beta, alpha = 0) {
  await page.evaluate(([g, b, a]) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g }));
  }, [gamma, beta, alpha]);
}
async function startMotion(page) {
  await openL1(page);
  await page.locator('#btn-motion').click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'true');
}

test('PC(터치 없음)에서는 기울기 버튼이 보이지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, 'PC 전용');
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-motion')).toBeHidden();
});

test('[실기기 사례] 버튼을 누를 때 흔들려도, 63°로 들고 쟁반처럼 기울여 1단계를 푼다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(63);
  await hold(page, turn(posture(40), 'y', 28), 60);   // 누르는 순간의 출렁임
  await expect(page.locator('#meter')).toHaveClass(/calib/);
  await hold(page, base, 450);                         // 편하게 들고 멈춤 → 기준
  await expect(page.locator('#meter')).not.toHaveClass(/calib/);
  await hold(page, turn(base, 'x', 16), 450);          // 아래
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await hold(page, base, 200);                         // 돌아옴
  await hold(page, turn(base, 'y', 15), 450);          // 오른쪽 15° (쟁반 기울이기)
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('세워 든 상태(85°)에서 앞으로 젖히기·핸들 돌리기로 1단계를 푼다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(85);
  await hold(page, base, 450);
  await hold(page, turn(base, 'x', 16), 450);          // 세로를 지나 아래
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await hold(page, base, 200);
  await hold(page, turn(base, 'z', -16), 450);         // 시계 방향으로 돌림 → 오른쪽
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('[요청] 대각선으로 한 번 기울이면 두 방향으로 흘러가 1단계가 풀린다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(60);
  await hold(page, base, 450);
  await hold(page, turn(turn(base, 'x', 11), 'y', 11), 2600);   // 아래·오른쪽 대각선으로 기울인 채 유지
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('[요청] 정중앙으로 돌아오지 않고 아래 → 오른쪽으로 바로 옮겨도 이어서 움직인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(60);
  await hold(page, base, 450);
  await hold(page, turn(base, 'x', 16), 500);                   // 아래
  await hold(page, turn(turn(base, 'x', 10), 'y', 16), 1300);    // 아래를 조금 남긴 채 오른쪽으로
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('되돌리기 직후에는 판을 수평으로 돌릴 때까지 다시 움직이지 않는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(60);
  await hold(page, base, 450);
  const down = turn(base, 'x', 16);
  await hold(page, down, 300);
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await page.locator('#btn-undo').click();
  await hold(page, down, 400);                                  // 아직 기울인 채: 다시 움직이지 않음
  await expect(page.locator('#hud-moves')).toHaveText('0');
  await hold(page, base, 200);                                  // 수평으로
  await hold(page, down, 300);
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('기울인 채 있으면 한 번만 움직인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  const base = posture(50);
  await hold(page, base, 450);
  await hold(page, turn(base, 'x', 20), 800);
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('감도를 바꾸면 그 각도부터 입력된다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  await expect(page.locator('#sens')).toBeVisible();
  await page.getByRole('button', { name: '민감' }).click();
  await expect(page.getByRole('button', { name: '민감' })).toHaveAttribute('aria-pressed', 'true');
  const base = posture(45);
  await hold(page, base, 450);
  await hold(page, turn(base, 'x', 10), 450);          // 민감(8°)이면 10°로 충분
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await page.getByRole('button', { name: '둔하게' }).click();
  await hold(page, turn(base, 'x', 10), 450);          // 새 기준 잡기
  await hold(page, turn(base, 'y', 12), 150);          // 둔하게(18°)에서는 12° 무시
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('기울기 설정은 다음 단계에서도 유지되고, 끌 수 있다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  await hold(page, posture(30), 100);
  await page.locator('#btn-menu').click();
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-motion').click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'false');
  const base = posture(30);
  await hold(page, base, 450);
  await hold(page, turn(base, 'x', 25), 150);
  await expect(page.locator('#hud-moves')).toHaveText('0');
});

test('수평계를 누르면 기준을 다시 잡는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  await hold(page, posture(30), 450);
  await page.locator('#meter').click();
  await expect(page.locator('#meter')).toHaveClass(/calib/);
  await expect(page.locator('#hint')).toContainText('다시 잡습니다');
  const base = posture(45);
  await hold(page, base, 450);                         // 새 자세로 기준
  await hold(page, turn(base, 'x', 6), 150);           // 새 기준에서 6° → 입력 없음
  await expect(page.locator('#hud-moves')).toHaveText('0');
});

test('센서 값이 오지 않으면 스스로 꺼지고 안내한다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 });
  await expect(page.locator('#hint')).toContainText('기울기 센서 값을 받을 수 없습니다');
});

// ---------- 앱 설치(PWA) ----------
test('앱 매니페스트와 아이콘이 올바르다', async ({ page, request }) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await request.get(new URL(href, page.url()).href);
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.name).toBe('틸트 구슬판');
  expect(m.display).toBe('fullscreen');
  for (const icon of m.icons) {
    const r = await request.get(new URL(icon.src, page.url()).href);
    expect(r.ok(), icon.src).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBeTruthy();
});

test('한 번 연 뒤에는 인터넷 없이도 실행된다(오프라인)', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();               // 서비스 워커가 페이지를 제어하는 상태로 다시 열기
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.level-btn').first().click();
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await context.setOffline(false);
});

test('전체 화면 버튼으로 전체 화면을 켜고 끌 수 있다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  const btn = page.locator('#btn-full');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
});

test('판이 화면을 넉넉히 채운다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  const vp = page.viewportSize();
  const frame = await page.locator('#frame').boundingBox();
  // 5×5 판: 화면의 짧은 쪽 기준으로 절반 이상을 차지해야 한다
  expect(Math.max(frame.width, frame.height)).toBeGreaterThan(Math.min(vp.width, vp.height) * 0.5);
});

test('넓은 화면에서는 판이 왼쪽, 조작부가 오른쪽에 놓인다', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.locator('.level-btn').first().click();
  const frame = await page.locator('#frame').boundingBox();
  const pad = await page.locator('.dpad').boundingBox();
  expect(pad.x).toBeGreaterThan(frame.x + frame.width);
  expect(frame.height).toBeGreaterThan(550);
});

test('[요청] 구슬이 실제 공처럼 천천히 굴러간다: 점점 빨라지고, 무늬가 돌고, 벽에서 튕긴다', async ({ page }) => {
  await openL1(page);
  await page.keyboard.press('ArrowDown');            // 1단계: 구슬이 2칸 굴러가 벽에 멈춘다
  const info = await page.evaluate(() => {
    const piece = document.querySelector('.piece.marble');
    const [move] = piece.getAnimations();
    const [spin] = piece.querySelector('.ball').getAnimations();
    const kf = move.effect.getKeyframes();
    return {
      duration: move.effect.getTiming().duration,
      easing: kf[0].easing,
      frames: kf.length,
      squash: kf[1].transform,
      spin: spin ? spin.effect.getKeyframes().map((f) => f.backgroundPosition) : null,
    };
  });
  expect(info.duration).toBeGreaterThanOrEqual(380);  // 이전 180ms → 약 2배 이상
  expect(info.easing).toContain('cubic-bezier(0.55');  // 출발은 느리게, 점점 빠르게
  expect(info.frames).toBe(4);                          // 이동 → 부딪힘 → 튕김 → 멈춤
  expect(info.squash).toContain('scale(');
  expect(info.spin[0]).not.toBe(info.spin[1]);          // 표면 무늬가 굴러간 만큼 돈다
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('[요청] 원점은 저장되어, 기운 채로 다음 단계를 시작하면 바로 그쪽으로 흐른다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await startMotion(page);
  await hold(page, posture(55), 450);                       // 원점(앞뒤 55°) 잡기
  await expect(page.locator('#meter')).not.toHaveClass(/calib/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tilt-marble-v1')).origin.pitch)).toBeCloseTo(55, 0);
  await page.locator('#btn-menu').click();
  await hold(page, turn(posture(55), 'y', 18), 100);         // 오른쪽으로 기운 채
  await page.locator('.level-btn').first().click();          // 다시 시작
  await hold(page, turn(posture(55), 'y', 18), 900);         // 계속 기운 채 → 원점은 그대로라 오른쪽으로 흐름
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await expect(page.locator('#meter')).not.toHaveClass(/calib/);
});

test('저장된 원점은 새로고침 뒤에도 유지된다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({ motion: true, origin: { pitch: 40, angle: 0 } })));
  await page.reload();
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();                 // 켜기(이전 설정이 켜짐이면 한 번 더 누를 필요 없음)
  if ((await page.locator('#btn-motion').getAttribute('aria-pressed')) !== 'true') await page.locator('#btn-motion').click();
  await hold(page, posture(57), 600);                        // 원점 40°에서 17° 젖힘 → 바로 아래
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

// ---------- 소리 ----------
test('[요청] 굴러가는 소리·벽 소리·구멍 소리·성공 소리가 난다', async ({ page }) => {
  await openL1(page);
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  let s = await page.evaluate(() => window.__tilt.sound());
  expect(s.enabled).toBe(true);
  expect(s.roll).toBeGreaterThanOrEqual(1);
  expect(s.hit).toBeGreaterThanOrEqual(1);
  await page.keyboard.press('ArrowRight');                   // 구멍에 쏙 → 성공
  await waitIdle(page);
  await expect(page.locator('#overlay')).toBeVisible();
  s = await page.evaluate(() => window.__tilt.sound());
  expect(s.hole).toBeGreaterThanOrEqual(1);
  expect(s.win).toBe(1);
});

test('소리 버튼으로 끄면 소리가 나지 않고, 설정이 저장된다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-sound').click();
  await expect(page.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');
  const before = await page.evaluate(() => window.__tilt.sound().roll);
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  expect(await page.evaluate(() => window.__tilt.sound().roll)).toBe(before);
  await page.reload();
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');
});

// ---------- 스토리 모드 ----------
async function storyOn(page) {
  await page.evaluate(() => sessionStorage.setItem('story-on', '1'));
  await page.reload();
}

test('[스토리] 처음 시작하면 1장 이야기가 나오고, 끝까지 넘기면 1장 1단계가 시작된다', async ({ page }) => {
  await storyOn(page);
  await expect(page.locator('#btn-continue')).toHaveText('이야기 시작하기');
  await page.locator('#btn-continue').click();
  await expect(page.locator('#story')).toBeVisible();
  await expect(page.locator('#story-place')).toContainText('1장 · 다락방의 상자');
  await expect(page.locator('#story-text')).toContainText('여름방학');
  expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBe('attic');
  for (let k = 0; k < 4; k++) await page.locator('#story-next').click();
  await expect(page.locator('#story-next')).toHaveText('시작하기');
  await page.locator('#story-next').click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#hud-num')).toHaveText('1장 · 1단계');
  // 이미 본 이야기는 다시 나오지 않는다
  await page.locator('#btn-menu').click();
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#story')).toBeHidden();
});

test('[스토리] 장의 마지막 단계를 풀면 할아버지 편지 → 다음 장 이야기 → 다음 장 배경으로 이어진다', async ({ page }) => {
  await storyOn(page);
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({
    v: 2, best: Object.fromEntries(window.__LV.slice(0, 11).map((id) => [id, 50])), seen: { 'intro-0': true },
  })));
  await page.reload();
  await page.evaluate(() => { window.__TILT_FAST = true; });
  await page.locator('.level-btn').nth(11).click();
  for (const d of solutionFor(LEVELS[11].rows)) { await page.keyboard.press(KEYS[d]); await waitIdle(page); }
  await page.getByRole('button', { name: '할아버지의 편지 읽기' }).click();
  await expect(page.locator('#letter-title')).toHaveText('첫 번째 편지');
  await expect(page.locator('#letter-body')).toContainText('대청마루');
  await page.locator('#story-next').click();
  await expect(page.locator('#story-place')).toContainText('2장 · 여름 대청마루');
  expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBe('summer');
  await page.locator('#story-skip').click();
  await expect(page.locator('#hud-num')).toHaveText('2장 · 1단계');
});

test('[스토리] 앞 장을 마치지 않으면 다음 장은 잠겨 있고, 열린 장은 이야기를 다시 볼 수 있다', async ({ page }) => {
  await storyOn(page);
  await expect(page.locator('.chapter').nth(0)).not.toHaveClass(/locked/);
  await expect(page.locator('.chapter').nth(1)).toHaveClass(/locked/);
  await expect(page.locator('.level-btn').nth(12)).toBeDisabled();
  await page.locator('.chapter').nth(0).getByRole('button', { name: '이야기 다시 보기' }).click();
  await expect(page.locator('#story')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();
});

test('[스토리] 4장에는 색깔 문이 그려지고 겨울 공방 배경이 나온다', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({
    v: 2, best: Object.fromEntries(window.__LV.slice(0, 36).map((id) => [id, 50])),
  })));
  await page.reload();
  await page.locator('.level-btn').nth(36).click();
  await expect(page.locator('#hud-num')).toHaveText('4장 · 1단계');
  await expect(page.locator('.cell.gate')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBe('winter');
});

// ---------- 시작 화면 · 배경음악 ----------
async function titleOn(page) {
  await page.evaluate(() => sessionStorage.setItem('title-on', '1'));
  await page.reload();
}

test('[시작 화면] 글자 조각·구슬·시연 판이 움직이고, 누르면 장 선택으로 간다', async ({ page }) => {
  await titleOn(page);
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('.title-logo .tile')).toHaveCount(5);
  await expect(page.locator('#title')).toHaveClass(/play/);
  // 시연 판이 실제 퍼즐을 스스로 푼다(구슬이 움직임)
  const demo = await page.evaluate(() => window.__tilt.demo());
  expect(demo.running).toBe(true);
  expect(demo.steps).toBeGreaterThan(3);
  const before = await page.locator('#demo-board .piece.marble').first().getAttribute('style');
  await page.waitForTimeout(3200);
  const after = await page.locator('#demo-board .piece.marble').first().getAttribute('style');
  expect(after).not.toBe(before);
  await page.locator('#btn-start').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#title')).toBeHidden();
  expect((await page.evaluate(() => window.__tilt.demo())).running).toBe(false);
});

test('[시작 화면] 배경이 계절마다 바뀐다', async ({ page }) => {
  await titleOn(page);
  expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBe('attic');
  await page.waitForTimeout(6800);
  expect(await page.evaluate(() => document.documentElement.dataset.scene)).toBe('summer');
});

test('[음악] 화면을 누르면 음악이 시작되고, 장소에 따라 곡이 바뀌며, 끌 수 있다', async ({ page }) => {
  await titleOn(page);
  await page.locator('#btn-start').click();
  await page.waitForTimeout(1200);
  let m = await page.evaluate(() => window.__tilt.music());
  expect(m.track).toBe('title');
  expect(m.playing).toBe(true);
  expect(m.notes).toBeGreaterThan(0);
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({
    v: 2, best: Object.fromEntries(window.__LV.slice(0, 24).map((id) => [id, 50])), seen: { 'intro-2': true },
  })));
  await page.evaluate(() => sessionStorage.removeItem('title-on'));
  await page.reload();
  await page.locator('.level-btn').nth(24).click();
  await page.waitForTimeout(600);
  m = await page.evaluate(() => window.__tilt.music());
  expect(m.track).toBe('autumn');
  await page.locator('#btn-music').click();
  await expect(page.locator('#btn-music')).toHaveAttribute('aria-pressed', 'false');
  m = await page.evaluate(() => window.__tilt.music());
  expect(m.playing).toBe(false);
  await page.reload();
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-music')).toHaveAttribute('aria-pressed', 'false');
});

test('[장 선택] 장마다 그림 카드가 있고, 놀이 방법을 볼 수 있다', async ({ page }) => {
  await expect(page.locator('.chapter .chapter-art svg')).toHaveCount(4);
  await page.locator('#btn-howto').click();
  await expect(page.locator('#howto')).toBeVisible();
  await expect(page.locator('#howto .rules li')).toHaveCount(4);
  await page.locator('#howto-close').click();
  await expect(page.locator('#howto')).toBeHidden();
});

test('[S26 사례] 기기의 \'움직임 줄이기\'가 켜져 있어도 구슬은 순간이동하지 않고 굴러간다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await openL1(page);
  await page.keyboard.press('ArrowDown');            // 1단계: 구슬이 1칸 → 3칸으로 굴러간다
  // 화면 갱신 속도(테스트 기계 부하)와 무관하게, 굴러가기 애니메이션을 25·50·75% 지점에 멈춰 위치를 잰다
  const info = await page.evaluate(() => {
    const el = document.querySelector('.piece.marble');
    const cell = parseFloat(getComputedStyle(document.getElementById('app')).getPropertyValue('--cell'));
    const move = el.getAnimations().find((x) => !(x instanceof CSSTransition));
    const duration = move.effect.getTiming().duration;
    move.pause();
    const at = [0.25, 0.5, 0.75].map((f) => {
      move.currentTime = duration * f;
      return new DOMMatrix(getComputedStyle(el).transform).m42 / cell;
    });
    move.play();
    return { duration, frames: move.effect.getKeyframes().length, at };
  });
  expect(info.duration).toBeGreaterThanOrEqual(300);   // 굴러가는 시간은 그대로
  expect(info.frames).toBe(2);                          // 튕김·찌그러짐(꾸밈)만 생략
  for (const y of info.at) { expect(y).toBeGreaterThan(1.02); expect(y).toBeLessThan(2.98); }
  expect(info.at[0]).toBeLessThan(info.at[1]);          // 점점 빨라지며 앞으로
  expect(info.at[1]).toBeLessThan(info.at[2]);
  expect(info.at[2] - info.at[1]).toBeGreaterThan(info.at[1] - info.at[0]);   // 가속(등가속 구르기)
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

// ---------- 쉬운 시작 · 길잡이 · 힌트 ----------
test('[요청] 첫 연습 단계는 한 번만 기울이면 되고, 길잡이 화살표가 방향을 알려 준다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#hud-name')).toHaveText('아래로 기울이기');
  await expect(page.locator('#guide')).toBeVisible();
  expect((await page.evaluate(() => window.__tilt.guide())).dir).toBe('down');
  await expect(page.locator('#hint')).toContainText('몸 쪽으로');
  await page.keyboard.press('ArrowDown');
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('길잡이는 움직일 때마다 다음 방향으로 바뀐다', async ({ page }) => {
  await page.evaluate((best) => localStorage.setItem('tilt-marble-v1', JSON.stringify({ v: 2, best })), clearedBest(2));
  await page.reload();
  await page.locator('.level-btn').nth(2).click();           // '두 번 기울이기'
  const first = (await page.evaluate(() => window.__tilt.guide())).dir;
  await page.keyboard.press(KEYS[first]);
  await waitIdle(page);
  const second = await page.evaluate(() => window.__tilt.guide());
  expect(second.visible).toBe(true);
  expect(second.dir).not.toBe(first);
  await page.keyboard.press(KEYS[second.dir]);
  await waitIdle(page);
  await expect(page.locator('#overlay')).toBeVisible();
});

test('[요청] 어려운 단계에서는 [힌트]를 누르면 다음 방향을 알려 준다', async ({ page }) => {
  await openL1(page);
  await expect(page.locator('#guide')).toBeHidden();         // 연습 단계가 아니면 자동으로는 안 보임
  await page.locator('#btn-hint').click();
  const g = await page.evaluate(() => window.__tilt.guide());
  expect(g.visible).toBe(true);
  expect(solutionFor(LEVELS[idxOf('L1')].rows)[0]).toBe(g.dir);
  await expect(page.locator('#hint')).toContainText('남은 최소');
  await page.keyboard.press(KEYS[g.dir]);
  await waitIdle(page);
  await expect(page.locator('#guide')).toBeHidden();         // 움직이면 사라짐
});

test('이전 버전 기록(단계 번호)은 새 단계 id로 옮겨진다', async ({ page }) => {
  // 이전 버전에서 1~4단계를 깬 기록
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({ best: { 0: 2, 1: 3, 2: 5, 3: 3 } })));
  await page.reload();
  for (const id of ['L1', 'L2', 'L3', 'L4']) {
    const b = page.locator('.level-btn').nth(idxOf(id));
    await expect(b).toBeEnabled();
    await expect(b.locator('.s i')).toHaveCount(3);          // 별 표시 = 기록 있음
  }
  await expect(page.locator('#star-total')).not.toHaveText('★ 0 / 144');
  await expect(page.locator('.level-btn').first()).toBeEnabled();   // 새 연습 단계도 바로 할 수 있다
});

// ---------- 공방 1000단계 ----------
// 사람이 1000판을 다 해 볼 수 없으므로, 판 자체는 단위 테스트가 풀이기로 전부 검증하고
// 여기서는 '실제 화면에서 로봇이 손가락 대신 키를 눌러' 상자마다 판을 골라 풀어 본다.
const wsBest = (n, moves = 99) => Object.fromEntries(WORKSHOP.slice(0, n).map((l) => [l.id, moves]));
async function openWs(page, i) {
  await page.evaluate((best) => localStorage.setItem('tilt-marble-v1', JSON.stringify({ v: 2, best })), wsBest(i));
  await page.reload();
  await page.locator('#btn-workshop').click();
  await expect(page.locator('#workshop')).toBeVisible();
  const box = Math.floor(i / WORKSHOP_BOX);
  await page.locator(`.ws-box[data-box="${box}"]`).click();
  await page.locator(`#ws-grid .level-btn[data-ws="${i}"]`).click();
  await expect(page.locator('#hud-num')).toHaveText(`공방 ${i + 1}단계`);
}
async function playSolution(page, i) {
  for (const d of WORKSHOP[i].solution) {
    await page.keyboard.press(KEYS[d]);
    await waitIdle(page);
  }
}

test('공방: 처음엔 1번 상자의 첫 판만 열려 있고, 풀면 다음 판이 열린다', async ({ page }) => {
  await expect(page.locator('#ws-label')).toHaveText('0 / 1000');
  await page.locator('#btn-workshop').click();
  await expect(page.locator('.ws-box')).toHaveCount(20);
  await expect(page.locator('.ws-box[data-box="0"]')).toBeEnabled();
  await expect(page.locator('.ws-box[data-box="1"]')).toBeDisabled();
  await expect(page.locator('#ws-grid .level-btn')).toHaveCount(50);
  await expect(page.locator('#ws-grid .level-btn').nth(0)).toBeEnabled();
  await expect(page.locator('#ws-grid .level-btn').nth(1)).toBeDisabled();
  await page.locator('#ws-grid .level-btn').nth(0).click();
  await playSolution(page, 0);
  await expect(page.locator('#dlg-stars span.on')).toHaveCount(3);
  await page.getByRole('button', { name: '다음 단계' }).click();
  await expect(page.locator('#hud-num')).toHaveText('공방 2단계');
  await page.locator('#btn-menu').click();                     // 공방 게임에서 나가면 공방 목록으로
  await expect(page.locator('#workshop')).toBeVisible();
  await expect(page.locator('#ws-grid .level-btn').nth(1)).toBeEnabled();
  await expect(page.locator('#ws-stars')).toHaveText('★ 3 / 3000');
});

test('공방: 50판을 다 풀어야 다음 상자가 열리고, 상자의 마지막 판을 풀면 상자 완성', async ({ page }) => {
  await page.addInitScript(() => { window.__TILT_FAST = true; });
  await openWs(page, 49);
  await expect(page.locator('#hud-name')).toHaveText('1번 상자 · 50번째 판');
  await playSolution(page, 49);
  await expect(page.locator('#dlg-text')).toContainText('1번 상자 완성');
  await page.getByRole('button', { name: '단계 목록', exact: true }).click();
  await expect(page.locator('.ws-box[data-box="1"]')).toBeEnabled();
  await expect(page.locator('.ws-box[data-box="2"]')).toBeDisabled();
});

test('[1000단계 표본] 상자마다 첫 판·마지막 판을 실제 화면에서 최소 수로 풀어 본다', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '표본 풀기는 PC 한 곳에서만(판 검증은 단위 테스트가 1000판 전부 함)');
  test.setTimeout(240_000);
  await page.addInitScript(() => { window.__TILT_FAST = true; });
  const sample = [];
  for (let b = 0; b < 20; b++) sample.push(b * WORKSHOP_BOX, b * WORKSHOP_BOX + WORKSHOP_BOX - 1);
  for (const i of sample) {
    await openWs(page, i);
    await playSolution(page, i);
    await expect(page.locator('#overlay'), `공방 ${i + 1}단계`).toBeVisible();
    await expect(page.locator('#dlg-stars span.on'), `공방 ${i + 1}단계 별`).toHaveCount(3);
    await expect(page.locator('#hud-moves')).toHaveText(String(WORKSHOP[i].par));
  }
});

test('앱 대비: 웹에서는 광고 없이 힌트가 바로 나오고 앱 전용 기능은 꺼져 있다', async ({ page }) => {
  await page.locator('#btn-workshop').click();
  await page.locator('#ws-grid .level-btn').nth(0).click();
  await page.locator('#btn-hint').click();
  await expect(page.locator('#guide')).toBeVisible();
  expect(await page.evaluate(() => !!window.Capacitor)).toBe(false);
});
