import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
// BASE_URL을 주면 배포된 사이트를 대상으로 테스트한다 (예: https://always-nam.github.io/game_Roblox/)
const liveUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: liveUrl || 'http://127.0.0.1:4173/',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: liveUrl ? undefined : {
    command: 'npx http-server . -p 4173 -c-1 -s',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
