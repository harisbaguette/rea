import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const health = {
  status: 'ok', api_version: '1', csrf_token: 'test-only-local-token',
  runtime: { device: 'cuda', gpu_name: '테스트 계약 장치', vram_gb: 16 },
  models: [
    { id: 'fashn', name: '테스트 사진 어댑터', ready: true, reason: null, capability: 'snapshot' },
    { id: 'turbo', name: '테스트 라이브 어댑터', ready: true, reason: null, capability: 'live' },
  ], active_job_id: null,
};
const job = (status, id = 'contract_job', extra = {}) => ({
  id, status, stage: '테스트 전용 응답', elapsed_ms: 200,
  inference_ms: status === 'succeeded' ? 100 : null,
  result_url: status === 'succeeded' ? `/api/jobs/${id}/image` : null,
  error: null, ...extra,
});

async function ready(page) {
  await page.route('**/api/health', (route) => route.fulfill({ json: health }));
}

async function inputs(page) {
  await page.getByTestId('person-input').setInputFiles(fixture('person.png').pathname);
  await page.getByTestId('garment-input').setInputFiles(fixture('garment.png').pathname);
}

async function imageResponse(route) {
  await route.fulfill({ contentType: 'image/png', body: await readFile(fixture('result.png')) });
}

test('엔진 없이도 이미지 준비가 되고 전송·영구저장이 없다', async ({ page }) => {
  let posted = 0;
  await page.route('**/api/**', (route) => {
    if (route.request().method() === 'POST') posted++;
    return route.fulfill({ status: 503, json: { error: { code: 'device_unavailable', message: '테스트: 엔진 없음' } } });
  });
  await page.goto('/');
  await expect(page.getByTestId('connection-status')).toContainText(/연결/);
  await inputs(page);
  await expect(page.getByTestId('generate')).toBeDisabled();
  expect(posted).toBe(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.screenshot({ path: '../evidence/frontend-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByTestId('person-input')).toHaveJSProperty('value', '');
  await expect(page.getByTestId('garment-input')).toHaveJSProperty('value', '');
});

test('실패해도 입력을 보존하고 재시도·결과 비교·다운로드가 된다', async ({ page }) => {
  await ready(page);
  let posts = 0;
  await page.route('**/api/jobs', async (route) => {
    expect(route.request().headers()['x-local-token']).toBe(health.csrf_token);
    expect(route.request().postData()).toContain('name="person"');
    expect(route.request().postData()).toContain('name="garment"');
    if (++posts === 1) {
      await route.fulfill({ status: 429, json: { error: { code: 'engine_busy', message: '테스트: 다른 작업' } } });
    } else await route.fulfill({ status: 202, json: job('queued') });
  });
  await page.route('**/api/jobs/contract_job', (route) => route.fulfill({ json: job('succeeded') }));
  await page.route('**/api/jobs/contract_job/image', imageResponse);
  await page.goto('/');
  await inputs(page);
  await expect(page.getByTestId('generate')).toBeEnabled();
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('status-message')).toContainText(/다른 작업/);
  await expect(page.getByTestId('person-preview')).toBeVisible();
  await expect(page.getByTestId('garment-preview')).toBeVisible();
  await page.getByTestId('reconnect').click();
  await expect(page.getByTestId('generate')).toBeEnabled();
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('result-image')).toBeVisible();
  await expect(page.getByTestId('result-download')).toBeEnabled();
  await page.getByTestId('result-original').click();
  await page.getByTestId('result-generated').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('result-download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(posts).toBe(2);
});

test('손상·과대 이미지와 실행 가능한 SVG 입력을 거부한다', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  await page.getByTestId('person-input').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByTestId('person-error')).not.toHaveText('');
  await page.getByTestId('person-input').setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
  await expect(page.getByTestId('person-error')).toContainText(/8|크기/);
  await page.getByTestId('person-input').setInputFiles(fixture('too-many-pixels.png').pathname);
  await expect(page.getByTestId('person-error')).toContainText(/해상도|픽셀|화소/);
  await page.getByTestId('garment-input').setInputFiles({
    name: 'script.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.injected=true"/>'),
  });
  await expect(page.getByTestId('garment-error')).not.toHaveText('');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.getByTestId('generate')).toBeDisabled();
});

test('취소 뒤 늦게 온 결과가 화면을 덮지 않는다', async ({ page }) => {
  await ready(page);
  let cancelled = false;
  await page.route('**/api/jobs', (route) => route.fulfill({ status: 202, json: job('running') }));
  await page.route('**/api/jobs/contract_job', async (route) => {
    if (route.request().method() === 'DELETE') {
      cancelled = true;
      await route.fulfill({ json: job('cancelling') });
    } else if (cancelled) {
      await route.fulfill({ json: job('cancelled') });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try { await route.fulfill({ json: job('succeeded') }); } catch { /* 클라이언트 취소가 먼저 완료됨 */ }
    }
  });
  await page.route('**/api/jobs/contract_job/image', imageResponse);
  await page.goto('/');
  await inputs(page);
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('cancel-job')).toBeVisible();
  await page.getByTestId('cancel-job').click();
  await expect.poll(() => cancelled).toBe(true);
  await expect(page.getByTestId('generate')).toBeEnabled();
  await page.waitForTimeout(1400);
  await expect(page.getByTestId('result-image')).not.toBeVisible();
});

test('외부·다른 작업의 결과 주소를 거부한다', async ({ page }) => {
  await ready(page);
  let foreignRequests = 0;
  page.on('request', (request) => { if (request.url().includes('foreign.invalid')) foreignRequests++; });
  await page.route('**/api/jobs', (route) => route.fulfill({
    status: 202, json: job('succeeded', 'contract_job', { result_url: 'https://foreign.invalid/face.png' }),
  }));
  await page.goto('/');
  await inputs(page);
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('status-message')).toContainText(/안전한 결과/);
  await expect(page.getByTestId('result-image')).not.toBeVisible();
  expect(foreignRequests).toBe(0);
});

test('손상된 API 응답을 연결 성공으로 표시하지 않는다', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ...health, api_version: 'wrong' } }));
  await page.goto('/');
  await expect(page.getByTestId('connection-status')).toContainText(/연결/);
  await inputs(page);
  await expect(page.getByTestId('generate')).toBeDisabled();
});

test('카메라를 촬영하고 초기화하면 트랙이 종료된다', async ({ page, context }) => {
  await ready(page);
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    window.testCameraTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints.audio !== false) throw new Error('오디오는 요청하면 안 됨');
      const stream = await original(constraints);
      window.testCameraTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto('/');
  await page.getByTestId('camera-start').click();
  await expect(page.getByTestId('camera-capture')).toBeEnabled();
  await page.getByTestId('camera-capture').click();
  await page.getByTestId('garment-input').setInputFiles(fixture('garment.png').pathname);
  await expect(page.getByTestId('generate')).toBeEnabled();
  await page.getByTestId('reset').click();
  await expect.poll(() => page.evaluate(() => window.testCameraTracks.length > 0 && window.testCameraTracks.every((track) => track.readyState === 'ended'))).toBe(true);
});

test('카메라 거부는 복구 안내를 보이고 파일 선택은 유지한다', async ({ page }) => {
  await ready(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test denied', 'NotAllowedError'));
  });
  await page.goto('/');
  await page.getByTestId('camera-start').click();
  await expect(page.getByTestId('person-error')).toContainText(/허용|권한/);
  await page.getByTestId('person-input').setInputFiles(fixture('person.png').pathname);
  await expect(page.getByTestId('person-error')).toHaveText('');
});

test('좁은 화면·확대·키보드에서 주요 행동이 접근 가능하다', async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await inputs(page);
  await expect(page.getByTestId('generate')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../evidence/frontend-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test('접수 응답이 늦게 도착해도 취소한 작업을 서버에서 정리한다', async ({ page }) => {
  await ready(page);
  let started = false;
  let release;
  let cancelled = 0;
  await page.route('**/api/jobs', async (route) => {
    started = true;
    await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ status: 202, json: job('running', 'late_job') });
  });
  await page.route('**/api/jobs/late_job', (route) => {
    if (route.request().method() === 'DELETE') cancelled++;
    return route.fulfill({ json: job('cancelled', 'late_job') });
  });
  await page.goto('/');
  await inputs(page);
  await page.getByTestId('generate').click();
  await expect.poll(() => started).toBe(true);
  await page.getByTestId('cancel-job').click();
  await expect(page.getByTestId('generate')).toBeDisabled();
  release();
  await expect.poll(() => cancelled).toBe(1);
  await expect(page.getByTestId('generate')).toBeEnabled();
  await expect(page.getByTestId('result-image')).not.toBeVisible();
});

test('라이브는 프레임을 직렬 처리하고 중지하면 카메라를 해제한다', async ({ page, context }) => {
  await ready(page);
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    window.testCameraTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.testCameraTracks.push(...stream.getTracks());
      return stream;
    };
  });
  let posts = 0;
  let inFlight = 0;
  let maximum = 0;
  await page.route('**/api/jobs', (route) => {
    const payload = route.request().postData();
    expect(payload).toContain('name="prompt"');
    expect(payload).not.toContain('name="garment"');
    inFlight++;
    maximum = Math.max(maximum, inFlight);
    return route.fulfill({ status: 202, json: job('queued', `frame_${++posts}`) });
  });
  await page.route(/\/api\/jobs\/frame_\d+$/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: job(route.request().method() === 'DELETE' ? 'cancelled' : 'succeeded', id) });
  });
  await page.route(/\/api\/jobs\/frame_\d+\/image$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    try { await imageResponse(route); } catch { /* 라이브 중지로 이미지 요청이 취소될 수 있음 */ }
    finally { inFlight--; }
  });
  await page.goto('/');
  await page.getByTestId('mode-live').click();
  await page.getByTestId('camera-start').click();
  await expect(page.getByTestId('generate')).toBeEnabled();
  await page.getByTestId('generate').click();
  await expect.poll(() => posts).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('result-image')).toBeVisible();
  await page.getByTestId('cancel-job').click();
  await expect.poll(() => page.evaluate(() => window.testCameraTracks.every((track) => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByTestId('result-image')).toBeVisible();
  expect(maximum).toBe(1);
});

test('빈 상태와 사진 준비 상태에 접근성 자동 검사 위반이 없다', async ({ page }) => {
  await ready(page);
  await page.goto('/');
  const empty = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(empty.violations).toEqual([]);
  await inputs(page);
  await page.getByTestId('mode-live').click();
  const prepared = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(prepared.violations).toEqual([]);
});

test('이전 사진 디코딩이 늦게 끝나도 나중에 켠 카메라가 유지된다', async ({ page, context }) => {
  await ready(page);
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    const nativeBitmap = window.createImageBitmap.bind(window);
    let first = true;
    window.createImageBitmap = async (...args) => {
      if (first) {
        first = false;
        window.imageReadPending = true;
        await new Promise((resolve) => { window.releaseImageRead = resolve; });
      }
      return nativeBitmap(...args);
    };
    const nativeCamera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.testCameraTracks = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await nativeCamera(constraints);
      window.testCameraTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto('/');
  await page.getByTestId('person-input').setInputFiles(fixture('person.png').pathname);
  await expect.poll(() => page.evaluate(() => window.imageReadPending)).toBe(true);
  await page.getByTestId('camera-start').click();
  await expect(page.locator('#camera-video')).toBeVisible();
  await page.evaluate(() => window.releaseImageRead());
  await page.waitForTimeout(300);
  await expect(page.locator('#camera-video')).toBeVisible();
  await expect(page.getByTestId('person-preview')).not.toBeVisible();
  expect(await page.evaluate(() => window.testCameraTracks.some((track) => track.readyState === 'live'))).toBe(true);
  await page.getByTestId('reset').click();
});

test('PNG 헤더를 붙인 JPEG 결과를 계약 위반으로 거부한다', async ({ page }) => {
  await ready(page);
  await page.route('**/api/jobs', (route) => route.fulfill({ status: 202, json: job('succeeded') }));
  await page.route('**/api/jobs/contract_job/image', async (route) => {
    await route.fulfill({ contentType: 'image/png', body: await readFile(fixture('wrong-format.jpg')) });
  });
  await page.goto('/');
  await inputs(page);
  await page.getByTestId('generate').click();
  await expect(page.getByTestId('status-message')).toContainText(/올바른 PNG/);
  await expect(page.getByTestId('result-image')).not.toBeVisible();
});
