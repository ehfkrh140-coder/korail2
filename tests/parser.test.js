const assert = require('assert');
const { parseKorailHtml, classifySeat } = require('../src/parser');

const condition = {
  id: 'test',
  startTime: '09:00',
  endTime: '13:00'
};

assert.strictEqual(classifySeat('일반실 매진'), 'soldout');
assert.strictEqual(classifySeat('특실 예약 가능'), 'available');
assert.strictEqual(classifySeat('입석 예매 가능'), 'standing_available');
assert.strictEqual(classifySeat('자유석 가능'), 'free_seat_available');
assert.strictEqual(classifySeat('예약대기'), 'waitlist');

const html = `
<table>
  <tr><th>열차</th><th>출발</th><th>도착</th><th>특실</th><th>일반실</th></tr>
  <tr>
    <td>KTX 123</td><td>광명 10:21</td><td>부산 12:48</td>
    <td>특실 예약 가능</td><td>일반실 매진</td>
  </tr>
  <tr>
    <td>KTX 125</td><td>광명 13:30</td><td>부산 15:55</td>
    <td>특실 예약 가능</td><td>일반실 예약 가능</td>
  </tr>
  <tr>
    <td>KTX 127</td><td>광명 11:10</td><td>부산 13:40</td>
    <td>특실 매진</td><td>일반실 매진</td>
  </tr>
</table>`;

const parsed = parseKorailHtml(html, condition);
assert.strictEqual(parsed.trains.length, 2);
assert.strictEqual(parsed.availableTrains.length, 1);
assert.strictEqual(parsed.hasAvailableSeat, true);
assert.strictEqual(parsed.availableTrains[0].trainNo, 'KTX123');
assert.strictEqual(parsed.trains[1].detected, false);

console.log('parser tests passed');
