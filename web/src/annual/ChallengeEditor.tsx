import { useState, type FormEvent } from 'react'
import type { ChallengeFormat, ChallengeRules, PersonalChallenge } from '../../../shared/challenges'
import { colors, letters, squares } from './model'

export const formatNames: Record<ChallengeFormat, string> = {
  list: 'Lista de metas', bingo: 'Bingo 5×5', alphabet: 'A–Z', rainbow: 'Arco-íris', competition: 'Competição de 22 livros',
}
function initialItems(format: ChallengeFormat): ChallengeRules['items'] {
  switch (format) {
    case 'list': return [{ key: crypto.randomUUID(), label: '' }]
    case 'bingo': return squares.flatMap((label, i) => i === 12 ? [] : [{ key: String(i), label }])
    case 'alphabet': return letters.map(key => ({ key, label: 'Ler um título com a letra ' + key }))
    case 'rainbow': return Object.keys(colors).map(key => ({ key, label: 'Ler um livro com a cor ' + key.toLocaleLowerCase('pt-BR') }))
    case 'competition': return []
  }
}
export function itemName(format: ChallengeFormat, key: string, index: number) {
  if (format === 'bingo') return 'Casa ' + (Number(key) + 1)
  if (format === 'alphabet') return 'Letra ' + key
  if (format === 'rainbow') return key
  return 'Meta ' + (index + 1)
}
export function ChallengeEditor({ initial, busy, onSave, cancel }: {
  initial?: PersonalChallenge
  busy: boolean
  onSave: (rules: ChallengeRules) => void
  cancel: () => void
}) {
  const [rules, setRules] = useState<ChallengeRules>(() => initial?.rules ?? {
    name: '', description: '', instructions: '', format: 'list', items: initialItems('list'),
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ ...rules, name: rules.name.trim() })
  }
  return <form className="challenge-editor" onSubmit={submit}><fieldset disabled={busy}>
    <legend>{initial ? 'Editar desafio' : 'Criar desafio privado'}</legend>
    <label>Nome do desafio<input value={rules.name} maxLength={120} required onChange={e => setRules({ ...rules, name: e.target.value })}/></label>
    <label>Formato do desafio<select value={rules.format} disabled={!!initial} onChange={e => {
      const format = e.target.value as ChallengeFormat
      setRules({ ...rules, format, items: initialItems(format) })
    }}>{Object.entries(formatNames).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    <label>Descrição<textarea rows={2} maxLength={1200} value={rules.description} onChange={e => setRules({ ...rules, description: e.target.value })}/></label>
    <label>Instruções<textarea rows={3} maxLength={4000} value={rules.instructions} onChange={e => setRules({ ...rules, instructions: e.target.value })}/></label>
    {rules.items.map((item, i) => <div className="challenge-item-edit" key={item.key}><label>{itemName(rules.format, item.key, i)}
      <input required maxLength={300} value={item.label} onChange={e => setRules({ ...rules, items: rules.items.map((prior, j) => j === i ? { ...prior, label: e.target.value } : prior) })}/>
    </label>{rules.format === 'list' && rules.items.length > 1 && <button type="button" aria-label={'Remover meta ' + (i + 1)}
      onClick={() => setRules({ ...rules, items: rules.items.filter(row => row.key !== item.key) })}>Remover</button>}</div>)}
    {rules.format === 'list' && rules.items.length < 100 && <button type="button"
      onClick={() => setRules({ ...rules, items: [...rules.items, { key: crypto.randomUUID(), label: '' }] })}>Adicionar meta</button>}
    <div className="challenge-actions"><button type="submit" className="jr-primary">{initial ? 'Salvar alterações' : 'Salvar desafio'}</button>
      <button type="button" onClick={cancel}>Cancelar</button></div>
  </fieldset></form>
}
