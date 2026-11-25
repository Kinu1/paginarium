import { dateKey, formattedDate, formattedMonth } from './model'

interface Props {
  month: string
  onMonth: (value: string) => void
  selected: ReadonlySet<string>
  onDay: (value: string) => void
  activeDay?: string
  activity?: boolean
  latestDay?: string
}

export function Calendar({ month, onMonth, selected, onDay, activeDay, activity = false, latestDay }: Props) {
  const [year, n] = month.split('-').map(Number)
  const first = new Date(year, n - 1, 1)
  const total = new Date(year, n, 0).getDate()
  const shift = (offset: number) => onMonth(dateKey(new Date(year, n - 1 + offset, 1)).slice(0, 7))
  const maximum = latestDay ?? dateKey()
  const navigationLimit = [maximum, ...selected].sort().at(-1)!.slice(0, 7)
  const weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
  return <div className="jr-calendar">
    <div className="jr-calendar-tools">
      <button aria-label="Mês anterior" type="button" onClick={() => shift(-1)}>‹</button>
      <label>
        <span className="jr-sr">Mês do calendário</span>
        <input aria-label="Mês do calendário" type="month" value={month} max={activity ? undefined : navigationLimit}
          onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) onMonth(event.target.value) }} />
      </label>
      <button aria-label="Próximo mês" type="button" onClick={() => shift(1)} disabled={!activity && month >= navigationLimit}>›</button>
    </div>
    <div className="jr-calendar-grid" role="group" aria-label={formattedMonth(month)}>
      {weekdays.map((name, index) => <span key={index} aria-hidden="true" className="jr-weekday">{name}</span>)}
      {Array.from({ length: first.getDay() }, (_, i) => <span key={'pad' + i} />)}
      {Array.from({ length: total }, (_, i) => {
        const day = month + '-' + String(i + 1).padStart(2, '0')
        const marked = selected.has(day)
        return <button key={day} type="button" aria-label={formattedDate(day) + (activity && marked ? ', com atividade' : '')}
          className={'jr-day' + (marked ? ' marked' : '') + (activeDay === day ? ' current' : '')}
          aria-pressed={activity ? activeDay === day : marked}
          disabled={activity ? !marked : day > maximum && !marked} onClick={() => onDay(day)}>{i + 1}</button>
      })}
    </div>
  </div>
}
