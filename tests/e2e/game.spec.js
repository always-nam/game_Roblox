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
