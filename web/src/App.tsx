import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  BookMarked,
  Bookmark,
  CalendarDays,
  CircleUserRound,
  Heart,
  History as HistoryIcon,
  LibraryBig,
  LoaderCircle,
  LogIn,
  MoonStar,
  Plus,
  Trophy,
} from 'lucide-react'
import type { Book, CatalogBook } from '../../shared/contracts'
import { auth, authMessage } from './auth'
import { ConflictError, createJournal, type BookMetadata } from './data'
import { CoverContext } from './components/BookCover'
import { Annual } from './annual'
import { BookDialog, History } from './diario'
import { AccountDialog } from './components/AccountDialog'
import { CatalogDialog } from './components/CatalogDialog'
import { Shelf } from './components/Shelf'
import { Button } from './components/ui/button'

const pages = [
  { id: 'shelf', label: 'Estante', short: 'Estante', icon: LibraryBig },
  { id: 'history', label: 'Livros lidos', short: 'Lidos', icon: HistoryIcon },
  { id: 'activity', label: 'Dias de leitura', short: 'Calendário', icon: CalendarDays },
  { id: 'annual', label: 'Desafios', short: 'Desafios', icon: Trophy },
] as const
type Page = (typeof pages)[number]['id']
type Scope = 'all' | 'planned' | 'favorites'
const titles: Record<Page, string> = { shelf: 'Minha estante', history: 'Livros lidos', activity: 'Dias de leitura', annual: 'Desafios' }
const dateLabel = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date())

function Workspace({ user, onAccount }: { user: User | null; onAccount: () => void }) {
  const journal = useMemo(() => createJournal(user), [user])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState<Page>('shelf')
  const [scope, setScope] = useState<Scope>('all')
  const [dialog, setDialog] = useState<'catalog' | null>(null)
  const [selected, setSelected] = useState<{ id: string; readingId?: string } | null>(null)
  const [toast, setToast] = useState('')
  const titleRef = useRef<HTMLHeadingElement>(null)
  const modalTrigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    journal
      .list()
      .then((items) => {
        if (active) setBooks(items)
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a estante.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [journal, retry])
  useEffect(() => {
    document.title = titles[page] + ' · Paginarium'
  }, [page])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  function navigate(target: Page, nextScope: Scope = 'all') {
    setPage(target)
    setScope(nextScope)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => titleRef.current?.focus())
  }
  function openCatalog() {
    modalTrigger.current = document.activeElement as HTMLElement
    setDialog('catalog')
  }
  function openBook(book: Book, readingId?: string) {
    if (!dialog) modalTrigger.current = document.activeElement as HTMLElement
    setDialog(null)
    setSelected({ id: book.id, readingId })
  }
  function closeModal() {
    setDialog(null)
    setSelected(null)
    requestAnimationFrame(() => {
      if (modalTrigger.current?.isConnected) modalTrigger.current.focus()
      else titleRef.current?.focus()
    })
  }
  function replace(book: Book) {
    setBooks((items) =>
      items.some((item) => item.id === book.id)
        ? items.map((item) => (item.id === book.id ? book : item))
        : [book, ...items],
    )
  }
  async function refreshAfterConflict<T>(operation:()=>Promise<T>):Promise<T> {
    try {
      return await operation()
    } catch (reason) {
      if (reason instanceof ConflictError) {
        try {
          setBooks(await journal.list())
        } catch {
          /* O rascunho permanece no diálogo durante a indisponibilidade. */
        }
      }
      throw reason
    }
  }
  async function save(book: Book) {
    const result = await refreshAfterConflict(()=>journal.save(book))
    replace(result)
    setToast('Leitura salva na sua estante.')
    return result
  }
  async function add(book: CatalogBook, file?:File) {
    const result = await journal.add(book,file)
    replace(result)
    setToast('Livro na sua estante.')
    return result
  }
  const current = books.find((item) => item.id === selected?.id)
  async function editBook(book: Book, metadata: BookMetadata, file?: File) {
    const result = await refreshAfterConflict(()=>journal.edit(book, metadata, file))
    replace(result)
    setToast('Dados do livro atualizados.')
    return result
  }
  async function deleteBook(book: Book) {
    await refreshAfterConflict(()=>journal.remove(book))
    setBooks(items => items.filter(item => item.id !== book.id))
    closeModal()
    setToast('Livro excluído da estante.')
  }
  const countRead = books.filter((book) => book.readings.some((reading) => reading.finished)).length
  const currentUser = user?.displayName || user?.email || 'Sua conta'
  return (
    <CoverContext.Provider value={journal}><div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="side">
        <button
          type="button"
          className="wordmark"
          onClick={() => navigate('shelf')}
          aria-label="Paginarium, abrir minha estante"
        >
          <img src="/marca/icone.png" alt="" />
          <span>Paginarium</span>
        </button>
        <nav aria-label="Navegação principal" className="side-nav">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-current={page === id && (id !== 'shelf' || scope === 'all') ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-collections">
          <h2>Coleções</h2>
          <button
            type="button"
            aria-pressed={scope === 'favorites' && page === 'shelf'}
            onClick={() => navigate('shelf', 'favorites')}
          >
            <Heart size={18} /> Favoritos
          </button>
          <button
            type="button"
            aria-pressed={scope === 'planned' && page === 'shelf'}
            onClick={() => navigate('shelf', 'planned')}
          >
            <Bookmark size={18} /> Lista do ano
          </button>
        </div>
        <div className="sidebar-account">
          <span className="account-avatar">{user ? <CircleUserRound /> : <MoonStar />}</span>
          <button type="button" onClick={onAccount}>
            <strong>{user ? currentUser : 'Demonstração'}</strong>
            <span>{user ? 'Gerenciar conta' : 'Entrar na minha conta'}</span>
          </button>
          <LogIn size={16} />
        </div>
      </aside>
      <main className="workspace" id="conteudo">
        <div className="utility-bar">
          <span className="mobile-brand">
            <img src="/marca/lua.png" alt="" />
            Paginarium
          </span>
          <span className="journal-label">
            <BookMarked size={16} /> Meu diário de leitura
          </span>
          <div className="utility-right">
            <time>
              <CalendarDays size={15} />
              {dateLabel}
            </time>
            <button
              type="button"
              onClick={onAccount}
              aria-label={user ? 'Gerenciar conta' : 'Entrar na minha conta'}
            >
              <CircleUserRound size={22} />
            </button>
          </div>
        </div>
        <div className="page-body">
          <header className="page-header">
            <div>
              <h1 tabIndex={-1} ref={titleRef}>
                {titles[page]}
              </h1>
              {page === 'shelf' && (
                <p>
                  {loading
                    ? 'Carregando livros…'
                    : books.length +
                      ' ' +
                      (books.length === 1 ? 'livro na estante' : 'livros na estante') +
                      ' · ' +
                      countRead +
                      ' ' +
                      (countRead === 1 ? 'livro lido' : 'livros lidos')}
                </p>
              )}
            </div>
            <Button className="add-button" onClick={openCatalog}>
              <Plus /> Adicionar livro
            </Button>
          </header>
          {!user && (
            <button type="button" className="mobile-demo" onClick={onAccount}>
              <MoonStar size={14} /> Demonstração · Entrar na minha conta
            </button>
          )}
          {page === 'shelf' && (
            <div className="mobile-collections">
              <label htmlFor="collection-scope">Coleção</label>
              <select
                id="collection-scope"
                value={scope}
                onChange={(e) => navigate('shelf', e.target.value as Scope)}
              >
                <option value="all">Todos os livros</option>
                <option value="favorites">Favoritos</option>
                <option value="planned">Lista do ano</option>
              </select>
            </div>
          )}
          {loading ? (
            <div className="workspace-notice" role="status">
              <LoaderCircle className="spin" /> Abrindo sua estante…
            </div>
          ) : error ? (
            <div className="workspace-notice" role="alert">
              <p>{error}</p>
              <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : page === 'shelf' ? (
            <Shelf key={scope} books={books} scope={scope} onOpen={openBook} onAdd={openCatalog} />
          ) : page === 'annual' ? (
            <Annual books={books} journal={journal} />
          ) : null}
          {!loading && !error && <>
            <div hidden={page !== 'history'}><History mode="finished" books={books} onOpen={openBook} visible={page === 'history'} /></div>
            <div hidden={page !== 'activity'}><History mode="activity" books={books} onOpen={openBook} visible={page === 'activity'} /></div>
          </>}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Navegação no celular">
        {pages.map(({ id, short, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={page === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            {short}
          </button>
        ))}
      </nav>
      {dialog === 'catalog' && (
        <CatalogDialog journal={journal} onClose={closeModal} onOpenBook={openBook} onAdd={add} />
      )}
      {current && (
        <BookDialog
          key={(user?.uid || 'demo') + ':' + current.id}
          book={current}
          initialReadingId={selected?.readingId}
          ownerKey={user?.uid || 'demo'}
          onClose={closeModal}
          onSave={save}
          onEdit={editBook}
          onDelete={deleteBook}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div></CoverContext.Provider>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!auth)
  const [authError, setAuthError] = useState('')
  const [account, setAccount] = useState(false)
  const accountTrigger = useRef<HTMLElement | null>(null)
  function openAccount() {
    accountTrigger.current = document.activeElement as HTMLElement
    setAccount(true)
  }
  function closeAccount() {
    setAccount(false)
    requestAnimationFrame(() => {
      if (accountTrigger.current?.isConnected) accountTrigger.current.focus()
      else document.querySelector<HTMLHeadingElement>('.page-header h1')?.focus()
    })
  }
  useEffect(() => {
    if (auth)
      return onAuthStateChanged(
        auth,
        (next) => {
          setUser(next)
          setAuthError('')
          setReady(true)
        },
        (reason) => {
          setAuthError(authMessage(reason))
          setReady(true)
        },
      )
  }, [])
  return (
    <>
      {ready ? (
        <Workspace key={user?.uid || 'demo'} user={user} onAccount={openAccount} />
      ) : (
        <main className="workspace-notice" role="status">
          Abrindo seu diário…
        </main>
      )}
      {authError && (
        <div role="alert" className="toast">
          {authError}
        </div>
      )}
      {account && <AccountDialog user={user} onClose={closeAccount} />}
    </>
  )
}
