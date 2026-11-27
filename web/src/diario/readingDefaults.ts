import type { Book, Reading } from '../../../shared/contracts'

// Rascunhos e estantes de demonstração anteriores ao acompanhamento permanecem válidos.
export function withReadingDefaults(book: Book): Book {
  return {
    ...book,
    readings: book.readings.map((reading) => ({
      ...reading,
      started: reading.started ?? null,
      currentPage: reading.currentPage ?? null,
      totalPages: reading.totalPages ?? null,
      progressPercent: reading.progressPercent ?? null,
    })),
  }
}

export function pageProgress(currentPage: number | null, totalPages: number | null) {
  return currentPage !== null && totalPages && currentPage <= totalPages
    ? Math.round((currentPage / totalPages) * 100)
    : null
}

export function readingProblem(reading: Reading): string | null {
  const { started, finished, currentPage, totalPages, progressPercent } = reading
  if (started && finished && started.slice(0, finished.length) > finished)
    return 'A data de início deve ficar antes da conclusão ou no mesmo dia.'
  if (started && reading.days.some((day) => day < started))
    return 'Há dias de leitura anteriores à data de início.'
  if (currentPage != null && (!Number.isSafeInteger(currentPage) || currentPage < 0))
    return 'Informe uma página atual inteira, a partir de zero.'
  if (totalPages != null && (!Number.isSafeInteger(totalPages) || totalPages < 1))
    return 'Informe um total inteiro de pelo menos uma página.'
  if (currentPage != null && totalPages != null && currentPage > totalPages)
    return 'A página atual não pode superar o total de páginas.'
  if (progressPercent != null && (progressPercent < 0 || progressPercent > 100))
    return 'Informe um percentual entre 0 e 100.'
  return null
}
