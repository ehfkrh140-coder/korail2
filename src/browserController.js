const http = require('http');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scanPage } = require('./pageScanner');

const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const DEBUG_HOST = '127.0.0.1';

let chromeProcess = null;
let activeTarget = null;
let activeSession = null;
let lastPageCount = 0;
let attachedAt = null;
let lastAction = null;

function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: DEBUG_HOST, port: DEBUG_PORT, path: pathname }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Chrome DevTools 응답 오류: HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Chrome DevTools 응답을 JSON으로 읽지 못했습니다.'));
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(3000, () => {
      request.destroy(new Error('Chrome DevTools 포트에 연결하지 못했습니다.'));
    });
  });
}

function chromeCandidates() {
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
}


function findChromeExecutable() {
  for (const candidate of chromeCandidates()) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      return candidate;
    }
    if (!path.isAbsolute(candidate)) {
      const resolved = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (resolved.status === 0 && resolved.stdout.trim()) {
        return resolved.stdout.trim();
      }
    }
  }
  return '';
}

function launchChrome() {
  const userDataDir = path.join(process.cwd(), '.chrome-monitor-profile');
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--new-window',
    'about:blank'
  ];

  const executable = findChromeExecutable();
  if (!executable) {
    throw new Error(`Chrome 실행 파일을 찾지 못했습니다. Chrome을 직접 원격 디버깅 포트 ${DEBUG_PORT}로 실행한 뒤 연결하세요.`);
  }

  chromeProcess = spawn(executable, args, { detached: true, stdio: 'ignore' });
  chromeProcess.unref();
  lastAction = 'chrome-opened';
}

async function waitForDebugPort() {
  const started = Date.now();
  while (Date.now() - started < 6000) {
    try {
      await requestJson('/json/version');
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Chrome DevTools 포트(${DEBUG_PORT})가 열리지 않았습니다.`);
}

async function listTargets() {
  try {
    const targets = await requestJson('/json/list');
    const pages = targets.filter((target) => target.type === 'page');
    lastPageCount = pages.length;
    return pages;
  } catch (error) {
    return [];
  }
}

class CdpPage {
  constructor(target) {
    this.target = target;
    this.socket = null;
    this.messageId = 0;
    this.pending = new Map();
  }

  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }
    if (!this.target.webSocketDebuggerUrl) {
      throw new Error('선택한 Chrome 탭의 DevTools WebSocket 주소를 찾지 못했습니다.');
    }
    this.socket = new WebSocket(this.target.webSocketDebuggerUrl);
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
        return;
      }
      resolve(message.result || {});
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('Chrome 탭 WebSocket 연결 실패')), { once: true });
    });
    await this.sendRaw('Runtime.enable');
    await this.sendRaw('Page.enable');
  }

  sendRaw(method, params = {}) {
    const id = ++this.messageId;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} 명령 시간이 초과되었습니다.`));
        }
      }, 20000);
    });
  }

  async send(method, params = {}) {
    await this.connect();
    return this.sendRaw(method, params);
  }

  async evaluate(fnOrSource) {
    const source = typeof fnOrSource === 'function' ? `(${fnOrSource})()` : String(fnOrSource);
    const result = await this.send('Runtime.evaluate', {
      expression: source,
      awaitPromise: true,
      returnByValue: true
    });
    return result.result ? result.result.value : undefined;
  }

  async title() {
    return this.evaluate('document.title');
  }

  url() {
    return activeTarget ? activeTarget.url : '';
  }

  isClosed() {
    return !this.socket || this.socket.readyState === WebSocket.CLOSED;
  }

  async waitForLoadState() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async waitForTimeout(milliseconds) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: false });
    await this.waitForLoadState();
  }
}

async function refreshActiveTarget() {
  if (!activeTarget) {
    return;
  }
  const targets = await listTargets();
  activeTarget = targets.find((target) => target.id === activeTarget.id) || activeTarget;
}

async function openBrowser() {
  const existingTargets = await listTargets();
  if (existingTargets.length === 0) {
    launchChrome();
    await waitForDebugPort();
  }
  lastAction = 'browser-opened';
  return {
    ok: true,
    message: `Chrome을 열었습니다. 주소창에서 KORAIL 예매 페이지에 직접 접속하고 조건을 입력하세요. 이미 Chrome을 직접 열었다면 원격 디버깅 포트 ${DEBUG_PORT}로 실행되어야 합니다.`,
    browser: getBrowserStatus()
  };
}

async function attachCurrentPage() {
  const targets = await listTargets();
  if (targets.length === 0) {
    throw new Error(`연결 가능한 Chrome 탭이 없습니다. 브라우저 열기를 누르거나 Chrome을 --remote-debugging-port=${DEBUG_PORT} 옵션으로 실행하세요.`);
  }

  activeTarget = targets.find((target) => /korail|letskorail/i.test(target.url)) || targets[targets.length - 1];
  activeSession = new CdpPage(activeTarget);
  await activeSession.connect();
  attachedAt = new Date().toISOString();
  lastAction = 'page-attached';

  return {
    ok: true,
    message: /korail|letskorail/i.test(activeTarget.url)
      ? '현재 KORAIL 화면에 연결되었습니다.'
      : '현재 Chrome 탭에 연결되었습니다. KORAIL 열차 목록 화면인지 확인하세요.',
    browser: getBrowserStatus()
  };
}

async function getActivePage() {
  if (!activeSession) {
    throw new Error('연결된 Chrome 탭이 없습니다. 현재 코레일 화면 연결을 먼저 실행하세요.');
  }
  await refreshActiveTarget();
  return activeSession;
}

async function clickSearchOrReload() {
  const page = await getActivePage();
  const clicked = await page.evaluate(() => {
    function visible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    function labelOf(element) {
      return [
        element.innerText,
        element.textContent,
        element.value,
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
        element.getAttribute('alt')
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    const candidates = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], a')]
      .filter(visible)
      .map((element) => ({ element, label: labelOf(element) }))
      .filter(({ label }) => /조회|다시조회|새로고침|검색/.test(label))
      .filter(({ label }) => !/예매|예약|결제|좌석|선택|로그인|회원|취소/.test(label));

    if (candidates.length === 0) {
      return false;
    }

    candidates[0].element.click();
    return true;
  });

  if (clicked) {
    lastAction = 'search-button-clicked';
    await page.waitForLoadState();
    return '현재 화면의 조회/다시조회 버튼을 클릭했습니다.';
  }

  lastAction = 'page-reloaded';
  await page.reload();
  return '조회 버튼을 찾지 못해 현재 페이지를 새로고침했습니다.';
}

async function refreshAndScan() {
  const actionMessage = await clickSearchOrReload();
  const page = await getActivePage();
  const result = await scanPage(page);
  return { ...result, actionMessage, browser: getBrowserStatus() };
}

async function scanWithoutRefresh() {
  const page = await getActivePage();
  const result = await scanPage(page);
  return { ...result, actionMessage: '현재 화면을 새로고침하지 않고 읽었습니다.', browser: getBrowserStatus() };
}

function getBrowserStatus() {
  const activeUrl = activeTarget ? activeTarget.url : '';
  return {
    opened: lastPageCount > 0 || Boolean(chromeProcess),
    connected: Boolean(activeSession && activeTarget),
    attachedAt,
    pageCount: lastPageCount,
    activeUrl,
    isKorailPage: /korail|letskorail/i.test(activeUrl),
    debugPort: DEBUG_PORT,
    lastAction
  };
}

module.exports = {
  openBrowser,
  attachCurrentPage,
  refreshAndScan,
  scanWithoutRefresh,
  getBrowserStatus
};
