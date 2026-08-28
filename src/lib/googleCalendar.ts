import type { GameNight } from '../types'
import { getGoogleCalendarAccessToken } from './firebase'

type GoogleCalendarEvent = {
  id: string
  htmlLink?: string
}

export async function syncGameNightToGoogleCalendar(gameNight: GameNight, existingEventId?: string) {
  const token = await getGoogleCalendarAccessToken()
  const eventId = existingEventId ? encodeURIComponent(existingEventId) : ''
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events${eventId ? `/${eventId}` : ''}`
  const response = await fetch(endpoint, {
    method: eventId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: gameNight.title,
      description: [
        gameNight.gameTitle ? `Game: ${gameNight.gameTitle}` : '',
        gameNight.note || '',
        'Scheduled with Checkpoint.',
      ].filter(Boolean).join('\n\n'),
      start: { dateTime: gameNight.startAt },
      end: { dateTime: gameNight.endAt },
      visibility: 'private',
      extendedProperties: { private: { checkpointGameNightId: gameNight.id } },
    }),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message || 'Google Calendar could not add this game night.')
  }
  return response.json() as Promise<GoogleCalendarEvent>
}
