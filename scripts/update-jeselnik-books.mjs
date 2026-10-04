import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { load } from 'cheerio'

export const SOURCE_URL = 'https://anthonyjeselnik.com/the-jeselnik-book-club'
const output = new URL('../public/jeselnik-books.json', import.meta.url)
const months = 'JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER'.split(' ')

export function parseJeselnikPage(html, savedPicks = []) {
  const $ = load(html)
  const picks = []
  let current
  let sourceYear
  let group = 0
  // The source uses separate sections for each heading, video and purchase link.
  $('p, h1, h2, h3, a, iframe').each((_, element) => {
    const node = $(element)
    const text = node.text().replace(/\s+/g, ' ').trim()
    const heading = text.match(new RegExp(`^(${months.join('|')})\\s+(20\\d{2}|DISCUSSION)$`, 'i'))
    if (heading && element.tagName !== 'a') {
      const month = months.indexOf(heading[1].toUpperCase()) + 1
      current = { monthNumber: month, group, explicitYear: /^20\d{2}$/.test(heading[2]) ? Number(heading[2]) : undefined, sourceYear }
      picks.push(current)
      return
    }
    // End the monthly list before annual favorites or unrelated page content.
    if (/^20\d{2}$/.test(text)) { current = undefined; sourceYear = Number(text); group += 1; return }
    if (!current) return
    if (element.tagName === 'a') {
      const href = node.attr('href') ?? ''
      const match = href.match(/^https:\/\/bookshop\.org\/a\/\d+\/(97[89]\d{10})(?:[?#].*)?$/)
      if (match) {
        if (current.isbn13 && current.isbn13 !== match[1]) throw new Error(`Ambiguous book for month ${current.monthNumber}`)
        current.isbn13 = match[1]
        current.bookshopUrl = href
        if (text && !/bookshop|buy on/i.test(text)) current.title = text
      }
    }
    if (element.tagName === 'iframe') {
      const match = (node.attr('src') ?? '').match(/^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})(?:[?#]|$)/)
      if (match) current.discussionUrl = `https://www.youtube.com/watch?v=${match[1]}`
    }
  })
  if (!picks.length || picks.some((pick) => !pick.isbn13)) throw new Error('Monthly picks could not be parsed safely; keeping the saved collection.')
  // First collect identities, then date each descending monthly list. The site
  // replaces "SEPTEMBER 2026" with "SEPTEMBER DISCUSSION" after its recap.
  // Anchor undated lists to a saved ISBN + calendar month, never today's year.
  const dated = []
  for (const groupId of new Set(picks.map(pick => pick.group))) {
    const entries = picks.filter(pick => pick.group === groupId)
    let offset = 0
    const offsets = entries.map((pick, index) => {
      if (index && pick.monthNumber > entries[index - 1].monthNumber) offset -= 1
      return offset
    })
    const anchors = entries.flatMap((pick, index) => pick.explicitYear ? [pick.explicitYear - offsets[index]] : [])
    if (entries[0].sourceYear) anchors.push(entries[0].sourceYear)
    if (!anchors.length) {
      for (const [index, pick] of entries.entries()) {
        const matches = savedPicks.filter(saved => saved.isbn13 === pick.isbn13 && /^20\d{2}-\d{2}$/.test(saved.month) && Number(saved.month.slice(5)) === pick.monthNumber)
        const years = new Set(matches.map(saved => Number(saved.month.slice(0, 4))))
        if (years.size > 1) throw new Error('Ambiguous saved year for an undated monthly pick.')
        if (years.size) anchors.push([...years][0] - offsets[index])
      }
    }
    if (!anchors.length) throw new Error('A month was found without an explicit source year or a verified saved book/month match.')
    if (new Set(anchors).size !== 1) throw new Error('Conflicting years in the monthly list; keeping the saved collection.')
    for (const [index, pick] of entries.entries()) {
      const { monthNumber, group: _group, explicitYear: _explicitYear, sourceYear: _sourceYear, ...metadata } = pick
      const key = `${anchors[0] + offsets[index]}-${String(monthNumber).padStart(2, '0')}`
      if (dated.some(item => item.month === key)) throw new Error(`Duplicate month ${key}`)
      dated.push({ id: `jeselnik-${key}`, month: key, ...metadata })
    }
  }
  return dated
}

export function mergePicks(previous, incoming) {
  const byMonth = new Map(previous.map((pick) => [pick.month, pick]))
  for (const pick of incoming) {
    const prior = byMonth.get(pick.month)
    byMonth.set(pick.month, prior?.isbn13 === pick.isbn13 ? { ...prior, ...pick } : pick)
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}

async function fetchData(url, json = true) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'CheckpointBookDiscovery/1.0 (https://github.com/nerdlykyle/checkpoint)' },
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`)
  return json ? response.json() : response.text()
}

async function catalogData(pick) {
  const edition = await fetchData(`https://openlibrary.org/isbn/${pick.isbn13}.json`)
  const workKey = edition.works?.[0]?.key
  const work = /^\/works\/OL\d+W$/.test(workKey ?? '') ? await fetchData(`https://openlibrary.org${workKey}.json`) : {}
  const authorKeys = (work.authors?.map((item) => item.author) ?? edition.authors ?? []).map((author) => author.key).filter((key) => /^\/authors\/OL\d+A$/.test(key)).slice(0, 4)
  const authors = []
  for (const key of authorKeys) {
    const author = await fetchData(`https://openlibrary.org${key}.json`)
    if (author.name) authors.push(author.name)
  }
  if (!authors.length || !(pick.title || work.title || edition.title)) throw new Error(`No reliable catalog match for ${pick.isbn13}`)
  const rawDescription = work.description?.value ?? work.description ?? edition.description?.value ?? edition.description ?? ''
  const text = typeof rawDescription === 'string' ? load(rawDescription).text().replace(/\s+/g, ' ').trim() : ''
  const words = text.split(/\s+/)
  const description = words.length > 24 ? `${words.slice(0, 24).join(' ')}…` : text
  const coverId = work.covers?.find((id) => id > 0) ?? edition.covers?.find((id) => id > 0)
  return {
    ...pick, title: pick.title || work.title || edition.title, authors, description,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${pick.isbn13}-L.jpg`,
    ...(workKey ? { openLibraryKey: workKey } : {}),
    metadataUrl: `https://openlibrary.org${workKey || edition.key}`,
  }
}

export async function refreshJeselnikBooks({ outputUrl = output, fetchSource = () => fetchData(SOURCE_URL, false), lookupBook = catalogData } = {}) {
  let previous = { picks: [] }
  try { previous = JSON.parse(await readFile(outputUrl, 'utf8')) } catch { /* First import. */ }
  try {
    const parsed = parseJeselnikPage(await fetchSource(), previous.picks)
    const picks = []
    for (const pick of parsed) {
      const known = previous.picks.find((item) => item.isbn13 === pick.isbn13)
      // Existing catalog data stays usable during catalog outages.
      picks.push(known?.authors?.length ? { ...known, ...pick } : await lookupBook(pick))
    }
    const feed = { version: 1, sourceUrl: SOURCE_URL, lastCheckedAt: new Date().toISOString(), picks: mergePicks(previous.picks, picks) }
    await writeFile(outputUrl, `${JSON.stringify(feed, null, 2)}\n`)
    console.log(`Jeselnik Book Club: ${picks.length} source picks; ${feed.picks.length} retained.`)
  } catch (error) {
    if (!previous.picks.length) throw error
    // Do not rewrite the last-success timestamp or publish an empty/partial list.
    console.warn(`::warning::Jeselnik refresh failed; retained ${previous.picks.length} saved picks. ${error.message}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await refreshJeselnikBooks()
