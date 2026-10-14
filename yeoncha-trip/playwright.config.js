import { defineConfig } from '@playwright/test';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: true, workers: 2,
  use: { baseURL: 'http://127.0.0.1:4179', headless: true, launchOptions: { executablePath }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4179', reuseExistingServer: true },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  reporter: 'list',
});
