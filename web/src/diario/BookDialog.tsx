import { useEffect, useRef, useState } from 'react'
import type { Book, Reading } from '../../../shared/contracts'
import { Calendar } from './Calendar'
import { MoonRating } from './MoonRating'
import { draftKey, readDraft, recoverDraft } from './draft'
import { dateKey, formattedDate, formats, setStatus, statuses } from './model'
import { pageProgress, readingProblem } from './readingDefaults'
import { BookCover } from '../components/BookCover'
import { BookManagement, type DeleteBook, type EditBook } from '../components/BookManagement'

interface Props {
  book: Book
  ownerKey: string
  initialReadingId?: string
  onClose: () => void
  onSave: (book: Book) => Promise<Book>
  onEdit: EditBook
  onDelete: DeleteBook
}

function ReadingEditor({ reading, update }: { reading: Reading; update: (patch: Partial<Reading>) => void }) {
  const today = dateKey()
  const [month, setMonth] = useState(() => (reading.finished || reading.days.at(-1) || today).slice(0, 7))
  const [calendarShown, setCalendarShown] = useState(false)
  const [monthOnly, setMonthOnly] = useState(reading.finished?.length === 7)
  const days = new Set(reading.days)
  const isComplete = reading.finished !== null
  const finishLimit = reading.finished?.length === 7
    ? dateKey(new Date(Number(reading.finished.slice(0, 4)), Number(reading.finished.slice(5)), 0))
    : reading.finished
  const latestDay = finishLimit && finishLimit < today ? finishLimit : today
  function toggleDay(day: string) {
    if (days.has(day)) days.delete(day)
    else days.add(day)
    update({ days: [...days].sort() })
  }
  function togglePrecision(checked: boolean) {
    setMonthOnly(checked)
    if (!reading.finished) return
    const prefix = reading.finished.slice(0, 7)
    const defaultDay = [...reading.days].sort().reverse().find(day => day.startsWith(prefix))
    update({ finished: checked ? prefix : defaultDay ?? (prefix === today.slice(0, 7) ? today : prefix + '-01') })
  }
  return <div className="jr-reading">
    <div className="jr-two">
      <label>Formato da leitura<select value={reading.format} onChange={e => {
        const format = e.target.value as Reading['format']
        update(format === 'audio' || reading.format === 'audio' ?
          {format, currentPage:null, totalPages:null, progressPercent:null} : {format})
      }}>
        {Object.entries(formats).map(([key, text]) => <option value={key} key={key}>{text}</option>)}
      </select></label>
      <div className="jr-field"><span>Dias de leitura</span>
        <button className="jr-calendar-toggle" type="button" aria-expanded={calendarShown} onClick={() => setCalendarShown(!calendarShown)}>
          {reading.days.length === 0 ? 'Dias não registrados' : reading.days.length + (reading.days.length === 1 ? ' dia registrado' : ' dias registrados')}
          <span aria-hidden="true">{calendarShown ? '−' : '+'}</span>
        </button>
      </div>
    </div>
    <label>Data de início<input type="date" min="1000-01-01" max={latestDay} value={reading.started ?? ''}
      onChange={e=>update({started:e.target.value || null})}/></label>
    {reading.format === 'audio' ?
      <label>Progresso do audiobook (%)<input type="number" min={0} max={100} step={1} value={reading.progressPercent ?? ''}
        onChange={e=>update({progressPercent:e.target.value === '' ? null : e.target.valueAsNumber})}/></label> :
      <div className="jr-progress">
        <div className="jr-two">
          <label>Página atual<input type="number" min={0} max={reading.totalPages ?? undefined} value={reading.currentPage ?? ''} onChange={e=>{
            const currentPage = e.target.value === '' ? null : e.target.valueAsNumber
            update({currentPage, progressPercent:pageProgress(currentPage,reading.totalPages)})
          }}/></label>
          <label>Total de páginas<input type="number" min={1} value={reading.totalPages ?? ''} onChange={e=>{
            const totalPages = e.target.value === '' ? null : e.target.valueAsNumber
            update({totalPages, progressPercent:pageProgress(reading.currentPage,totalPages)})
          }}/></label>
        </div>
        {reading.progressPercent != null && <p aria-live="polite">Progresso da leitura · {reading.progressPercent}%</p>}
      </div>}
    {calendarShown && <Calendar month={month} onMonth={setMonth} selected={days} onDay={toggleDay}
      latestDay={latestDay} />}
    {isComplete && <div className="jr-completion">
      <label>{monthOnly ? 'Mês de conclusão' : 'Data de conclusão'}
        <input type={monthOnly ? 'month' : 'date'} required value={reading.finished ?? ''}
          min={monthOnly ? '1000-01' : '1000-01-01'} max={monthOnly ? today.slice(0, 7) : today}
          onChange={event => update({ finished: event.target.value })} />
      </label>
      <label className="jr-check"><input type="checkbox" checked={monthOnly} onChange={e => togglePrecision(e.target.checked)} />Sei apenas o mês e o ano</label>
      <MoonRating value={reading.rating} onChange={rating => update({ rating })} />
      <button type="button" className="jr-favorite" aria-pressed={reading.favorite} onClick={() => update({ favorite: !reading.favorite })}>
        <span aria-hidden="true">{reading.favorite ? '♥' : '♡'}</span>{reading.favorite ? 'Leitura favorita' : 'Marcar como favorita'}
      </button>
    </div>}
    <label>Minha resenha<textarea maxLength={30000} rows={6} placeholder="O que ficou com você depois da leitura?"
      value={reading.review} onChange={e => update({ review: e.target.value })} /></label>
  </div>
}

export function BookDialog({ book, ownerKey, initialReadingId, onClose, onSave, onEdit, onDelete }: Props) {
  const key = draftKey(ownerKey, book.id)
  const [draft] = useState(() => readDraft(key, book.id))
  const [outdated, setOutdated] = useState(Boolean(draft && draft.base.revision !== book.revision))
  const [base, setBase] = useState(book)
  const [value, setValue] = useState(() => draft && !outdated ? draft.book : book)
  const [selectedId, setSelectedId] = useState(initialReadingId ?? draft?.readingId ?? value.readings.at(-1)?.id ?? '')
  const [tag, setTag] = useState('')
  const [planYear, setPlanYear] = useState(() => String(new Date().getFullYear()))
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'reading'|'edit'|'delete'>('reading')
  const manageTrigger = useRef<HTMLButtonElement | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(draft && !outdated ? 'Rascunho recuperado neste aparelho.' : '')
  const dialog = useRef<HTMLDialogElement>(null)
  const selected = value.readings.find(r => r.id === selectedId) ?? value.readings.at(-1)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  function edit(next: Book, id = selected?.id ?? '', original = base) {
    setValue(next)
    setError('')
    try {
      localStorage.setItem(key, JSON.stringify({ base:original, book: next, readingId: id }))
      setMessage('Rascunho salvo neste aparelho.')
    } catch {
      setMessage('Armazenamento local indisponível. Mantenha a ficha aberta até salvar.')
    }
  }
  function backToReading() {
    setPanel('reading')
    requestAnimationFrame(()=>manageTrigger.current?.focus())
  }
  const editMetadata:EditBook = async (original, metadata, file) => {
    const saved = await onEdit(original,metadata,file)
    const next = {...value, title:saved.title, author:saved.author, coverUrl:saved.coverUrl, revision:saved.revision}
    setBase(saved)
    if (JSON.stringify(value) !== JSON.stringify(base)) edit(next, selected?.id, saved)
    else { setValue(saved); setMessage('Dados do livro atualizados.') }
    backToReading()
    return saved
  }
  const deleteBook:DeleteBook = async original => {
    await onDelete(original)
    try { localStorage.removeItem(key) } catch { /* A exclusão da estante já foi concluída. */ }
  }
  function changeStatus(status: Book['status']) {
    const next = setStatus(value, status)
    const id = next.readings.at(-1)?.id ?? ''
    setSelectedId(id)
    edit(next, id)
  }
  function addTag() {
    const name = tag.trim()
    if (!name) return
    if (!value.tags.some(t => t.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0)) {
      if (value.tags.length >= 40) { setError('Use até 40 tags por livro.'); return }
      edit({ ...value, tags: [...value.tags, name] })
    }
    setTag('')
  }
  function updateReading(patch: Partial<Reading>) {
    if (!selected) return
    edit({ ...value, readings: value.readings.map(r => r.id === selected.id ? { ...r, ...patch } : r) })
  }
  function changePlan() {
    const year = Number(planYear)
    if (!/^\d{4}$/.test(planYear) || year < 1000) { setError('Informe um ano válido com quatro dígitos.'); return }
    const years = new Set(value.plannedYears)
    if (years.has(year)) years.delete(year)
    else years.add(year)
    edit({ ...value, plannedYears: [...years].sort((a, b) => a - b) })
  }
  async function save() {
    if (busy || outdated) return
    const validation = value.readings.map(readingProblem).find(Boolean)
    if (validation) { setError(validation); return }
    if (value.readings.some(r => r.review.length > 30000)) {
      setError('A união dos rascunhos ultrapassou 30.000 caracteres. Revise o texto antes de salvar.')
      return
    }
    if (value.readings.some(r => r.finished !== null && (!r.finished ||
      r.days.some(day => day.slice(0, r.finished!.length) > r.finished!)))) {
      setError('A conclusão deve ficar no último dia de leitura ou depois dele.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(value)
      try { localStorage.removeItem(key) } catch { /* O envio já foi concluído. */ }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.')
      setBusy(false)
    }
  }
  return <dialog className="jr-dialog" ref={dialog} aria-labelledby="jr-book-title"
    onCancel={event => { event.preventDefault(); if (!busy) { if(panel === 'reading') onClose(); else backToReading() } }}>
    {panel !== 'reading' ? <BookManagement book={base} action={panel} busy={busy} setBusy={setBusy} onEdit={editMetadata}
      onDelete={deleteBook} onBack={backToReading}/> :
    <form className="jr-sheet" onSubmit={event => { event.preventDefault(); void save() }}>
      <header className="jr-book-head">
        <div className="jr-head-art" aria-hidden="true"><BookCover title={value.title} coverUrl={value.coverUrl}/></div>
        <div><p>Ficha do livro</p><h2 id="jr-book-title">{value.title}</h2><span>{value.author}</span></div>
        <button className="jr-close" type="button" aria-label="Fechar ficha" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div className="jr-body">
        {outdated && draft && <section className="jr-conflict" aria-label="Recuperação do rascunho">
          <h3>A ficha foi atualizada em outro acesso</h3>
          <p>Restaure os campos editados neste aparelho. Se a mesma leitura foi iniciada ou a resenha mudou nos dois acessos, os textos serão reunidos para você revisar antes de salvar.</p>
          <button type="button" onClick={() => { setOutdated(false); edit(recoverDraft(draft, book), draft.readingId) }}>Restaurar meu rascunho</button>
          <button type="button" onClick={() => {
            setOutdated(false); try { localStorage.removeItem(key) } catch { /* A ficha atual está carregada. */ }
            setMessage('Ficha atual carregada.')
          }}>Descartar o rascunho</button>
        </section>}
        <fieldset className="jr-fields" disabled={busy || outdated}>
          <legend className="jr-sr">Organização e leitura</legend>
          <div className="book-actions">
            <button type="button" ref={manageTrigger} onClick={()=>setPanel('edit')}>Editar livro</button>
            <button type="button" onClick={()=>setPanel('delete')}>Excluir livro</button>
          </div>
          <div className="jr-two">
            <label>Situação na estante<select value={value.status} onChange={event => changeStatus(event.target.value as Book['status'])}>
              {Object.entries(statuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select></label>
            <div className="jr-field"><label htmlFor="jr-plan">Lista anual</label><div className="jr-inline">
              <input id="jr-plan" type="number" min="1000" max="9999" value={planYear} onChange={e => setPlanYear(e.target.value)} />
              <button type="button" onClick={changePlan}>{value.plannedYears.includes(Number(planYear)) ? 'Remover' : 'Incluir'}</button>
            </div></div>
          </div>
          {value.plannedYears.length > 0 && <p className="jr-meta">Na lista de {value.plannedYears.join(', ')}</p>}
          <div className="jr-field"><label htmlFor="jr-tag">Tags do livro</label>
            <div className="jr-inline"><input id="jr-tag" placeholder="Ex.: romance nacional" value={tag}
              maxLength={64} onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
              <button type="button" onClick={addTag} disabled={!tag.trim()}>Adicionar</button></div>
            {value.tags.length > 0 && <div className="jr-chips">{value.tags.map(t => <button type="button" key={t}
              aria-label={'Remover tag ' + t} onClick={() => edit({ ...value, tags: value.tags.filter(v => v !== t) })}>{t} <span aria-hidden="true">×</span></button>)}</div>}
          </div>
          {selected && <section className="jr-record">
            <div className="jr-record-title"><h3>{value.readings.length > 1 ? 'Minhas leituras' : 'Minha leitura'}</h3>
              {value.status === 'read' && <button type="button" className="jr-link" onClick={() => changeStatus('rereading')}>Iniciar releitura</button>}
              {value.status === 'abandoned' && <button type="button" className="jr-link" onClick={() => changeStatus(value.readings.some(r=>r.finished) ? 'rereading' : 'reading')}>Retomar leitura</button>}
            </div>
            {value.readings.length > 1 && <label>Ficha da leitura<select value={selected.id} onChange={e => setSelectedId(e.target.value)}>
              {value.readings.map((r, index) => <option key={r.id} value={r.id}>{index + 1}ª leitura · {r.finished ? formattedDate(r.finished) : 'Em andamento'}</option>)}
            </select></label>}
            <ReadingEditor key={selected.id} reading={selected} update={updateReading} />
          </section>}
        </fieldset>
        {error && <p className="jr-error" role="alert">{error}</p>}
      </div>
      <footer className="jr-footer"><span role="status">{message}</span><button className="jr-primary" disabled={busy || outdated}
        type="submit">{busy ? 'Salvando…' : 'Salvar ficha'}</button></footer>
    </form>}
  </dialog>
}
