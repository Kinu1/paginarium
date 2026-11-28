import { useEffect, useState } from 'react'
import type { Book } from '../../../shared/contracts'
import type { Competition, CompetitionRound } from '../../../shared/competition'
import { auth } from '../auth'
import { BookCover } from '../components/BookCover'
import { challengeRequest } from './challengeApi'
import './competition.css'

const rounds: [CompetitionRound, string][] = [
  ['preliminary', 'Preliminares'], ['last16', 'Oitavas de final'], ['quarter', 'Quartas de final'],
  ['semi', 'Semifinais'], ['final', 'Final'],
]

type Props = { books: Book[]; challenge?: { id: string; revision: number; name: string }; onStarted?: () => void }

export function CompetitionPanel({ books, challenge, onStarted }: Props) {
  const [saved, setSaved] = useState<Competition[]>([])
  const [active, setActive] = useState('')
  const [name, setName] = useState('')
  const [selection, setSelection] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const privateId = challenge?.id
  useEffect(() => {
    if (!auth?.currentUser) return
    let current = true
    setLoading(true)
    setError('')
    challengeRequest<Competition[]>('/competitions').then(all => {
      if (!current) return
      const list = all.filter(item => item.challengeId === (privateId ?? null))
      setSaved(list)
      setActive(id => list.some(t => t.id === id) ? id : list[0]?.id ?? '')
    }).catch(reason => { if (current) setError(reason.message) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [privateId, reload])
  const byId = new Map(books.map(book => [book.id, book]))
  const tournament = saved.find(t => t.id === active)
  async function change(path: string, method: string, body: unknown) {
    setBusy(true)
    setError('')
    try {
      const result = await challengeRequest<Competition>(path, method, body)
      setSaved(items => [result, ...items.filter(t => t.id !== result.id)])
      setActive(result.id)
      setSelection([])
      setName('')
      if (method === 'POST') onStarted?.()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao salvar a competição.') }
    finally { setBusy(false) }
  }
  if (!auth?.currentUser) return <p>Entre na sua conta para sortear uma chave com 22 livros da sua estante.</p>
  const final = tournament?.matches.find(m => m.round === 'final')
  const champion = final?.winner && byId.get(final.winner)
  return <section className="tournament" aria-label="Competição de livros">
    {error && <p role="alert">{error} <button onClick={() => setReload(n => n + 1)}>Recarregar competição</button></p>}
    {loading ? <p role="status">Abrindo competições…</p> : <>
      {saved.length > 0 && !challenge && <label>Competição
        <select disabled={busy} value={active} onChange={e => { setActive(e.target.value); setError('') }}>
          <option value="">Criar outra competição</option>
          {saved.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>}
      {!tournament ? <form onSubmit={e => {
        e.preventDefault()
        void change(challenge ? '/challenges/' + challenge.id + '/competition' : '/competitions', 'POST',
          challenge ? { revision: challenge.revision, bookIds: selection } : { name: name.trim(), bookIds: selection })
      }}>
        <h2>{challenge?.name ?? 'Nova competição'}</h2>
        {!challenge && <label>Nome da competição<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>}
        <p>Escolha 22 livros. Seis duelos preliminares e dez vagas diretas formarão as oitavas.</p>
        <fieldset disabled={busy}><legend>Participantes · {selection.length} de 22</legend>
          <div className="competition-picks">{books.map(book => <label key={book.id}>
            <input type="checkbox" checked={selection.includes(book.id)}
              disabled={selection.length === 22 && !selection.includes(book.id)}
              onChange={e => setSelection(e.target.checked ? [...selection, book.id] : selection.filter(id => id !== book.id))} />
            {book.title}
          </label>)}</div>
        </fieldset>
        {books.length < 22 && <p>Faltam {22 - books.length} livros na estante para completar a chave.</p>}
        <button className="jr-primary" disabled={busy || selection.length !== 22 || (!challenge && !name.trim())}>Sortear chave</button>
      </form> : <>
        <h2>{tournament.name}</h2>
        {champion && <p className="an-winner" role="status">Campeão · {champion.title}</p>}
        {tournament.slots.map((id, index) => id === null && <label key={index}>Repor participante da vaga {index + 1}
          <select value="" disabled={busy} onChange={e => void change('/competitions/' + active + '/slots/' + index, 'PUT',
            { revision: tournament.revision, bookId: e.target.value })}>
            <option value="">Escolha um livro da estante</option>
            {books.filter(b => !tournament.slots.includes(b.id)).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </label>)}
        {rounds.map(([key, label]) => <section className="an-round" key={key}><h3>{label}</h3>
          {tournament.matches.filter(m => m.round === key).map(match => <div className="an-match" role="group" aria-label={match.id} key={match.id}>
            {[match.left, match.right].map((id, side) => {
              const book = id && byId.get(id)
              return book ? <button key={side} type="button" aria-pressed={match.winner === id}
                disabled={busy || tournament.slots.includes(null) || !match.left || !match.right}
                onClick={() => void change('/competitions/' + active + '/votes', 'PUT', { revision: tournament.revision, matchId: match.id, winnerId: id })}>
                <span className="an-book"><span className="an-cover" aria-hidden="true"><BookCover title={book.title} coverUrl={book.coverUrl}/></span>{book.title}</span>
              </button> : <span className="competition-pending" key={side}>A definir</span>
            })}
          </div>)}
        </section>)}
      </>}
    </>}
  </section>
}
