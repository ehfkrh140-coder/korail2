const serverStatusEl = document.querySelector('#serverStatus');
const browserStatusEl = document.querySelector('#browserStatus');
const currentTimeEl = document.querySelector('#currentTime');
const intervalInput = document.querySelector('#intervalSeconds');
const openBrowserButton = document.querySelector('#openBrowser');
const attachBrowserButton = document.querySelector('#attachBrowser');
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
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  audioContext = audioContext || new AudioContext();
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
}

function renderTrainRows(trains) {
  if (!trains || trains.length === 0) {
    return '<p class="empty">현재 브라우저 화면에서 KTX 열차 목록을 읽지 못했습니다.</p>';
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
