const serverStatusEl = document.querySelector('#serverStatus');
const browserStatusEl = document.querySelector('#browserStatus');
const currentTimeEl = document.querySelector('#currentTime');
const intervalInput = document.querySelector('#intervalSeconds');
const openBrowserButton = document.querySelector('#openBrowser');
const attachBrowserButton = document.querySelector('#attachBrowser');
const DEFAULT_CONDITIONS = [
  {
    id: 'gwangmyeong-busan',
    name: '조건 1: 광명 → 부산',
    from: '광명',
    to: '부산',
    date: '2026-05-23',
    startTime: '09:00',
    endTime: '13:00',
    passengers: 1,
    seatPreference: '015'
  },
  {
    id: 'busan-gwangmyeong',
    name: '조건 2: 부산 → 광명',
    from: '부산',
    to: '광명',
    date: '2026-05-24',
    startTime: '09:00',
    endTime: '15:00',
    passengers: 1,
    seatPreference: '015'
  }
];

const conditionsEl = document.querySelector('#conditions');
const resultsEl = document.querySelector('#results');
const serverStatusEl = document.querySelector('#serverStatus');
const currentTimeEl = document.querySelector('#currentTime');
const intervalInput = document.querySelector('#intervalSeconds');
const startButton = document.querySelector('#startMonitor');
const stopButton = document.querySelector('#stopMonitor');
const checkOnceButton = document.querySelector('#checkOnce');
const stopAlarmButton = document.querySelector('#stopAlarm');
const notifyButton = document.querySelector('#notifyButton');
const runningStatusEl = document.querySelector('#runningStatus');
const lastRefreshAtEl = document.querySelector('#lastRefreshAt');
const nextCheckInEl = document.querySelector('#nextCheckIn');
const intervalStatusEl = document.querySelector('#intervalStatus');
const trainCountEl = document.querySelector('#trainCount');
const availabilityStatusEl = document.querySelector('#availabilityStatus');
const lastSummaryEl = document.querySelector('#lastSummary');
const errorMessageEl = document.querySelector('#errorMessage');
const alertPanel = document.querySelector('#alertPanel');
const alertDetails = document.querySelector('#alertDetails');
const resultsEl = document.querySelector('#results');

let alarmTimer = null;
let alarmMuted = false;
let audioContext = null;
const lastCheckedAtEl = document.querySelector('#lastCheckedAt');
const nextCheckInEl = document.querySelector('#nextCheckIn');
const intervalStatusEl = document.querySelector('#intervalStatus');
const checkStatusEl = document.querySelector('#checkStatus');
const lastSummaryEl = document.querySelector('#lastSummary');
const alertPanel = document.querySelector('#alertPanel');
const alertDetails = document.querySelector('#alertDetails');

let alarmTimer = null;
let audioContext = null;
let statusTimer = null;
let latestState = null;

function formatDateTime(value) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validateInterval() {
  const intervalSeconds = Number(intervalInput.value);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 20) {
    throw new Error('갱신 간격은 20초 이상이어야 합니다. 더 짧은 반복 조회는 허용하지 않습니다.');
function renderConditionInputs() {
  conditionsEl.innerHTML = DEFAULT_CONDITIONS.map((condition, index) => `
    <article class="condition-card" data-condition-index="${index}">
      <h3>${condition.name}</h3>
      <div class="form-grid">
        <label>출발역<input data-field="from" value="${condition.from}"></label>
        <label>도착역<input data-field="to" value="${condition.to}"></label>
        <label>날짜<input data-field="date" type="date" value="${condition.date}"></label>
        <label>시작 시간<input data-field="startTime" type="time" value="${condition.startTime}"></label>
        <label>종료 시간<input data-field="endTime" type="time" value="${condition.endTime}"></label>
        <label>승객 수<input data-field="passengers" type="number" min="1" max="9" value="${condition.passengers}"></label>
        <label>좌석 종류
          <select data-field="seatPreference">
            <option value="015" ${condition.seatPreference === '015' ? 'selected' : ''}>일반 기본</option>
            <option value="000" ${condition.seatPreference === '000' ? 'selected' : ''}>무관</option>
            <option value="011" ${condition.seatPreference === '011' ? 'selected' : ''}>1인석</option>
            <option value="012" ${condition.seatPreference === '012' ? 'selected' : ''}>창측좌석</option>
            <option value="013" ${condition.seatPreference === '013' ? 'selected' : ''}>내측좌석</option>
          </select>
        </label>
      </div>
    </article>
  `).join('');
}

function readConditions() {
  return [...document.querySelectorAll('.condition-card')].map((card, index) => {
    const base = DEFAULT_CONDITIONS[index];
    const data = { id: base.id, name: base.name };
    for (const field of card.querySelectorAll('[data-field]')) {
      data[field.dataset.field] = field.value.trim();
    }
    data.passengers = Number(data.passengers || 1);
    return data;
  });
}

function validateInterval() {
  const intervalSeconds = Number(intervalInput.value);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 20) {
    throw new Error('조회 간격은 20초 이상이어야 합니다. 서버 부담을 줄이기 위해 더 짧은 간격은 허용하지 않습니다.');
  }
  return Math.floor(intervalSeconds);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || '요청 처리 중 오류가 발생했습니다.');
  }
  return payload;
}

function playBeepOnce() {
const CHECKS = [
  {
    id: 'gwangmyeong-to-busan',
    label: '광명 → 부산',
    date: '2026년 5월 23일',
    from: '광명',
    to: '부산',
    startMinutes: 9 * 60,
    endMinutes: 13 * 60
  },
  {
    id: 'busan-to-gwangmyeong',
    label: '부산 → 광명',
    date: '2026년 5월 25일',
    from: '부산',
    to: '광명',
    startMinutes: 9 * 60,
    endMinutes: 15 * 60
  }
];

const KTX_PATTERN = /KTX|케이티엑스/i;
const AVAILABLE_PATTERN = /예약|예매|선택|가능|특실|일반실/;
const EXCLUDED_PATTERN = /매진|입석|자유석|예약대기|대기/;
const TIME_PATTERN = /(?:[01]?\d|2[0-3])[:시]\s?[0-5]\d/g;

const countdown = document.querySelector('#countdown');
const intervalInput = document.querySelector('#intervalSeconds');
const startTimerButton = document.querySelector('#startTimer');
const stopTimerButton = document.querySelector('#stopTimer');
const notifyButton = document.querySelector('#notifyButton');
const resultText = document.querySelector('#resultText');
const analyzeButton = document.querySelector('#analyzeButton');
const clearButton = document.querySelector('#clearButton');
const analysisSummary = document.querySelector('#analysisSummary');
const candidateList = document.querySelector('#candidateList');

let timerId = null;
let secondsLeft = 0;

function formatRemaining(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function playBeep() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  audioContext = audioContext || new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.55);
}

function startAlarm() {
  if (alarmTimer) {
    return;
  }
  playBeepOnce();
  alarmTimer = window.setInterval(playBeepOnce, 1200);
}

function stopAlarm() {
  window.clearInterval(alarmTimer);
  alarmTimer = null;
}

function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function seatClass(status) {
  return status === 'available' ? 'available' : status === 'soldout' ? 'soldout' : 'muted';
  return status && status.includes('available') ? 'available' : status === 'soldout' ? 'soldout' : 'muted';
}

function renderTrainRows(trains) {
  if (!trains || trains.length === 0) {
    return '<p class="empty">현재 브라우저 화면에서 KTX 열차 목록을 읽지 못했습니다.</p>';
    return '<p class="empty">대상 시간대의 KTX 열차를 찾지 못했습니다.</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>열차</th>
            <th>출발</th>
            <th>도착</th>
            <th>일반실</th>
            <th>특실</th>
            <th>입석</th>
            <th>자유석</th>
            <th>판정</th>
          </tr>
        </thead>
        <tbody>
          ${trains.map((train) => `
            <tr class="${train.available ? 'detected' : ''}">
              <td>${escapeHtml(train.trainNo || 'KTX')}</td>
              <td>${escapeHtml(train.departureTime || '-')}</td>
              <td>${escapeHtml(train.arrivalTime || '-')}</td>
              <td class="${seatClass(train.standardSeatStatus)}">${escapeHtml(train.standardSeatText || train.standardSeatStatus)}</td>
              <td class="${seatClass(train.firstClassStatus)}">${escapeHtml(train.firstClassText || train.firstClassStatus)}</td>
              <td class="${seatClass(train.standingStatus)}">${escapeHtml(train.standingText || train.standingStatus)}</td>
              <td class="${seatClass(train.freeSeatStatus)}">${escapeHtml(train.freeSeatText || train.freeSeatStatus)}</td>
              <td>${train.available ? '<strong>잔여석 후보</strong>' : '알림 없음'}</td>
            <tr class="${train.detected ? 'detected' : ''}">
              <td>${escapeHtml(train.trainNo || train.trainType || 'KTX')}</td>
              <td>${escapeHtml(train.departureTime || '-')}</td>
              <td>${escapeHtml(train.arrivalTime || '-')}</td>
              <td class="${seatClass(train.standardSeat)}">${escapeHtml(train.standardSeat)}</td>
              <td class="${seatClass(train.firstClass)}">${escapeHtml(train.firstClass)}</td>
              <td class="${seatClass(train.standingSeat)}">${escapeHtml(train.standingSeat)}</td>
              <td class="${seatClass(train.freeSeat)}">${escapeHtml(train.freeSeat)}</td>
              <td>${train.detected ? '<strong>잔여석 후보</strong>' : '잔여석 없음'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderResults(state) {
  const result = state.lastResult || {};
  resultsEl.innerHTML = `
    <dl>
      <div><dt>읽은 페이지</dt><dd>${escapeHtml(result.pageTitle || '-')}</dd></div>
      <div><dt>페이지 주소</dt><dd>${escapeHtml(result.pageUrl || state.browser?.activeUrl || '-')}</dd></div>
      <div><dt>화면 갱신 방식</dt><dd>${escapeHtml(result.actionMessage || '-')}</dd></div>
      <div><dt>조회 결과</dt><dd>${escapeHtml(result.summary || '아직 검사 전입니다.')}</dd></div>
    </dl>
    ${renderTrainRows(state.trains || [])}
  `;
}

function renderAlert(state) {
  const available = state.availableTrains || [];
  if (available.length === 0) {
    alertPanel.classList.add('hidden');
    alarmMuted = false;
    return;
  }

  alertDetails.innerHTML = available.map((train) => `
    <div class="alert-item">
      <strong>${escapeHtml(train.trainNo || 'KTX')}</strong>
      <span>${escapeHtml(train.departureTime || '-')} 출발 / ${escapeHtml(train.arrivalTime || '-')} 도착</span>
      <span>${escapeHtml([train.standardSeatText, train.firstClassText, train.standingText, train.freeSeatText].filter(Boolean).join(' · '))}</span>
    </div>
  `).join('');
  alertPanel.classList.remove('hidden');
  if (!alarmMuted) {
    startAlarm();
  }
  showNotification('KTX 잔여석 발견', `${available.length}개 열차에서 화면상 잔여석 후보를 발견했습니다.`);
function conditionLabel(conditionId) {
  return DEFAULT_CONDITIONS.find((condition) => condition.id === conditionId)?.name || conditionId;
}

function renderResults(state) {
  const resultsByCondition = state.resultsByCondition || {};
  const conditions = state.conditions && state.conditions.length > 0 ? state.conditions : readConditions();

  resultsEl.innerHTML = conditions.map((condition) => {
    const result = resultsByCondition[condition.id];
    return `
      <article class="result-card ${result?.hasAvailableSeat ? 'has-seat' : ''}">
        <h3>${escapeHtml(conditionLabel(condition.id))}</h3>
        <p class="route">${escapeHtml(condition.from)} → ${escapeHtml(condition.to)} / ${escapeHtml(condition.date)} / ${escapeHtml(condition.startTime)}~${escapeHtml(condition.endTime)} / ${escapeHtml(condition.passengers)}명</p>
        <dl>
          <div><dt>마지막 조회 시각</dt><dd>${formatDateTime(result?.checkedAt)}</dd></div>
          <div><dt>조회 결과</dt><dd>${escapeHtml(result?.summary || '아직 조회 전입니다.')}</dd></div>
          <div><dt>잔여석 발견</dt><dd>${result?.hasAvailableSeat ? '예' : '아니오'}</dd></div>
          <div><dt>오류 메시지</dt><dd>${escapeHtml(result?.error || '-')}</dd></div>
        </dl>
        ${renderTrainRows(result?.trains || [])}
      </article>
    `;
  }).join('');
}

function renderAlert(state) {
  const available = Object.values(state.resultsByCondition || {})
    .flatMap((result) => (result.availableTrains || []).map((train) => ({ result, train })));

  if (available.length === 0) {
    alertPanel.classList.add('hidden');
    return;
  }

  alertDetails.innerHTML = available.map(({ result, train }) => `
    <div class="alert-item">
      <strong>${escapeHtml(conditionLabel(result.conditionId))}</strong>
      <span>${escapeHtml(train.trainNo || train.trainType)} / ${escapeHtml(train.departureTime)} 출발 / ${escapeHtml(train.arrivalTime)} 도착 / ${escapeHtml(train.statusSummary)}</span>
    </div>
  `).join('');
  alertPanel.classList.remove('hidden');
  startAlarm();
  showNotification('KTX 잔여석 발견', `${available.length}개 열차에서 예매 가능 후보를 발견했습니다.`);
}

function renderState(state) {
  latestState = state;
  serverStatusEl.textContent = '정상';
  browserStatusEl.textContent = state.browser?.connected
    ? (state.browser.isKorailPage ? 'KORAIL 화면 연결' : '브라우저 연결')
    : '미연결';
  runningStatusEl.textContent = state.running ? '실행 중' : '정지';
  lastRefreshAtEl.textContent = formatDateTime(state.lastScreenRefreshAt || state.lastCheckedAt);
  nextCheckInEl.textContent = state.nextCheckInSeconds === null ? '-' : `${state.nextCheckInSeconds}초`;
  intervalStatusEl.textContent = `${state.intervalSeconds || intervalInput.value}초`;
  trainCountEl.textContent = `${(state.trains || []).length}개`;
  availabilityStatusEl.textContent = state.availableTrains && state.availableTrains.length > 0 ? '예' : '아니오';
  lastSummaryEl.textContent = state.lastResult?.summary || '아직 검사 전입니다.';
  errorMessageEl.textContent = state.error || state.lastResult?.error || '-';
  runningStatusEl.textContent = state.running ? '실행 중' : '정지';
  lastCheckedAtEl.textContent = formatDateTime(state.lastCheckedAt);
  nextCheckInEl.textContent = state.nextCheckInSeconds === null ? '-' : `${state.nextCheckInSeconds}초`;
  intervalStatusEl.textContent = `${state.intervalSeconds || intervalInput.value}초`;
  checkStatusEl.textContent = state.checking ? '조회 중' : state.lastResult ? (state.lastResult.ok ? '성공' : '일부 실패') : '-';
  lastSummaryEl.textContent = state.lastResult?.summary || state.error || '아직 조회 전입니다.';
  renderResults(state);
  renderAlert(state);
}

async function refreshStatus() {
  try {
    const state = await api('/api/monitor/status');
    renderState(state);
  } catch (error) {
    serverStatusEl.textContent = '오류';
    errorMessageEl.textContent = error.message;
    lastSummaryEl.textContent = error.message;
  }
}

async function runAction(action) {
  try {
    lastSummaryEl.textContent = '요청 처리 중입니다...';
    await action();
    await refreshStatus();
  } catch (error) {
    alert(error.message);
    await refreshStatus();
  }
}

openBrowserButton.addEventListener('click', () => runAction(async () => {
  await api('/api/browser/open', { method: 'POST', body: {} });
}));

attachBrowserButton.addEventListener('click', () => runAction(async () => {
  await api('/api/browser/attach', { method: 'POST', body: {} });
}));

startButton.addEventListener('click', () => runAction(async () => {
  await api('/api/monitor/start', {
    method: 'POST',
    body: { intervalSeconds: validateInterval() }
startButton.addEventListener('click', () => runAction(async () => {
  await api('/api/monitor/start', {
    method: 'POST',
    body: {
      intervalSeconds: validateInterval(),
      conditions: readConditions()
    }
  });
}));

stopButton.addEventListener('click', () => runAction(async () => {
  await api('/api/monitor/stop', { method: 'POST', body: {} });
}));

checkOnceButton.addEventListener('click', () => runAction(async () => {
  await api('/api/check-screen-once', { method: 'POST', body: { refresh: true } });
}));

stopAlarmButton.addEventListener('click', () => runAction(async () => {
  alarmMuted = true;
  stopAlarm();
  await api('/api/alarm/stop', { method: 'POST', body: {} });
}));
  await api('/api/check-once', {
    method: 'POST',
    body: { conditions: readConditions() }
  });
}));

stopAlarmButton.addEventListener('click', stopAlarm);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.45);
}

function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, { body });
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = null;
  secondsLeft = 0;
  countdown.textContent = '타이머가 정지되어 있습니다.';
}

function resetTimerInterval() {
  secondsLeft = Math.max(Number(intervalInput.value) || 60, 10);
  countdown.textContent = `다음 확인까지 ${formatRemaining(secondsLeft)} 남았습니다.`;
}

function tick() {
  secondsLeft -= 1;

  if (secondsLeft <= 0) {
    playBeep();
    showNotification('KTX 확인 시간입니다', 'KORAIL 화면에서 직접 새로고침/조회 후 결과를 붙여넣어 주세요.');
    resetTimerInterval();
    return;
  }

  countdown.textContent = `다음 확인까지 ${formatRemaining(secondsLeft)} 남았습니다.`;
}

function startTimer() {
  stopTimer();
  resetTimerInterval();
  timerId = window.setInterval(tick, 1000);
}

function normalizeTime(timeText) {
  const match = timeText.match(/(\d{1,2})[:시]\s?(\d{2})/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function findFirstTimeInRange(line, check) {
  const times = line.match(TIME_PATTERN) || [];

  for (const timeText of times) {
    const minutes = normalizeTime(timeText);
    if (minutes !== null && minutes >= check.startMinutes && minutes <= check.endMinutes) {
      return timeText.replace('시', ':').replace(/\s/g, '');
    }
  }

  return null;
}

function splitResultLines(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function analyzeLine(line) {
  const matches = [];

  for (const check of CHECKS) {
    const hasRoute = line.includes(check.from) && line.includes(check.to);
    const departureTime = findFirstTimeInRange(line, check);
    const isKtx = KTX_PATTERN.test(line);
    const hasAvailableWord = AVAILABLE_PATTERN.test(line);
    const hasExcludedWord = EXCLUDED_PATTERN.test(line);

    if (hasRoute && departureTime && isKtx && hasAvailableWord && !hasExcludedWord) {
      matches.push({ check, departureTime, line });
    }
  }

  return matches;
}

function analyzeText(text) {
  return splitResultLines(text).flatMap(analyzeLine);
}

function renderCandidates(candidates) {
  candidateList.innerHTML = '';

  if (candidates.length === 0) {
    analysisSummary.className = 'summary empty';
    analysisSummary.textContent = '조건에 맞는 빈자리 후보를 찾지 못했습니다. KORAIL 실제 화면을 다시 확인하세요.';
    return;
  }

  analysisSummary.className = 'summary success';
  analysisSummary.textContent = `${candidates.length}개의 빈자리 후보를 찾았습니다. KORAIL 화면에서 직접 예약 가능 여부를 즉시 확인하세요.`;
  playBeep();
  showNotification('KTX 빈자리 후보 발견', `${candidates.length}개 후보가 있습니다. KORAIL 화면을 확인하세요.`);

  for (const candidate of candidates) {
    const item = document.createElement('article');
    item.className = 'candidate';
    item.innerHTML = `
      <h3>${candidate.check.label} · ${candidate.check.date}</h3>
      <strong>출발 후보 시간: ${candidate.departureTime}</strong>
      <p>일반실/특실 가능 문구가 있고 매진·대기 문구가 없는 KTX 계열 후보입니다.</p>
      <pre></pre>
    `;
    item.querySelector('pre').textContent = candidate.line;
    candidateList.append(item);
  }
}

startTimerButton.addEventListener('click', startTimer);
stopTimerButton.addEventListener('click', stopTimer);

notifyButton.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    alert('이 브라우저는 알림을 지원하지 않습니다.');
    return;
  }

  const permission = await Notification.requestPermission();
  alert(permission === 'granted' ? '브라우저 알림이 허용되었습니다.' : '브라우저 알림이 허용되지 않았습니다.');
});

window.setInterval(() => {
  currentTimeEl.textContent = new Intl.DateTimeFormat('ko-KR', { timeStyle: 'medium' }).format(new Date());
  if (latestState?.nextCheckAt) {
    const seconds = Math.max(0, Math.ceil((new Date(latestState.nextCheckAt).getTime() - Date.now()) / 1000));
    nextCheckInEl.textContent = `${seconds}초`;
  }
}, 1000);

refreshStatus();
window.setInterval(refreshStatus, 5000);
renderConditionInputs();
refreshStatus();
statusTimer = window.setInterval(refreshStatus, 5000);
analyzeButton.addEventListener('click', () => {
  renderCandidates(analyzeText(resultText.value));
});

clearButton.addEventListener('click', () => {
  resultText.value = '';
  candidateList.innerHTML = '';
  analysisSummary.className = 'summary';
  analysisSummary.textContent = '아직 분석 전입니다.';
});
