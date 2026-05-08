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

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
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

analyzeButton.addEventListener('click', () => {
  renderCandidates(analyzeText(resultText.value));
});

clearButton.addEventListener('click', () => {
  resultText.value = '';
  candidateList.innerHTML = '';
  analysisSummary.className = 'summary';
  analysisSummary.textContent = '아직 분석 전입니다.';
});
