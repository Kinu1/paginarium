import { useState } from 'react'
import type { Book } from '../../../shared/contracts'
import { activityByDay, completedByWork, formattedDate, formats, ratingText } from './model'
import type { HistoryFilter } from './model'
import { Calendar } from './Calendar'
import { Moons } from './MoonRating'

const monthNames = Array.from({ length: 12 }, (_, n) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2020, n, 1)))
const ratings = Array.from({ length: 11 }, (_, n) => n / 2)
type OpenBook = (book: Book, readingId?: string) => void

function initialFilter(): HistoryFilter {
  return { year: new Date().getFullYear(), month: '', format: '', tags: [], rating: '', favorite: false }
}

function AnnualActivity({ books, filter, chooseMonth }: { books: Book[]; filter: HistoryFilter; chooseMonth: (month: string) => void }) {
  return <div className="jr-year-activity">{monthNames.map((name, n) => {
    const month = String(n + 1).padStart(2, '0')
    const prefix = filter.year + '-' + month
    const days = activityByDay(books, filter, prefix)
    const total = new Date(filter.year, n + 1, 0).getDate()
    return <button key={name} type="button" onClick={() => chooseMonth(month)} aria-label={name + ', ' + days.size + ' dias com leitura'}>
      <span className="jr-mini-title">{name}</span>
      <span className="jr-mini-grid" aria-hidden="true">
        {Array.from({ length: new Date(filter.year, n, 1).getDay() }, (_, i) => <i className="pad" key={'p' + i} />)}
        {Array.from({ length: total }, (_, i) => <i key={i} className={days.has(prefix + '-' + String(i + 1).padStart(2, '0')) ? 'active' : ''} />)}
      </span>
      <small>{days.size} {days.size === 1 ? 'dia' : 'dias'}</small>
    </button>
  })}</div>
}

export function History({ books, onOpen }: { books: Book[]; onOpen: OpenBook }) {
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter)
  const [mode, setMode] = useState<'finished' | 'activity'>('finished')
  const [activeDay, setActiveDay] = useState('')
  const allTags = [...new Set(books.flatMap(book => book.tags))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const years = new Set([new Date().getFullYear(), filter.year])
  for (const book of books) for (const r of book.readings) {
    if (r.finished) years.add(Number(r.finished.slice(0, 4)))
    for (const day of r.days) years.add(Number(day.slice(0, 4)))
  }
  const groups = completedByWork(books, filter)
  function update(patch: Partial<HistoryFilter>) {
    setFilter(previous => ({ ...previous, ...patch }))
    setActiveDay('')
  }
  function toggleTag(tag: string) {
    update({ tags: filter.tags.includes(tag) ? filter.tags.filter(t => t !== tag) : [...filter.tags, tag] })
  }
  const monthKey = filter.year + '-' + filter.month
  const activities = activityByDay(mode === 'activity' && filter.month ? books : [], filter, monthKey)
  const selectedDay = activeDay || [...activities.keys()].sort().at(-1) || ''
  const dayEntries = activities.get(selectedDay) ?? []
  const filtered = filter.tags.length > 0 || Boolean(filter.rating || filter.format || filter.favorite || filter.month)
  return <section className="jr-history" aria-label="Histórico de leituras">
    <header className="jr-history-head">
      <div className="jr-mode" role="group" aria-label="Visualização do histórico">
        <button type="button" aria-pressed={mode === 'finished'} onClick={() => setMode('finished')}>Livros lidos</button>
        <button type="button" aria-pressed={mode === 'activity'} onClick={() => setMode('activity')}>Dias de leitura</button>
      </div>
    </header>
    <div className="jr-filters">
      <label>Ano<select aria-label="Ano" value={filter.year} onChange={e => update({ year: Number(e.target.value) })}>
        {[...years].sort((a, b) => b - a).map(year => <option key={year}>{year}</option>)}
      </select></label>
      <label>Mês<select aria-label="Mês" value={filter.month} onChange={e => update({ month: e.target.value })}>
        <option value="">Ano inteiro</option>{monthNames.map((name, n) => <option key={name} value={String(n + 1).padStart(2, '0')}>{name}</option>)}
      </select></label>
      <label>Formato<select value={filter.format} onChange={e => update({ format: e.target.value })}>
        <option value="">Todos</option>{Object.entries(formats).map(([key, text]) => <option value={key} key={key}>{text}</option>)}
      </select></label>
      <label>Avaliação<select value={filter.rating} onChange={e => update({ rating: e.target.value })}>
        <option value="">Todas</option><option value="none">Sem nota</option>
        {ratings.map(rating => <option value={rating} key={rating}>{ratingText(rating)}</option>)}
      </select></label>
      <label className="jr-check"><input type="checkbox" checked={filter.favorite}
        onChange={e => update({ favorite: e.target.checked })} />Apenas favoritos</label>
    </div>
    {allTags.length > 0 && <details className="jr-filter-tags"><summary>Filtrar por tags{filter.tags.length ? ' (' + filter.tags.length + ')' : ''}</summary>
      <div className="jr-chips">{allTags.map(tag => <button type="button" key={tag} aria-pressed={filter.tags.includes(tag)}
        onClick={() => toggleTag(tag)}>{tag}</button>)}</div>
    </details>}
    {filtered && <button type="button" className="jr-link jr-clear" onClick={() => { setFilter({ ...initialFilter(), year: filter.year }); setActiveDay('') }}>Limpar filtros</button>}
    {mode === 'finished' ? <>
      <h2 className="jr-results" aria-live="polite">{groups.length} {groups.length === 1 ? 'livro lido' : 'livros lidos'}</h2>
      {groups.length === 0 ? <p className="jr-empty">{filtered
        ? 'Nenhuma leitura concluída corresponde a esses filtros.'
        : 'Suas leituras concluídas neste ano aparecerão aqui.'}</p>
        : <div className="jr-history-grid">{groups.map(entries => {
          const { book, reading } = entries[0]
          return <button type="button" className="jr-history-card" key={book.id} onClick={() => onOpen(book, reading.id)}>
            <span className="jr-history-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" loading="lazy" /> : <span>{book.title}</span>}
              {reading.favorite && <b aria-label="Favorito">♥</b>}
            </span>
            <strong>{book.title}</strong><span>{book.author}</span>
            <span className="jr-history-rating" aria-label={ratingText(reading.rating)}>{reading.rating !== null
              ? <Moons value={reading.rating} /> : 'Sem nota'}</span>
            <small>{entries.length > 1 ? entries.length + ' leituras no período' : formattedDate(reading.finished!)}</small>
          </button>
        })}</div>}
    </> : !filter.month ? <>
      <h2 className="jr-results">Atividade em {filter.year}</h2>
      <AnnualActivity books={books} filter={filter} chooseMonth={month => update({ month })} />
    </> : <div className="jr-month-activity">
      <Calendar activity month={monthKey} selected={new Set(activities.keys())} activeDay={selectedDay} onDay={setActiveDay}
        onMonth={month => update({ year: Number(month.slice(0, 4)), month: month.slice(5) })} />
      <div><h2 className="jr-results">{selectedDay ? formattedDate(selectedDay) : 'Sem atividade neste mês'}</h2>
        {dayEntries.map(({ book, reading }) => <button className="jr-day-book" key={reading.id} type="button"
          onClick={() => onOpen(book, reading.id)}>{book.title}<small>{formats[reading.format]}</small></button>)}
      </div>
    </div>}
  </section>
}
