const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { logger } = require('firebase-functions')
const { onRequest } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const { DateTime } = require('luxon')
const nacl = require('tweetnacl')
const { TIME_ZONES, parseReminderDate } = require('./time')

initializeApp()

const discordBotToken = defineSecret('DISCORD_BOT_TOKEN')
const discordPublicKey = defineSecret('DISCORD_PUBLIC_KEY')
const checkpointBoardId = defineString('CHECKPOINT_BOARD_ID', { default: '4b39bba9-4b6a-47ce-bc73-85d1985aad28' })
const checkpointUrl = defineString('CHECKPOINT_URL', { default: 'https://nerdlykyle.github.io/checkpoint/' })

function interactionResponse(content, ephemeral = false) {
  return { type: 4, data: { content, flags: ephemeral ? 64 : undefined, allowed_mentions: { parse: [], users: [] } } }
}

function verifyDiscordRequest(req) {
  const signature = req.get('X-Signature-Ed25519')
  const timestamp = req.get('X-Signature-Timestamp')
  if (!signature || !timestamp || !req.rawBody) return false
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + req.rawBody.toString('utf8')),
    Buffer.from(signature, 'hex'),
    Buffer.from(discordPublicKey.value(), 'hex'),
  )
}

function commandOption(interaction, name) {
  return interaction.data?.options?.find((option) => option.name === name)?.value
}

function interactionUser(interaction) {
  return interaction.user || interaction.member?.user
}

async function discordApi(path, options = {}) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...options,
    headers: { Authorization: `Bot ${discordBotToken.value()}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${await response.text()}`)
  if (response.status === 204) return null
  return response.json()
}

async function createPersonalReminder(interaction) {
  const creator = interactionUser(interaction)
  const message = String(commandOption(interaction, 'message') || '').trim()
  const date = String(commandOption(interaction, 'date') || '').trim()
  const time = String(commandOption(interaction, 'time') || '').trim()
  const zoneLabel = String(commandOption(interaction, 'timezone') || 'Central')
  const targetUserId = String(commandOption(interaction, 'user') || creator?.id || '')
  const parsed = parseReminderDate(date, time, zoneLabel)
  if (!creator || !message || !parsed) return interactionResponse('Use a date like `2026-09-06` and a time like `7:00 PM` or `19:00`.', true)
  if (parsed.toMillis() <= Date.now()) return interactionResponse('That reminder time is in the past. Pick a future date and time.', true)
  const target = interaction.data?.resolved?.users?.[targetUserId]
  const targetName = target?.global_name || target?.username || (targetUserId === creator.id ? 'you' : `<@${targetUserId}>`)
  const reminder = {
    message: message.slice(0, 1500),
    creatorUserId: creator.id,
    creatorName: creator.global_name || creator.username,
    targetUserId,
    sourceChannelId: interaction.channel_id || null,
    dueAt: Timestamp.fromMillis(parsed.toMillis()),
    timezone: zoneLabel,
    timezoneId: parsed.zoneName,
    status: 'pending',
    createdAt: Timestamp.now(),
  }
  await getFirestore().collection('discordReminders').add(reminder)
  const unix = Math.floor(parsed.toSeconds())
  const abbreviation = parsed.offsetNameShort
  return interactionResponse(`⏰ Reminder set for **${targetName}**\n**${message}**\n<t:${unix}:F> · ${zoneLabel} (${abbreviation}) · <t:${unix}:R>\n\nAt that time, Checkpoint will send a personal Discord DM. The confirmation stays here in the group chat.`)
}

function boardGameNightMessage(data) {
  const nowCentral = DateTime.now().setZone(TIME_ZONES.Central)
  const nights = Array.isArray(data.gameNights) ? data.gameNights : []
  const tonight = nights.filter((night) => DateTime.fromISO(night.startAt).setZone(TIME_ZONES.Central).hasSame(nowCentral, 'day')).sort((a, b) => a.startAt.localeCompare(b.startAt))[0]
  if (!tonight) return `🌙 No game night is scheduled for tonight yet.\n${checkpointUrl.value()}`
  const unix = Math.floor(DateTime.fromISO(tonight.startAt).toSeconds())
  const endUnix = Math.floor(DateTime.fromISO(tonight.endAt).toSeconds())
  return [`🎮 **${tonight.title}**`, tonight.gameTitle ? `**Game:** ${tonight.gameTitle}` : '', `**When:** <t:${unix}:F>–<t:${endUnix}:t> · <t:${unix}:R>`, tonight.note ? `**Plan:** ${tonight.note}` : '', checkpointUrl.value()].filter(Boolean).join('\n')
}

async function checkpointCommand(interaction) {
  const subcommand = interaction.data?.options?.[0]?.name
  const snapshot = await getFirestore().doc(`boards/${checkpointBoardId.value()}`).get()
  const data = snapshot.data() || {}
  if (subcommand === 'tonight') return interactionResponse(boardGameNightMessage(data))
  const games = Array.isArray(data.games) ? data.games : []
  const queue = games.filter((game) => game.status === 'up-next')
  if (!queue.length) return interactionResponse(`📚 The Up next queue is empty.\n${checkpointUrl.value()}`)
  return interactionResponse([`🏁 **Checkpoint — Up next**`, ...queue.slice(0, 10).map((game, index) => `${index + 1}. **${game.title}**${game.votes?.length ? ` · ${game.votes.length} vote${game.votes.length === 1 ? '' : 's'}` : ''}`), checkpointUrl.value()].join('\n'))
}

exports.discordInteractions = onRequest({ region: 'us-central1', secrets: [discordBotToken, discordPublicKey] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')
  if (!verifyDiscordRequest(req)) return res.status(401).send('Invalid request signature')
  const interaction = req.body
  if (interaction.type === 1) return res.json({ type: 1 })
  if (interaction.type !== 2) return res.json(interactionResponse('That interaction is not supported yet.', true))
  try {
    if (interaction.data?.name === 'reminder') return res.json(await createPersonalReminder(interaction))
    if (interaction.data?.name === 'checkpoint') return res.json(await checkpointCommand(interaction))
    return res.json(interactionResponse('Unknown Checkpoint command.', true))
  } catch (error) {
    logger.error('Discord interaction failed', error)
    return res.json(interactionResponse('Checkpoint hit a snag. Please try that command again.', true))
  }
})

async function claimReminder(document) {
  const database = getFirestore()
  return database.runTransaction(async (transaction) => {
    const latest = await transaction.get(document.ref)
    if (!latest.exists || latest.get('status') !== 'pending') return null
    transaction.update(document.ref, { status: 'sending', sendingAt: Timestamp.now() })
    return latest.data()
  })
}

async function sendReminder(document) {
  const reminder = await claimReminder(document)
  if (!reminder) return
  try {
    const channel = await discordApi('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: reminder.targetUserId }) })
    const unix = Math.floor(reminder.dueAt.toMillis() / 1000)
    await discordApi(`/channels/${channel.id}/messages`, { method: 'POST', body: JSON.stringify({ content: `⏰ **Checkpoint reminder**\n${reminder.message}\n<t:${unix}:F> · ${reminder.timezone} time\nSet by ${reminder.creatorName}.`, allowed_mentions: { parse: [] } }) })
    await document.ref.update({ status: 'sent', sentAt: Timestamp.now() })
  } catch (error) {
    logger.error('Reminder delivery failed', { reminderId: document.id, error })
    await document.ref.update({ status: 'failed', failedAt: Timestamp.now(), error: String(error).slice(0, 1000) })
  }
}

exports.deliverDiscordReminders = onSchedule({ schedule: 'every 1 minutes', region: 'us-central1', secrets: [discordBotToken], retryCount: 0 }, async () => {
  const due = await getFirestore().collection('discordReminders').where('status', '==', 'pending').where('dueAt', '<=', Timestamp.now()).limit(50).get()
  await Promise.all(due.docs.map(sendReminder))
})
