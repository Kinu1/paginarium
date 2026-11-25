import { useState } from 'react'
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  Feather,
  Heart,
  LibraryBig,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react'
import type { Book } from '../../../shared/contracts'
import { BookCover } from './BookCover'
import { Button } from './ui/button'

type Status = Book['status']
export const statusLabels: Record<Status, string> = {
  want: 'Quero ler',
  reading: 'Lendo',
  rereading: 'Relendo',
  read: 'Lido',
}
type Scope = 'all' | 'favorites' | 'planned'
const statusIcons = { want: Bookmark, reading: BookOpen, rereading: RotateCcw, read: Check }
const scopes: Record<Scope, string> = {
  all: 'Meus livros',
  favorites: 'Meus favoritos',
  planned: 'Lista do ano',
}

export function Shelf({
  books,
  scope,
  onOpen,
  onAdd,
}: {
  books: Book[]
  scope: Scope
  onOpen: (book: Book) => void
  onAdd: () => void
}) {
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [order, setOrder] = useState<'shelf' | 'az' | 'za'>('shelf')
  const [keyword, setKeyword] = useState('')
  const year = new Date().getFullYear()
  const inScope = books.filter(
    (book) =>
      scope === 'all' ||
      (scope === 'planned'
        ? book.plannedYears.includes(year)
        : book.readings.some((reading) => reading.favorite)),
  )
  const filtered = inScope.filter(
    (book) =>
      (status === 'all' || book.status === status) &&
      [book.title, book.author, ...book.tags].some((s) =>
        s.toLocaleLowerCase('pt-BR').includes(keyword.trim().toLocaleLowerCase('pt-BR')),
      ),
  )
  if (order !== 'shelf')
    filtered.sort((a, b) => (order === 'az' ? 1 : -1) * a.title.localeCompare(b.title, 'pt-BR'))
  const spotlight =
    scope === 'all'
      ? books.find((book) => book.status === 'reading' || book.status === 'rereading')
      : undefined
  const activeReading = spotlight?.readings
    .slice()
    .reverse()
    .find((reading) => reading.finished === null)
  return (
    <>
      {spotlight && (
        <section className="reading-feature" aria-label="Leitura em andamento">
          <div className="feature-copy">
            <span className="feature-kicker">
              <BookOpen size={16} /> {spotlight.status === 'rereading' ? 'Relendo agora' : 'Lendo agora'}
            </span>
            <h2>{spotlight.title}</h2>
            <p>{spotlight.author}</p>
            <Button className="feature-button" onClick={() => onOpen(spotlight)}>
              <Feather /> Registrar leitura
            </Button>
          </div>
          <div className="feature-art" aria-hidden="true">
            <span className="orbit one" />
            <span className="orbit two" />
            <span className="orbit three" />
            <Sparkles className="sparkle sp-one" />
            <span className="sparkle sp-two">✦</span>
            <span className="sparkle sp-three">✧</span>
            <span className="sparkle sp-four">✦</span>
            <BookCover title={spotlight.title} coverUrl={spotlight.coverUrl} />
          </div>
          {Boolean(activeReading?.days.length) && (
            <span className="feature-days">
              {activeReading!.days.length}{' '}
              {activeReading!.days.length === 1 ? 'dia de leitura' : 'dias de leitura'}
            </span>
          )}
        </section>
      )}
      <section className="shelf-section" aria-labelledby="shelf-books-heading">
        <div className="section-line">
          <div className="section-title">
            <h2 id="shelf-books-heading">{scopes[scope]}</h2>
            <span>{inScope.length}</span>
          </div>
          <label className="sort-control">
            <span>Ordenar</span>
            <select
              aria-label="Ordenar livros"
              value={order}
              onChange={(e) => setOrder(e.target.value as typeof order)}
            >
              <option value="shelf">Da estante</option>
              <option value="az">Título A–Z</option>
              <option value="za">Título Z–A</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <div className="shelf-tools">
          <div className="status-tabs" aria-label="Filtrar por status">
            {(['all', 'reading', 'rereading', 'want', 'read'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                {value === 'all' ? 'Todos' : value === 'read' ? 'Lidos' : statusLabels[value]}
              </button>
            ))}
          </div>
          <label className="shelf-search" htmlFor="search-shelf">
            <Search size={16} />
            <input
              id="search-shelf"
              type="search"
              aria-label="Filtrar sua estante por título, autor ou tag"
              placeholder="Filtrar estante"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
        </div>
        {filtered.length > 0 ? (
          <div className="shelf-grid">
            {filtered.map((book) => {
              const Icon = statusIcons[book.status]
              const favorite = book.readings.some((reading) => reading.favorite)
              return (
                <button
                  type="button"
                  className="shelf-book"
                  key={book.id}
                  onClick={() => onOpen(book)}
                  aria-label={
                    'Abrir ' + book.title + ', ' + book.author + ', ' + statusLabels[book.status]
                  }
                >
                  <span className="shelf-cover-wrap">
                    <BookCover title={book.title} coverUrl={book.coverUrl} />
                    {favorite && (
                      <span className="favorite-pin" aria-label="Favorito">
                        <Heart size={12} fill="currentColor" />
                      </span>
                    )}
                  </span>
                  <strong>{book.title}</strong>
                  <span className="book-author">{book.author}</span>
                  <span className={'book-status st-' + book.status}>
                    <Icon size={13} />
                    {statusLabels[book.status]}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty-shelf">
            <LibraryBig size={31} />
            <h3>
              {inScope.length
                ? 'Nenhum livro com esses filtros'
                : scope === 'all'
                  ? 'Sua estante começa aqui'
                  : scope === 'planned'
                    ? 'Sua lista do ano está vazia'
                    : 'Seus favoritos aparecerão aqui'}
            </h3>
            {inScope.length ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus('all')
                  setKeyword('')
                }}
              >
                Limpar filtros
              </Button>
            ) : scope === 'all' ? (
              <Button onClick={onAdd}>Adicionar primeiro livro</Button>
            ) : (
              <p>
                {scope === 'planned'
                  ? 'Adicione livros à lista do ano pela ficha de cada livro.'
                  : 'Marque o coração ao concluir uma leitura.'}
              </p>
            )}
          </div>
        )}
      </section>
    </>
  )
}
