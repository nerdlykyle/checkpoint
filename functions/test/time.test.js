const assert = require('node:assert/strict')
const test = require('node:test')
const { parseReminderDate } = require('../time')

test('defaults to daylight-saving-aware Central time', () => {
  const reminder = parseReminderDate('2026-09-06', '7:00 PM')
  assert.equal(reminder.zoneName, 'America/Chicago')
  assert.equal(reminder.hour, 19)
  assert.equal(reminder.offsetNameShort, 'CDT')
})

test('accepts Eastern, Mountain, and Pacific labels', () => {
  assert.equal(parseReminderDate('2026-12-06', '7 PM', 'Eastern').zoneName, 'America/New_York')
  assert.equal(parseReminderDate('2026-12-06', '19:00', 'Mountain').zoneName, 'America/Denver')
  assert.equal(parseReminderDate('2026-12-06', '19', 'Pacific').zoneName, 'America/Los_Angeles')
})

test('rejects input formats that the command does not promise', () => {
  assert.equal(parseReminderDate('September 6', 'tonight'), null)
})
