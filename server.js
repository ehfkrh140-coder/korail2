const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  publicState,
  startMonitor,
  stopMonitor,
  checkScreenOnce,
  openMonitoringBrowser,
  attachBrowserPage,
  stopAlarm
  checkOnce
} = require('./src/monitor');

const PORT = Number(process.env.PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_SIZE = 1024 * 128;

const PORT = Number(process.env.PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function send(response, statusCode, body, contentType = 'application/json; charset=utf-8') {
function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function resolveFilePath(requestUrl) {
  const parsedUrl = new URL(requestUrl, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath === '/' ? '/index.html' : safePath;
  const filePath = path.join(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('요청 본문이 너무 큽니다.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('JSON 요청 형식이 올바르지 않습니다.'));
      }
    });
    request.on('error', reject);
  });
}

async function handleApi(request, response, pathname) {
  try {
    if (request.method === 'GET' && pathname === '/api/monitor/status') {
      sendJson(response, 200, { ok: true, ...publicState() });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/browser/open') {
      const result = await openMonitoringBrowser();
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/browser/attach') {
      const result = await attachBrowserPage();
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/check-screen-once') {
      const payload = await readJsonBody(request);
      const result = await checkScreenOnce({ refresh: payload.refresh !== false });
    if (request.method === 'POST' && pathname === '/api/check-once') {
      const payload = await readJsonBody(request);
      const result = await checkOnce(payload.conditions || payload.condition || payload);
      sendJson(response, 200, { ok: result.ok, ...result, state: publicState() });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/alarm/stop') {
      sendJson(response, 200, stopAlarm());
      return;
    }

    if (request.method === 'POST' && pathname === '/api/monitor/start') {
      const payload = await readJsonBody(request);
      const state = await startMonitor({
    if (request.method === 'POST' && pathname === '/api/monitor/start') {
      const payload = await readJsonBody(request);
      const state = await startMonitor({
        conditions: payload.conditions,
        intervalSeconds: payload.intervalSeconds
      });
      sendJson(response, 200, { ok: true, ...state });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/monitor/stop') {
      sendJson(response, 200, { ok: true, ...stopMonitor() });
      return;
    }

    sendJson(response, 404, { ok: false, error: 'API 경로를 찾을 수 없습니다.' });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message, state: publicState() });
  }
}

const server = http.createServer((request, response) => {
  const parsedUrl = new URL(request.url, `http://localhost:${PORT}`);

  if (parsedUrl.pathname.startsWith('/api/')) {
    handleApi(request, response, parsedUrl.pathname);
    return;
  }

const server = http.createServer((request, response) => {
  if (request.method !== 'GET') {
    send(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8');
    return;
  }

  const filePath = resolveFilePath(request.url);
  if (!filePath) {
    send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, 'Not Found', 'text/plain; charset=utf-8');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    send(response, 200, data, MIME_TYPES[extension] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`KTX 브라우저 화면 기반 잔여석 모니터링 알림판이 실행 중입니다: http://localhost:${PORT}`);
  console.log('KORAIL 서버 직접 호출 없이 연결된 브라우저 화면만 갱신하고 읽습니다.');
  console.log(`KTX 잔여석 모니터링 알림판이 실행 중입니다: http://localhost:${PORT}`);
  console.log('자동 로그인/예매/결제 없이 잔여석 조회와 알림까지만 수행합니다.');
  console.log(`KTX 빈자리 확인 도우미가 실행 중입니다: http://localhost:${PORT}`);
  console.log('종료하려면 터미널에서 Ctrl+C를 누르세요.');
});
