const { searchKorail } = require('./korailClient');

const MIN_INTERVAL_SECONDS = 20;
const DEFAULT_INTERVAL_SECONDS = 60;

function createInitialState() {
  return {
    running: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    conditions: [],
    lastCheckedAt: null,
    nextCheckAt: null,
    lastResult: null,
    resultsByCondition: {},
    error: '',
    checking: false
  };
}

const state = createInitialState();
let timer = null;

function publicState() {
  return {
    ...state,
    nextCheckInSeconds: state.nextCheckAt ? Math.max(0, Math.ceil((new Date(state.nextCheckAt).getTime() - Date.now()) / 1000)) : null
  };
}

function normalizeInterval(intervalSeconds) {
  const value = Number(intervalSeconds || DEFAULT_INTERVAL_SECONDS);
  if (!Number.isFinite(value) || value < MIN_INTERVAL_SECONDS) {
    throw new Error(`조회 간격은 ${MIN_INTERVAL_SECONDS}초 이상이어야 합니다.`);
  }
  return Math.floor(value);
}

function normalizeConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error('모니터링 조건을 1개 이상 입력하세요.');
  }

  return conditions.map((condition, index) => ({
    id: condition.id || `condition-${index + 1}`,
    from: String(condition.from || '').trim(),
    to: String(condition.to || '').trim(),
    date: String(condition.date || '').trim(),
    startTime: String(condition.startTime || '').trim(),
    endTime: String(condition.endTime || '').trim(),
    passengers: Number(condition.passengers || 1),
    seatPreference: condition.seatPreference || '015'
  }));
}

async function checkConditions(conditions = state.conditions) {
  if (state.checking) {
    return state.lastResult || { ok: false, error: '이미 조회가 진행 중입니다.', checkedAt: new Date().toISOString(), results: [] };
  }

  state.checking = true;
  state.error = '';
  const checkedAt = new Date().toISOString();
  const results = [];

  for (const condition of conditions) {
    try {
      const result = await searchKorail(condition);
      results.push(result);
      state.resultsByCondition[condition.id] = result;
    } catch (error) {
      const failed = {
        ok: false,
        conditionId: condition.id,
        checkedAt: new Date().toISOString(),
        trains: [],
        availableTrains: [],
        hasAvailableSeat: false,
        summary: '조회 실패',
        error: error.message
      };
      results.push(failed);
      state.resultsByCondition[condition.id] = failed;
      state.error = error.message;
    }
  }

  const hasAvailableSeat = results.some((result) => result.hasAvailableSeat);
  const failedCount = results.filter((result) => !result.ok).length;
  const trainCount = results.reduce((total, result) => total + result.trains.length, 0);
  const availableCount = results.reduce((total, result) => total + result.availableTrains.length, 0);

  state.lastCheckedAt = checkedAt;
  state.lastResult = {
    ok: failedCount === 0,
    checkedAt,
    hasAvailableSeat,
    summary: hasAvailableSeat
      ? `잔여석 후보 ${availableCount}개 발견`
      : failedCount > 0
        ? `${failedCount}개 조건 조회 실패, ${trainCount}개 열차 확인`
        : `대상 열차 ${trainCount}개 확인, 잔여석 없음`,
    results
  };
  state.checking = false;
  return state.lastResult;
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
    await checkConditions();
    scheduleNext();
  }, state.intervalSeconds * 1000);
}

async function startMonitor({ conditions, intervalSeconds }) {
  state.intervalSeconds = normalizeInterval(intervalSeconds);
  state.conditions = normalizeConditions(conditions);
  state.running = true;
  await checkConditions(state.conditions);
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

async function checkOnce(conditions) {
  const normalized = normalizeConditions(Array.isArray(conditions) ? conditions : [conditions]);
  return checkConditions(normalized);
}

module.exports = {
  MIN_INTERVAL_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  publicState,
  startMonitor,
  stopMonitor,
  checkOnce,
  normalizeConditions,
  normalizeInterval
};
