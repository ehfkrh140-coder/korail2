let alarmActive = false;
let lastAlertAt = null;

function markAvailability(result) {
  if (result && result.hasAvailableSeat) {
    alarmActive = true;
    lastAlertAt = new Date().toISOString();
  }
}

function stopAlarm() {
  alarmActive = false;
  return getNotifierState();
}

function getNotifierState() {
  return {
    alarmActive,
    lastAlertAt
  };
}

module.exports = {
  markAvailability,
  stopAlarm,
  getNotifierState
};
