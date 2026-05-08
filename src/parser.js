const KTX_PATTERN = /KTX|케이티엑스/i;
const SOLD_OUT_PATTERN = /매진|없음|좌석없음/;
const WAITLIST_PATTERN = /예약대기|대기/;
const STANDING_PATTERN = /입석/;
const FREE_SEAT_PATTERN = /자유석/;
const AVAILABLE_PATTERN = /예약|예매|가능|좌석선택|신청|발매/;

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toDisplayTime(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) {
    return '';
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/(\d{1,2}):?(\d{2})/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseTrainInfoScripts(html) {
  const trains = [];
  const re = /new\s+train_info\s*\(([\s\S]*?)\)\s*;/gi;
  let match;

  while ((match = re.exec(html))) {
    const args = [...match[1].matchAll(/'([^']*)'|"([^"]*)"|([^,]+)/g)].map((part) => compactText(part[1] || part[2] || part[3]));
    if (args.length < 28) {
      continue;
    }

    trains.push({
      trainType: args[22] || '',
      trainNo: args[23] || '',
      departureDate: args[24] || '',
      departureTime: toDisplayTime(args[25]),
      arrivalTime: toDisplayTime(args[27]),
      rawInfo: args
    });
  }

  return trains;
}

function getInputValue(html, name) {
  const re = new RegExp(`<input[^>]+name=["']${name}["'][^>]*>`, 'i');
  const input = html.match(re)?.[0] || '';
  return input.match(/value=["']([^"']*)["']/i)?.[1] || '';
}

function classifySeat(text) {
  const normalized = compactText(text);
  if (!normalized) {
    return 'unknown';
  }
  if (SOLD_OUT_PATTERN.test(normalized)) {
    return 'soldout';
  }
  if (WAITLIST_PATTERN.test(normalized)) {
    return 'waitlist';
  }
  if (STANDING_PATTERN.test(normalized) && AVAILABLE_PATTERN.test(normalized)) {
    return 'standing_available';
  }
  if (FREE_SEAT_PATTERN.test(normalized) && AVAILABLE_PATTERN.test(normalized)) {
    return 'free_seat_available';
  }
  if (AVAILABLE_PATTERN.test(normalized)) {
    return 'available';
  }
  return 'unknown';
}

function statusText(status) {
  return {
    available: '예매 가능',
    standing_available: '입석 가능',
    free_seat_available: '자유석 가능',
    soldout: '매진',
    waitlist: '예약대기',
    unknown: '확인 필요'
  }[status] || '확인 필요';
}

function hasAvailableSeat(train) {
  return [train.standardSeat, train.firstClass, train.standingSeat, train.freeSeat].some((status) => (
    status === 'available' || status === 'standing_available' || status === 'free_seat_available'
  ));
}

function extractTableRows(html) {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((row) => row[0])
    .filter((row) => KTX_PATTERN.test(stripTags(row)) || /KTX/i.test(row));
}

function parseRows(html) {
  const infoTrains = parseTrainInfoScripts(html);
  const rows = extractTableRows(html);

  return rows.map((row, index) => {
    const rowText = stripTags(row);
    const info = infoTrains[index] || {};
    const times = [...rowText.matchAll(/(?:[01]?\d|2[0-3])[:시]\s?[0-5]\d/g)].map((time) => time[0].replace('시', ':').replace(/\s/g, ''));
    const trainNo = info.trainNo || rowText.match(/KTX[-산천청룡\w]*\s*\d+/i)?.[0]?.replace(/\s+/g, '') || '';
    const trainType = info.trainType || rowText.match(/KTX[-산천청룡\w]*/i)?.[0] || 'KTX';

    const firstClassText = getInputValue(row, 'h_spe_rsv_nm') || rowText.match(/특실\s*([^일입자]*)/)?.[0] || rowText;
    const standardText = getInputValue(row, 'h_gen_rsv_nm') || rowText.match(/일반실\s*([^특입자]*)/)?.[0] || rowText;
    const standingText = getInputValue(row, 'h_stnd_rsv_nm') || rowText.match(/입석\s*([^특일자]*)/)?.[0] || '';
    const freeText = rowText.match(/자유석\s*([^특일입]*)/)?.[0] || '';

    const train = {
      trainNo,
      trainType,
      departureTime: info.departureTime || times[0] || '',
      arrivalTime: info.arrivalTime || times[1] || '',
      standardSeat: classifySeat(standardText),
      firstClass: classifySeat(firstClassText),
      standingSeat: classifySeat(standingText),
      freeSeat: classifySeat(freeText),
      rawText: rowText
    };

    train.detected = hasAvailableSeat(train);
    train.statusSummary = [
      `일반실 ${statusText(train.standardSeat)}`,
      `특실 ${statusText(train.firstClass)}`,
      train.standingSeat !== 'unknown' ? `입석 ${statusText(train.standingSeat)}` : '',
      train.freeSeat !== 'unknown' ? `자유석 ${statusText(train.freeSeat)}` : ''
    ].filter(Boolean).join(' · ');

    return train;
  });
}

function isWithinTimeRange(train, condition) {
  const departure = timeToMinutes(train.departureTime);
  const start = timeToMinutes(condition.startTime);
  const end = timeToMinutes(condition.endTime);
  if (departure === null || start === null || end === null) {
    return true;
  }
  return departure >= start && departure <= end;
}

function parseKorailHtml(html, condition) {
  const errorText = stripTags(html).match(/(조회된 내역이 없습니다|오류|장애|제한|잠시 후|잘못된 접근|서비스.*불가)/)?.[0] || '';
  const trains = parseRows(html)
    .filter((train) => KTX_PATTERN.test(train.trainType) || KTX_PATTERN.test(train.rawText))
    .filter((train) => isWithinTimeRange(train, condition));
  const available = trains.filter((train) => train.detected);

  return {
    trains,
    hasAvailableSeat: available.length > 0,
    availableTrains: available,
    summary: trains.length === 0
      ? (errorText || '대상 KTX 열차를 찾지 못했습니다.')
      : available.length > 0
        ? `잔여석 후보 ${available.length}개 / 대상 열차 ${trains.length}개`
        : `대상 열차 ${trains.length}개 모두 매진 또는 대기 상태`,
    errorText
  };
}

module.exports = {
  parseKorailHtml,
  classifySeat,
  timeToMinutes,
  hasAvailableSeat
};
