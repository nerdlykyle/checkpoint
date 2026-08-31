const { DateTime } = require('luxon')

const TIME_ZONES = {
  Central: 'America/Chicago',
  Eastern: 'America/New_York',
  Mountain: 'America/Denver',
  Pacific: 'America/Los_Angeles',
}

function parseReminderDate(dateValue, timeValue, zoneLabel = 'Central') {
  const zone = TIME_ZONES[zoneLabel] || TIME_ZONES.Central
  const input = `${String(dateValue).trim()} ${String(timeValue).trim().toUpperCase().replace(/\s+/g, ' ')}`
  const formats = ['yyyy-MM-dd h:mm a', 'yyyy-MM-dd h a', 'yyyy-MM-dd H:mm', 'yyyy-MM-dd H']
  for (const format of formats) {
    const parsed = DateTime.fromFormat(input, format, { zone, locale: 'en-US' })
    if (parsed.isValid) return parsed
  }
  return null
}

module.exports = { TIME_ZONES, parseReminderDate }
