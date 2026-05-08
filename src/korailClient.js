const { parseKorailHtml } = require('./parser');

const KORAIL_SEARCH_URL = 'https://www.letskorail.com/ebizprd/EbizPrdTicketPr21111_i1.do';
const STATION_CODES = {
  서울: '0001',
  용산: '0104',
  영등포: '0008',
  광명: '0504',
  천안아산: '0502',
  대전: '0010',
  동대구: '0015',
  신경주: '0508',
  울산: '0509',
  부산: '0020'
};

function yyyymmdd(date) {
  return String(date || '').replace(/\D/g, '');
}

function hhmmss(time) {
  const digits = String(time || '').replace(/\D/g, '').padEnd(4, '0').slice(0, 4);
  return `${digits}00`;
}

function validateCondition(condition) {
  const required = ['from', 'to', 'date', 'startTime', 'endTime'];
  const missing = required.filter((key) => !condition[key]);
  if (missing.length > 0) {
    throw new Error(`필수 조회 조건 누락: ${missing.join(', ')}`);
  }

  const passengers = Number(condition.passengers || 1);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 9) {
    throw new Error('승객 수는 1명 이상 9명 이하로 입력하세요.');
  }
}

function buildSearchPayload(condition) {
  const passengers = Number(condition.passengers || 1);
  const params = new URLSearchParams();
  params.set('selGoTrain', '00');
  params.set('selGoTrainRa', '00');
  params.set('txtTrainNm', 'KTX');
  params.set('radJobId', '1');
  params.set('adjcCheckYn', 'N');
  params.set('txtGoStart', condition.from);
  params.set('txtGoEnd', condition.to);
  params.set('txtGoStartCode', STATION_CODES[condition.from] || '');
  params.set('txtGoEndCode', STATION_CODES[condition.to] || '');
  params.set('txtGoAbrdDt', yyyymmdd(condition.date));
  params.set('txtGoHour', hhmmss(condition.startTime));
  params.set('txtGoPage', '1');
  params.set('checkStnNm', 'Y');
  params.set('hidRsvTpCd', '03');
  params.set('txtPsgFlg_1', String(passengers));
  params.set('txtPsgFlg_2', '0');
  params.set('txtPsgFlg_3', '0');
  params.set('txtPsgFlg_4', '0');
  params.set('txtPsgFlg_5', '0');
  params.set('txtPsgFlg_8', '0');
  params.set('txtSeatAttCd_2', '000');
  params.set('txtSeatAttCd_3', '000');
  params.set('txtSeatAttCd_4', condition.seatPreference || '015');
  params.set('dlayTnumAplFlg', 'Y');
  return params;
}

async function searchKorail(condition) {
  validateCondition(condition);

  const startedAt = new Date();
  const response = await fetch(KORAIL_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 KTX-seat-monitor-local-app/1.0',
      Referer: 'https://www.letskorail.com/ebizprd/EbizPrdTicketpr21100W_pr21110.do'
    },
    body: buildSearchPayload(condition)
  });

  const html = await response.text();
  const parsed = parseKorailHtml(html, condition);

  return {
    ok: response.ok && !parsed.errorText,
    conditionId: condition.id,
    checkedAt: startedAt.toISOString(),
    httpStatus: response.status,
    ...parsed,
    error: response.ok ? parsed.errorText : `KORAIL 응답 오류: HTTP ${response.status}`
  };
}

module.exports = {
  searchKorail,
  buildSearchPayload,
  validateCondition,
  STATION_CODES
};
