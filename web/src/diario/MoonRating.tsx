import { useId } from 'react'
import { ratingText } from './model'

export function Moons({ value }: { value: number | null }) {
  return <span className="jr-moons" aria-hidden="true">{[0, 1, 2, 3, 4].map(n => {
    const level = Math.min(1, Math.max(0, (value ?? 0) - n))
    return <span key={n} className="jr-luna"><span style={{ clipPath: 'inset(0 ' + (100 - level * 100) + '% 0 0)' }} /></span>
  })}</span>
}

export function MoonRating({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const id = useId()
  return <div className="jr-rating">
    <label htmlFor={id}>Avaliação em luas</label>
    <div className="jr-rating-input">
      <Moons value={value} />
      <input type="range" id={id} min="0" max="5" step="0.5" value={value ?? 0} aria-valuetext={ratingText(value)}
        onChange={event => onChange(Number(event.target.value))} />
    </div>
    <div className="jr-rating-detail">
      <output htmlFor={id}>{ratingText(value)}</output>
      {value === null
        ? <button className="jr-link" type="button" onClick={() => onChange(0)}>Dar nota zero</button>
        : <button className="jr-link" type="button" onClick={() => onChange(null)}>Limpar nota</button>}
    </div>
  </div>
}
