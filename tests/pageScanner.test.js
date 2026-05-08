const assert = require('assert');
const { parseVisibleTrainTexts, classifySeatText } = require('../src/pageScanner');

assert.strictEqual(classifySeatText('일반실 매진'), 'soldout');
assert.strictEqual(classifySeatText('특실 예매'), 'available');
assert.strictEqual(classifySeatText('입석 가능'), 'available');
assert.strictEqual(classifySeatText('예약대기'), 'waitlist');

const trains = parseVisibleTrainTexts([
  'KTX 123 광명 10:21 부산 12:48 일반실 매진 특실 예매',
  'KTX 125 광명 11:10 부산 13:40 일반실 매진 특실 매진',
  'KTX 127 광명 12:00 부산 14:20 예약대기'
]);

assert.strictEqual(trains.length, 3);
assert.strictEqual(trains[0].trainNo, 'KTX 123');
assert.strictEqual(trains[0].departureTime, '10:21');
assert.strictEqual(trains[0].arrivalTime, '12:48');
assert.strictEqual(trains[0].available, true);
assert.strictEqual(trains[1].available, false);
assert.strictEqual(trains[2].available, false);

console.log('page scanner tests passed');
