import type { Book, Reading } from '../../../shared/contracts'

export interface Draft {
  base: Book
  book: Book
  readingId: string
}

export function draftKey(owner: string, bookId: string) {
  return 'paginarium:rascunho:' + encodeURIComponent(owner) + ':' + encodeURIComponent(bookId)
}

export function readDraft(key: string, bookId: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (draft?.base?.id === bookId && draft.book?.id === bookId && Array.isArray(draft.book.readings)
      && Array.isArray(draft.base.readings) && typeof draft.readingId === 'string') return draft
  } catch { /* O editor também funciona quando o armazenamento está indisponível. */ }
  return null
}

function changed<T>(base: T, local: T, remote: T): T {
  return JSON.stringify(base) === JSON.stringify(local) ? remote : local
}

function combineReviews(first: string, second: string) {
  return [...new Set([first, second].filter(Boolean))].join('\n\n')
}

// Aplicado somente após a escolha explícita de restaurar sobre uma versão mais recente.
export function recoverDraft(draft: Draft, remote: Book): Book {
  const { base, book: local } = draft
  const readings = [...remote.readings]
  for (const edited of local.readings) {
    const original = base.readings.find(reading => reading.id === edited.id)
    if (JSON.stringify(original) === JSON.stringify(edited)) continue
    const index = readings.findIndex(reading => reading.id === edited.id)
    if (index === -1) {
      readings.push(edited)
      continue
    }
    if (!original) continue
    const latest = readings[index]
    const merged: Reading = {
      ...latest, format: changed(original.format, edited.format, latest.format),
      finished: changed(original.finished, edited.finished, latest.finished),
      days: changed(original.days, edited.days, latest.days),
      favorite: changed(original.favorite, edited.favorite, latest.favorite),
      rating: changed(original.rating, edited.rating, latest.rating),
      review: latest.review !== original.review && edited.review !== original.review
        ? combineReviews(latest.review, edited.review) : changed(original.review, edited.review, latest.review),
    }
    readings[index] = merged
  }
  // Duas releituras iniciadas em paralelo recebem IDs diferentes. A ficha ativa
  // do servidor permanece como referência e recebe os dias e textos das duas.
  const open = readings.filter(r => !r.finished)
  let reconciled = readings
  if (open.length > 1) {
    const originalId = remote.readings.find(r => !r.finished)?.id
    const active = open.find(r => r.id === originalId) ?? open[0]
    const localActive = local.readings.find(r => !r.finished)
    const combined: Reading = { ...active, format: localActive?.format ?? active.format,
      review: [...new Set(open.map(r => r.review).filter(Boolean))].join('\n\n'),
      days: [...new Set(open.flatMap(r => r.days))].sort() }
    reconciled = readings.filter(r => r.finished || r.id === active.id)
      .map(r => r.id === active.id ? combined : r)
  }
  let status = changed(base.status, local.status, remote.status)
  if (status === 'read' && open.length) status = reconciled.some(r => r.finished) ? 'rereading' : 'reading'
  return { ...remote, readings: reconciled, status,
    plannedYears: changed(base.plannedYears, local.plannedYears, remote.plannedYears),
    tags: changed(base.tags, local.tags, remote.tags) }
}
