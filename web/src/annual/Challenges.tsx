import { useEffect, useState } from 'react'
import type { Book } from '../../../shared/contracts'
import type { ChallengeFormat, ChallengeRules, PersonalChallenge, TemplatePage } from '../../../shared/challenges'
import type { Journal } from '../data'
import { auth } from '../auth'
import { Annual } from './index'
import { CompetitionPanel } from './Competition'
import { challengeRequest } from './challengeApi'
import { ChallengeEditor, formatNames, itemName } from './ChallengeEditor'
import { BookCover } from '../components/BookCover'
import './community.css'

type Tab = 'mine' | 'community' | 'create'
type Props = { books: Book[]; journal: Journal; onAccount: () => void }

export function Challenges({ books, journal, onAccount }: Props) {
  const [tab, setTab] = useState<Tab>('mine')
  const [mine, setMine] = useState<PersonalChallenge[]>([])
  const [active, setActive] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [format, setFormat] = useState<ChallengeFormat | ''>('')
  const [page, setPage] = useState(1)
  const [catalog, setCatalog] = useState<TemplatePage | null>(null)
  const signed = !!auth?.currentUser
  useEffect(() => {
    if (!signed || tab !== 'mine') return
    let active = true
    challengeRequest<PersonalChallenge[]>('/challenges/mine')
      .then(items => { if (active) setMine(items) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [signed, tab, reload])
  useEffect(() => {
    if (!signed || tab !== 'community') return
    let active = true
    setCatalog(null)
    const query = new URLSearchParams({ page: String(page), pageSize: '12' })
    if (format) query.set('format', format)
    challengeRequest<TemplatePage>('/challenges/templates?' + query)
      .then(result => { if (active) setCatalog(result) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [signed, tab, format, page, reload])
  const current = mine.find(c => c.id === active)
  function navigate(next: Tab) {
    setTab(next); setActive(''); setEditing(false); setError('')
  }
  async function save(path: string, method: string, body: unknown) {
    setError(''); setBusy(true)
    try {
      const saved = await challengeRequest<PersonalChallenge>(path, method, body)
      setMine(items => [saved, ...items.filter(c => c.id !== saved.id)])
      setActive(saved.id); setEditing(false); setTab('mine')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o desafio.') }
    finally { setBusy(false) }
  }
  function saveRules(rules: ChallengeRules) {
    if (!current) return void save('/challenges', 'POST', { rules })
    const keys = new Set(rules.items.map(i => i.key))
    const progress = Object.fromEntries(Object.entries(current.progress).filter(([k]) => keys.has(k)))
    void save('/challenges/' + current.id, 'PUT', { revision: current.revision, rules, progress })
  }
  function setItem(key: string, value: string) {
    if (!current) return
    const progress = { ...current.progress }
    if (value) progress[key] = value
    else delete progress[key]
    void save('/challenges/' + current.id, 'PUT', { revision: current.revision, rules: current.rules, progress })
  }
  return <section className="annual community"><nav className="an-tabs" aria-label="Área de desafios">
    {([['mine','Meus desafios'],['community','Comunidade'],['create','Criar desafio']] as const).map(([id, text]) =>
      <button key={id} disabled={busy} aria-pressed={tab === id} onClick={() => navigate(id)}>{text}</button>)}
  </nav>
    {error && <p role="alert">{error} <button onClick={() => {
      setEditing(false); setError(''); setReload(n => n + 1)
    }}>{editing ? 'Descartar minhas alterações e carregar a versão atual' : 'Atualizar desafios'}</button></p>}
    {!signed && tab !== 'mine' ? <div className="challenge-card"><p>Entre na sua conta para criar e copiar desafios.</p><button onClick={onAccount}>Entrar na minha conta</button></div>
      : tab === 'create' || editing ? <ChallengeEditor key={current?.id ?? 'new'} initial={current} busy={busy} onSave={saveRules} cancel={() => { setEditing(false); setTab('mine') }}/>
      : tab === 'community' ? <>
        <label className="challenge-filter">Filtrar por formato<select value={format} onChange={e => {setFormat(e.target.value as typeof format); setPage(1)}}>
          <option value="">Todos os formatos</option>{Object.entries(formatNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select></label>
        {!catalog ? !error && <p role="status">Abrindo comunidade…</p> : <>
          {catalog.items.length === 0 && <p>Nenhum modelo publicado para este filtro.</p>}
          <div className="challenge-cards">{catalog.items.map(t => <article className="challenge-card" key={t.id}>
            <small>{formatNames[t.rules.format]}</small><h2>{t.rules.name}</h2><p>{t.rules.description}</p>
            <details><summary>Ver regras</summary><p>{t.rules.instructions}</p>
              <ol>{t.rules.items.map(i => <li key={i.key}>{i.label}</li>)}</ol>
            </details><button disabled={busy} onClick={() => void save('/challenges/templates/' + t.id + '/copy', 'POST', {})}>Copiar desafio</button>
          </article>)}</div>
          {catalog.total > catalog.pageSize && <nav className="challenge-actions" aria-label="Páginas da comunidade">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {page} de {Math.ceil(catalog.total / catalog.pageSize)}</span>
            <button disabled={page * catalog.pageSize >= catalog.total} onClick={() => setPage(page + 1)}>Próxima</button>
          </nav>}
        </>}
      </> : current ? <article className="challenge-detail">
        <button onClick={() => navigate('mine')} disabled={busy}>Voltar aos meus desafios</button>
        <h2>{current.rules.name}</h2><p>{formatNames[current.rules.format]} · {current.published ? 'Modelo publicado' : 'Privado'}</p>
        <p>{current.rules.description}</p><p>{current.rules.instructions}</p>
        <div className="challenge-actions"><button disabled={busy} onClick={() => setEditing(true)}>Editar desafio</button>
          <button disabled={busy} onClick={() => void save('/challenges/' + current.id + '/publication', 'PUT', { revision: current.revision, published: !current.published })}>
            {current.published ? 'Retirar da comunidade' : 'Publicar modelo na comunidade'}
          </button></div>
        <small>A comunidade vê o modelo e as regras. Suas escolhas de livros e seu progresso são privados.</small>
        {current.rules.format === 'competition' ? <CompetitionPanel key={current.id} books={books} challenge={{ id: current.id, revision: current.revision, name: current.rules.name }} onStarted={() => setReload(n=>n+1)}/>
          : <div className={'challenge-progress format-' + current.rules.format}>{current.rules.items.map((item, i) => {
            const value = current.progress[item.key] ?? ''
            const book = books.find(b => b.id === value)
            return <div className="challenge-progress-item" key={item.key}><small>{itemName(current.rules.format, item.key, i)}</small>
              <label>{item.label}<select value={value} disabled={busy} onChange={e => setItem(item.key, e.target.value)}>
                <option value="">Pendente</option><option value="*">Concluído</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select></label>{book && <span className="an-book"><span className="an-cover" aria-hidden="true"><BookCover title={book.title} coverUrl={book.coverUrl}/></span>{book.title}</span>}
            </div>
          })}{current.rules.format === 'bingo' && <div className="an-free community-free" aria-label="Casa livre"><img src="/marca/icone.png" alt=""/>Paginarium</div>}</div>}
      </article> : <>
        {mine.length > 0 && <section aria-label="Desafios pessoais"><h2>Desafios pessoais</h2>
          <div className="challenge-cards">{mine.map(c => <button className="challenge-card" key={c.id} onClick={() => setActive(c.id)}>
            <strong>{c.rules.name}</strong><small>{formatNames[c.rules.format]} · {c.published ? 'Modelo publicado' : 'Privado'}</small>
          </button>)}</div></section>}
        <Annual books={books} journal={journal}/>
      </>}
  </section>
}
