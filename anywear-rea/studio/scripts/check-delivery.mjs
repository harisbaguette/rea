import { createServer } from 'node:http';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';

const source = resolve('dist');
const temporary = await mkdtemp(join(tmpdir(), 'ibeobom-delivery-'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
let browser;
let server;
try {
  await cp(source, temporary, { recursive: true });
  server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify({ error: { code: 'device_unavailable', message: '전달본 검사: 엔진 미포함' } }));
    }
    let path;
    try { path = resolve(temporary, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`); }
    catch { response.writeHead(400); return response.end(); }
    if (!path.startsWith(temporary + '/') && path !== temporary) { response.writeHead(403); return response.end(); }
    try {
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      response.end(content);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || !address) throw new Error('포트 확보 실패');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.getByTestId('connection-status').waitFor();
  await page.getByTestId('person-input').setInputFiles(resolve('tests/fixtures/person.png'));
  await page.getByTestId('garment-input').setInputFiles(resolve('tests/fixtures/garment.png'));
  if (await page.getByTestId('generate').isEnabled()) throw new Error('엔진 없이 생성 버튼이 활성화됨');
  if (errors.length) throw new Error(errors.join('\n'));
  if (await page.evaluate(() => document.images.length === 0)) throw new Error('연결한 이미지가 없음');
  console.log(JSON.stringify({ result: 'passed', environment: '개발 폴더 밖의 정적 dist 사본', user_flow: '실행 → 이미지 입력 → 엔진 미연결 상태', page_errors: errors }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
