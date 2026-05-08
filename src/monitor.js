const {
  openBrowser,
  attachCurrentPage,
  refreshAndScan,
  scanWithoutRefresh,
  getBrowserStatus
} = require('./browserController');
const { markAvailability, stopAlarm: stopNotifierAlarm, getNotifierState } = require('./notifier');

const MIN_INTERVAL_SECONDS = 20;
const DEFAULT_INTERVAL_SECONDS = 30;

function createInitialState() {
  return {
    running: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    lastScreenRefreshAt: null,
    lastCheckedAt: null,
    nextCheckAt: null,
    lastResult: null,
    trains: [],
    availableTrains: [],
    error: '',
    checking: false
  };
}

const state = createInitialState();
let timer = null;

function publicState() {
  return {
    ...state,
    browser: getBrowserStatus(),
    notifier: getNotifierState(),
    nextCheckInSeconds: state.nextCheckAt ? Math.max(0, Math.ceil((new Date(state.nextCheckAt).getTime() - Date.now()) / 1000)) : null
  };
}

function normalizeInterval(intervalSeconds) {
  const value = Number(intervalSeconds || DEFAULT_INTERVAL_SECONDS);
  if (!Number.isFinite(value) || value < MIN_INTERVAL_SECONDS) {
    throw new Error(`조회/새로고침 간격은 ${MIN_INTERVAL_SECONDS}초 이상이어야 합니다.`);
  }
  return Math.floor(value);
}

function applyResult(result) {
  state.lastScreenRefreshAt = result.checkedAt;
  state.lastCheckedAt = result.checkedAt;
  state.lastResult = result;
  state.trains = result.trains || [];
  state.availableTrains = result.availableTrains || [];
  state.error = result.error || '';
  markAvailability(result);
}

async function checkScreenOnce({ refresh = true } = {}) {
  if (state.checking) {
    return state.lastResult || { ok: false, error: '이미 화면 검사 중입니다.', checkedAt: new Date().toISOString(), trains: [] };
  }

  state.checking = true;
  state.error = '';
  try {
    const result = refresh ? await refreshAndScan() : await scanWithoutRefresh();
    applyResult(result);
    return result;
  } catch (error) {
    const failed = {
      ok: false,
      checkedAt: new Date().toISOString(),
      trains: [],
      availableTrains: [],
      hasAvailableSeat: false,
      summary: '화면 갱신 및 검사 실패',
      error: error.message
    };
    applyResult(failed);
    return failed;
  } finally {
    state.checking = false;
  }
}

function scheduleNext() {
  clearTimeout(timer);
  if (!state.running) {
    state.nextCheckAt = null;
    return;
  }

  const nextTime = Date.now() + state.intervalSeconds * 1000;
  state.nextCheckAt = new Date(nextTime).toISOString();
  timer = setTimeout(async () => {
    await checkScreenOnce({ refresh: true });
    scheduleNext();
  }, state.intervalSeconds * 1000);
}

async function startMonitor({ intervalSeconds } = {}) {
  state.intervalSeconds = normalizeInterval(intervalSeconds);
  state.running = true;
  await checkScreenOnce({ refresh: true });
  scheduleNext();
  return publicState();
}

function stopMonitor() {
  clearTimeout(timer);
  timer = null;
  state.running = false;
  state.nextCheckAt = null;
  return publicState();
}

async function openMonitoringBrowser() {
  const result = await openBrowser();
  return { ...result, state: publicState() };
}

async function attachBrowserPage() {
  const result = await attachCurrentPage();
  return { ...result, state: publicState() };
}

function stopAlarm() {
  return { ok: true, notifier: stopNotifierAlarm(), state: publicState() };
}

module.exports = {
  MIN_INTERVAL_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  publicState,
  startMonitor,
  stopMonitor,
  checkScreenOnce,
  openMonitoringBrowser,
  attachBrowserPage,
  stopAlarm,
  normalizeInterval
};
