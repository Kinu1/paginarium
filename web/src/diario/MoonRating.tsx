import { useId } from 'react'
import { Moon } from 'lucide-react'
import { ratingText } from './model'

export function Moons({ value }: { value: number | null }) {
  return <span className="jr-moons" aria-hidden="true">{[0, 1, 2, 3, 4].map(n => {
    const level = Math.min(1, Math.max(0, (value ?? 0) - n))
    return <span key={n} className="jr-luna">
      <Moon aria-hidden="true" strokeWidth={1.4} />
      <Moon aria-hidden="true" strokeWidth={1.4} fill="currentColor"
        style={{clipPath:'inset(0 ' + (100 - level * 100) + '% 0 0)'}} />
    </span>
  })}</span>
}

export function MoonRating({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const id = useId()
  return <div className="jr-rating">
    <label htmlFor={id}>Avaliação em luas</label>
    <div className="jr-rating-controls">
      <button type="button" aria-label="Diminuir um quarto de lua" disabled={value === null || value === 0}
        onClick={() => onChange(Math.max(0,(value ?? 0) - .25))}>−</button>
      <div className="jr-rating-input">
      <Moons value={value} />
      <input type="range" id={id} min="0" max="5" step="0.25" value={value ?? 0} aria-valuetext={ratingText(value)}
        onChange={event => onChange(Number(event.target.value))} />
      </div>
      <button type="button" aria-label="Aumentar um quarto de lua" disabled={value === 5}
        onClick={() => onChange(Math.min(5,(value ?? 0) + .25))}>+</button>
    </div>
    <div className="jr-rating-detail">
      <output htmlFor={id}>{ratingText(value)}</output>
      {value === null
        ? <button className="jr-link" type="button" onClick={() => onChange(0)}>Dar nota zero</button>
        : <button className="jr-link" type="button" onClick={() => onChange(null)}>Limpar nota</button>}
    </div>
  </div>
}
