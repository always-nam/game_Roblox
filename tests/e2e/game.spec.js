import { test, expect } from '@playwright/test';
import { parseLevel, solve } from '../../src/engine.js';
import { LEVELS } from '../../src/levels.js';

const solutionFor = (rows) => {
  const { level, state } = parseLevel(rows);
  return solve(level, state, { maxDepth: 40, maxNodes: 500000 }).moves;
};
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

async function waitIdle(page) {
  await page.waitForFunction(() => !window.__tilt.info().animating);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await page.goto('index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('메뉴가 열리고 1단계만 잠금 해제되어 있다', async ({ page }) => {
  await expect(page.locator('#menu-title')).toBeVisible();
  await expect(page.locator('.level-btn')).toHaveCount(16);
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
  await expect(page.locator('#hud-num')).toHaveText('2단계');
  await page.locator('#btn-menu').click();
  await expect(page.locator('.level-btn').nth(1)).toBeEnabled();
});

test('되돌리기와 처음부터가 이동 수를 복원한다', async ({ page }) => {
  await page.locator('.level-btn').first().click();
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
  await page.evaluate(() => localStorage.setItem('tilt-marble-v1', JSON.stringify({ best: { 0: 2, 1: 3, 2: 5, 3: 3 } })));
  await page.reload();
  await page.locator('.level-btn').nth(4).click(); // 5단계: 구슬 바로 아래 함정
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
  await page.locator('.level-btn').first().click();
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

test('16단계 전체를 브라우저에서 순서대로 풀 수 있다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('#btn-continue').click();
  for (let i = 0; i < LEVELS.length; i++) {
    await expect(page.locator('#hud-num')).toHaveText(`${i + 1}단계`);
    for (const d of solutionFor(LEVELS[i].rows)) {
      await page.keyboard.press(KEYS[d]);
      await waitIdle(page);
    }
    await expect(page.locator('#overlay')).toBeVisible();
    if (i < LEVELS.length - 1) await page.getByRole('button', { name: '다음 단계' }).click();
  }
  await page.getByRole('button', { name: '단계 목록', exact: true }).click();
  await expect(page.locator('#star-total')).toHaveText('★ 48 / 48');
});

test('가로 스크롤이 없고 판이 화면 안에 들어온다', async ({ page }) => {
  for (const idx of [0, 15]) {
    await page.evaluate((best) => localStorage.setItem('tilt-marble-v1', JSON.stringify({ best })), Object.fromEntries([...Array(16)].map((_, i) => [i, 99])));
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
// 실제 자세(앞뒤 pitch, 좌우 roll, 도) → 브라우저가 보내는 beta/gamma 값
function eulerFrom(pitch, roll) {
  const r = Math.PI / 180;
  const up = { x: -Math.sin(roll * r), y: Math.cos(roll * r) * Math.sin(pitch * r), z: Math.cos(roll * r) * Math.cos(pitch * r) };
  const beta = Math.asin(Math.max(-1, Math.min(1, up.y))) / r;
  const gamma = Math.atan2(-up.x, up.z) / r;
  return beta >= 0 && up.z < 0 ? [180 - beta, gamma > 0 ? gamma - 180 : gamma + 180] : [beta, gamma];
}
async function pose(page, pitch, roll) {
  const [beta, gamma] = eulerFrom(pitch, roll);
  await orient(page, gamma, beta);
}
async function orient(page, gamma, beta) {
  await page.evaluate(([g, b]) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: g }));
  }, [gamma, beta]);
}

test('PC(터치 없음)에서는 기울기 버튼이 보이지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, 'PC 전용');
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-motion')).toBeHidden();
});

test('휴대폰을 기울여 1단계를 풀 수 있다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  const btn = page.locator('#btn-motion');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await orient(page, 2, 35);    // 비스듬히 든 상태 → 수평 기준
  await orient(page, 2, 55);    // 앞쪽을 20° 들어 올림 → 아래
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await orient(page, 2, 50);    // 아직 기준 근처로 안 돌아옴 → 무시
  await orient(page, 25, 50);
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await orient(page, 3, 36);    // 기준 근처로 복귀 → 다시 받을 준비
  await orient(page, 24, 36);   // 오른쪽으로 22° → 오른쪽
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('기울기 설정은 다음 단계에서도 유지되고, 끌 수 있다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();
  await orient(page, 0, 30);
  await page.locator('#btn-menu').click();
  await page.locator('.level-btn').first().click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-motion').click();
  await expect(page.locator('#btn-motion')).toHaveAttribute('aria-pressed', 'false');
  await orient(page, 0, 0);
  await orient(page, 0, 40);
  await page.waitForTimeout(300);
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

test('세워 든 상태(80°)에서 앞쪽으로 젖혀도 아래로 기울어진다 (폴드 사례)', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();
  await expect(page.locator('#meter')).toBeVisible();
  await pose(page, 80, 0);       // 거의 세워서 든 상태 → 기준
  await pose(page, 97, 0);       // 세로를 지나 17° 더 젖힘 → 아래
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
  await pose(page, 82, 0);       // 돌아옴
  await pose(page, 82, 18);      // 세운 채로 핸들처럼 오른쪽으로 18° 돌림 → 오른쪽
  await waitIdle(page);
  await expect(page.locator('#dlg-title')).toHaveText('완벽해요!');
});

test('세로를 지난 자세를 다른 각도 표현(beta 감소·gamma 뒤집힘)으로 보내도 아래가 된다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();
  await orient(page, 1, 80);
  await orient(page, -179, 180 - 97);   // 97°를 beta 83°, gamma -179°로 표현하는 브라우저
  await waitIdle(page);
  await expect(page.locator('#hud-moves')).toHaveText('1');
});

test('수평계를 누르면 지금 각도가 새 기준이 된다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '휴대폰 전용');
  await page.locator('.level-btn').first().click();
  await page.locator('#btn-motion').click();
  await orient(page, 0, 20);
  await orient(page, 0, 30);          // 10°: 아직 아님
  await page.locator('#meter').click(); // 30°를 새 기준으로
  await orient(page, 0, 30);
  await orient(page, 0, 40);          // 새 기준에서 10° → 입력 없음
  await page.waitForTimeout(200);
  await expect(page.locator('#hud-moves')).toHaveText('0');
  await expect(page.locator('#hint')).toContainText('다시 잡았습니다');
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
