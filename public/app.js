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
  return status && status.includes('available') ? 'available' : status === 'soldout' ? 'soldout' : 'muted';
}

function renderTrainRows(trains) {
  if (!trains || trains.length === 0) {
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
  await api('/api/check-once', {
    method: 'POST',
    body: { conditions: readConditions() }
  });
}));

stopAlarmButton.addEventListener('click', stopAlarm);

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

renderConditionInputs();
refreshStatus();
statusTimer = window.setInterval(refreshStatus, 5000);
