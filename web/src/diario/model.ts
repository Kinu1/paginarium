import type { Book, Reading } from '../../../shared/contracts'

export const formats: Record<Reading['format'], string> = {
  physical: 'Livro físico', ebook: 'E-book', audio: 'Audiobook',
}

export const statuses: Record<Book['status'], string> = {
  want: 'Quero ler', reading: 'Lendo', rereading: 'Relendo', read: 'Lido',
}

export function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function formattedMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1))
}

export function formattedDate(day: string) {
  if (day.length === 7) return formattedMonth(day)
  const [year, month, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(year, month - 1, d))
}

export function ratingText(value: number | null) {
  return value === null ? 'Sem nota' : value.toLocaleString('pt-BR') + ' de 5 luas'
}

export function setStatus(book: Book, status: Book['status'], today = dateKey()): Book {
  if (status === book.status) return book
  const current = [...book.readings].reverse().find(reading => !reading.finished)
  const hasFinished = book.readings.some(reading => Boolean(reading.finished))
  const starting = status === 'reading' || status === 'rereading'
  let readings = book.readings
  if ((starting && !current) || (status === 'read' && !current && !hasFinished)) {
    const reading: Reading = {
      id: crypto.randomUUID(), format: 'physical', days: [], finished: status === 'read' ? today : null,
      rating: null, favorite: false, review: '',
    }
    readings = [...readings, reading]
  } else if (status === 'read' && current) {
    readings = readings.map(reading => reading.id === current.id ? { ...reading, finished: today } : reading)
  }
  return { ...book, status, readings }
}

export interface HistoryFilter {
  year: number
  month: string
  format: string
  tags: string[]
  rating: string
  favorite: boolean
}

interface HistoryEntry {
  book: Book
  reading: Reading
}

function matches(book: Book, reading: Reading, filter: HistoryFilter) {
  if (filter.format && reading.format !== filter.format) return false
  if (filter.favorite && !reading.favorite) return false
  if (filter.rating === 'none' && reading.rating !== null) return false
  if (filter.rating && filter.rating !== 'none' && reading.rating !== Number(filter.rating)) return false
  return filter.tags.every(tag => book.tags.includes(tag))
}

export function completedByWork(books: Book[], filter: HistoryFilter) {
  const period = filter.month ? filter.year + '-' + filter.month : String(filter.year)
  const byWork = new Map<string, HistoryEntry[]>()
  for (const book of books) {
    for (const reading of book.readings) {
      if (!reading.finished?.startsWith(period) || !matches(book, reading, filter)) continue
      const key = book.workKey || book.id
      const entries = byWork.get(key) ?? []
      entries.push({ book, reading })
      byWork.set(key, entries)
    }
  }
  const byLatest = (a: HistoryEntry, b: HistoryEntry) => b.reading.finished!.localeCompare(a.reading.finished!)
  return [...byWork.values()].map(entries => entries.sort(byLatest)).sort((a, b) => byLatest(a[0], b[0]))
}

export function activityByDay(books: Book[], filter: HistoryFilter, month: string) {
  const dates = new Map<string, HistoryEntry[]>()
  for (const book of books) {
    for (const reading of book.readings) {
      if (!matches(book, reading, filter)) continue
      for (const day of reading.days) {
        if (day.slice(0, 7) !== month) continue
        const entries = dates.get(day) ?? []
        entries.push({ book, reading })
        dates.set(day, entries)
      }
    }
  }
  return dates
}
