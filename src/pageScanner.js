const AVAILABLE_PATTERN = /예매|예약|가능|신청|발매/;
const SOLD_OUT_PATTERN = /매진|없음|좌석없음/;
const WAITLIST_PATTERN = /예약대기|대기/;
const KTX_PATTERN = /KTX|케이티엑스/i;
const TIME_PATTERN = /(?:[01]?\d|2[0-3])[:시]\s?[0-5]\d/g;

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTime(value) {
  return String(value || '').replace('시', ':').replace(/\s/g, '');
}

function classifySeatText(text) {
  const normalized = compactText(text);
  if (!normalized) {
    return 'unknown';
  }
  if (WAITLIST_PATTERN.test(normalized)) {
    return 'waitlist';
  }
  if (AVAILABLE_PATTERN.test(normalized) && !SOLD_OUT_PATTERN.test(normalized)) {
    return 'available';
  }
  if (SOLD_OUT_PATTERN.test(normalized)) {
    return 'soldout';
  }
  return 'unknown';
}

function isAvailableTrain(train) {
  return train.standardSeatStatus === 'available'
    || train.firstClassStatus === 'available'
    || train.standingStatus === 'available'
    || train.freeSeatStatus === 'available'
    || train.availableTextDetected;
}

function pickSeatText(rowText, label) {
  const match = rowText.match(new RegExp(`${label}\\s*([^일특입자예약대기매진예매가능선택]*)?(예약대기|매진|예매|예약|가능|신청|발매|없음)?`, 'i'));
  if (!match) {
    return '';
  }
  return compactText(match[0]);
}

function parseTrainText(rowText) {
  const text = compactText(rowText);
  const times = [...text.matchAll(TIME_PATTERN)].map((match) => normalizeTime(match[0]));
  const trainNo = text.match(/KTX[-산천청룡\w]*\s*\d+/i)?.[0]?.replace(/\s+/g, ' ') || text.match(/KTX[-산천청룡\w]*/i)?.[0] || 'KTX';
  const standardSeatText = pickSeatText(text, '일반실') || (text.includes('일반실') ? '일반실 확인 필요' : '');
  const firstClassText = pickSeatText(text, '특실') || (text.includes('특실') ? '특실 확인 필요' : '');
  const standingText = pickSeatText(text, '입석') || (text.includes('입석') ? '입석' : '');
  const freeSeatText = pickSeatText(text, '자유석') || (text.includes('자유석') ? '자유석' : '');
  const availableTextDetected = AVAILABLE_PATTERN.test(text)
    && !WAITLIST_PATTERN.test(text)
    && !/결제|로그인|회원가입|예약내역/.test(text)
    && !(/^.*매진.*$/.test(text) && !/예매|예약|가능|신청|발매/.test(text.replace(SOLD_OUT_PATTERN, '')));

  const train = {
    trainNo,
    departureTime: times[0] || '',
    arrivalTime: times[1] || '',
    standardSeatText,
    firstClassText,
    standingText,
    freeSeatText,
    standardSeatStatus: classifySeatText(standardSeatText),
    firstClassStatus: classifySeatText(firstClassText),
    standingStatus: classifySeatText(standingText),
    freeSeatStatus: classifySeatText(freeSeatText),
    availableTextDetected,
    rawText: text
  };
  train.available = isAvailableTrain(train);
  return train;
}

function parseVisibleTrainTexts(texts) {
  const seen = new Set();
  const trains = [];

  for (const text of texts.map(compactText).filter(Boolean)) {
    if (!KTX_PATTERN.test(text) || seen.has(text)) {
      continue;
    }
    seen.add(text);
    trains.push(parseTrainText(text));
  }

  return trains;
}

async function readVisibleTrainTexts(page) {
  return page.evaluate(() => {
    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    }

    function textOf(element) {
      return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const preferredRows = [...document.querySelectorAll('tr')]
      .filter(isVisible)
      .map(textOf)
      .filter((text) => /KTX|케이티엑스/i.test(text));

    if (preferredRows.length > 0) {
      return preferredRows;
    }

    return [...document.querySelectorAll('li, article, section, div')]
      .filter(isVisible)
      .map(textOf)
      .filter((text) => /KTX|케이티엑스/i.test(text) && /(?:[01]?\d|2[0-3])[:시]\s?[0-5]\d/.test(text))
      .filter((text) => text.length < 1200);
  });
}

async function scanPage(page) {
  if (!page) {
    throw new Error('연결된 브라우저 페이지가 없습니다.');
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const [title, url, texts] = await Promise.all([
    page.title().catch(() => ''),
    Promise.resolve(page.url()),
    readVisibleTrainTexts(page)
  ]);
  const trains = parseVisibleTrainTexts(texts);
  const availableTrains = trains.filter((train) => train.available);

  return {
    ok: trains.length > 0,
    checkedAt: new Date().toISOString(),
    pageTitle: title,
    pageUrl: url,
    trains,
    availableTrains,
    hasAvailableSeat: availableTrains.length > 0,
    summary: trains.length === 0
      ? '현재 브라우저 화면에서 KTX 열차 목록을 읽지 못했습니다.'
      : availableTrains.length > 0
        ? `화면에서 잔여석 후보 ${availableTrains.length}개 발견 / 열차 ${trains.length}개 읽음`
        : `화면에서 열차 ${trains.length}개 읽음, 잔여석 후보 없음`,
    error: trains.length > 0 ? '' : '조건 입력 화면, 로딩 중 화면, 또는 열차 목록이 아닌 화면일 수 있습니다.'
  };
}

module.exports = {
  scanPage,
  parseVisibleTrainTexts,
  parseTrainText,
  classifySeatText,
  isAvailableTrain
};
