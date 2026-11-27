import { useState } from 'react'
import type { Book } from '../../../shared/contracts'
import { activityByDay, completedByWork, formattedDate, formats, ratingText } from './model'
import type { HistoryFilter } from './model'
import { Calendar } from './Calendar'
import { Moons } from './MoonRating'
import { BookCover } from '../components/BookCover'
import './activity.css'

const monthNames = Array.from({ length: 12 }, (_, n) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2020, n, 1)))
const ratings = Array.from({ length: 21 }, (_, n) => n / 4)
type OpenBook = (book: Book, readingId?: string) => void

function initialFilter(): HistoryFilter {
  return { year: new Date().getFullYear(), month: '', format: '', tags: [], rating: '', favorite: false }
}

function AnnualActivity({ books, filter, chooseDay }: { books: Book[]; filter: HistoryFilter; chooseDay: (day: string) => void }) {
  return <div className="jr-year-activity">{monthNames.map((name, n) => {
    const month = String(n + 1).padStart(2, '0')
    const prefix = filter.year + '-' + month
    const days = activityByDay(books, filter, prefix)
    const total = new Date(filter.year, n + 1, 0).getDate()
    return <section key={name} className="jr-mini-month" aria-label={name}>
      <h3 className="jr-mini-title">{name}</h3>
      <div className="jr-mini-grid">
        {['D','S','T','Q','Q','S','S'].map((letter, index) => <span key={'w'+index} aria-hidden="true">{letter}</span>)}
        {Array.from({ length: new Date(filter.year, n, 1).getDay() }, (_, i) => <span key={'p' + i} />)}
        {Array.from({ length: total }, (_, i) => {
          const date = prefix + '-' + String(i + 1).padStart(2, '0')
          return days.has(date)
            ? <button key={date} type="button" aria-label={formattedDate(date) + ', com atividade'} onClick={() => chooseDay(date)}>{i + 1}</button>
            : <span key={date}>{i + 1}</span>
        })}
      </div>
      <small>{days.size} {days.size === 1 ? 'dia' : 'dias'}</small>
    </section>
  })}</div>
}

export function History({ books, onOpen, mode, visible }: { books: Book[]; onOpen: OpenBook; mode: 'finished' | 'activity'; visible: boolean }) {
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter)
  const [activeDay, setActiveDay] = useState('')
  if (!visible) return null
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
  return <section className="jr-history" aria-label={mode === 'finished' ? 'Conclusões' : 'Atividade de leitura'}>
    <div className="jr-filters">
      <label>Ano<select aria-label="Ano" value={filter.year} onChange={e => update({ year: Number(e.target.value) })}>
        {[...years].sort((a, b) => b - a).map(year => <option key={year}>{year}</option>)}
      </select></label>
      <label>Mês<select aria-label="Mês" value={filter.month} onChange={e => update({ month: e.target.value })}>
        <option value="">Ano inteiro</option>{monthNames.map((name, n) => <option key={name} value={String(n + 1).padStart(2, '0')}>{name}</option>)}
      </select></label>
      <label>Formato<select aria-label="Formato" value={filter.format} onChange={e => update({ format: e.target.value })}>
        <option value="">Todos</option>{Object.entries(formats).map(([key, text]) => <option value={key} key={key}>{text}</option>)}
      </select></label>
      <label>Avaliação<select aria-label="Avaliação" value={filter.rating} onChange={e => update({ rating: e.target.value })}>
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
            <span className="jr-history-cover"><BookCover title={book.title} coverUrl={book.coverUrl}/>
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
      <AnnualActivity books={books} filter={filter} chooseDay={day => { update({ month: day.slice(5, 7) }); setActiveDay(day) }} />
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
