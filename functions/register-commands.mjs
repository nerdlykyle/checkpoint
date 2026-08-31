const applicationId = process.env.DISCORD_APPLICATION_ID
const botToken = process.env.DISCORD_BOT_TOKEN

if (!applicationId || !botToken) {
  throw new Error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering commands.')
}

const userInstall = [1]
const allContexts = [0, 1, 2]
const commands = [
  {
    name: 'reminder',
    description: 'Set a personal Checkpoint reminder (Central time by default)',
    type: 1,
    integration_types: userInstall,
    contexts: allContexts,
    options: [
      { type: 3, name: 'message', description: 'What should Checkpoint remind you about?', required: true, max_length: 1500 },
      { type: 3, name: 'date', description: 'Date in YYYY-MM-DD format', required: true, min_length: 10, max_length: 10 },
      { type: 3, name: 'time', description: 'Time such as 7:00 PM or 19:00', required: true, max_length: 12 },
      { type: 3, name: 'timezone', description: 'Defaults to Central if omitted', required: false, choices: Object.keys({ Central: 1, Eastern: 1, Mountain: 1, Pacific: 1 }).map((name) => ({ name, value: name })) },
      { type: 6, name: 'user', description: 'Who should receive the personal DM? Defaults to you.', required: false },
    ],
  },
  {
    name: 'checkpoint',
    description: 'Share the crew’s Checkpoint plans',
    type: 1,
    integration_types: userInstall,
    contexts: allContexts,
    options: [
      { type: 1, name: 'tonight', description: 'Share tonight’s game night in this chat' },
      { type: 1, name: 'next', description: 'Share the current Up next queue in this chat' },
    ],
  },
]

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: 'PUT',
  headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(commands),
})
if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${await response.text()}`)
const registered = await response.json()
console.log(`Registered ${registered.length} global Checkpoint commands: ${registered.map((command) => `/${command.name}`).join(', ')}`)
