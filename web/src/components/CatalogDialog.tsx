import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Layers, LibraryBig, LoaderCircle, Plus, Search } from 'lucide-react'
import type { Book, CatalogBook } from '../../../shared/contracts'
import type { Journal } from '../data'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { BookCover } from './BookCover'

interface Props {
  journal: Journal
  onOpenBook: (book: Book) => void
  onAdd: (book: CatalogBook) => Promise<Book>
  onClose: () => void
}

export function CatalogDialog({ journal, onOpenBook, onAdd, onClose }: Props) {
  const [manual, setManual] = useState(false)
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState('')
  const [results, setResults] = useState<CatalogBook[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [selectedWork, setSelectedWork] = useState<CatalogBook | null>(null)
  const [editionResults, setEditionResults] = useState<CatalogBook[]>([])
  const request = useRef(0)
  useEffect(
    () => () => {
      request.current++
    },
    [],
  )
  async function runSearch(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    const current = ++request.current
    setSearching(true)
    setError('')
    setSearched(false)
    setResults([])
    setSelectedWork(null)
    try {
      const found = await journal.search(query.trim())
      if (current === request.current) {
        setResults(found)
        setSearched(true)
      }
    } catch (reason) {
      if (current === request.current)
        setError(
          reason instanceof Error ? reason.message : 'A busca ficou indisponível. Tente novamente.',
        )
    } finally {
      if (current === request.current) setSearching(false)
    }
  }
  async function add(book: CatalogBook) {
    const current = ++request.current
    setAdding(true)
    setError('')
    try {
      const saved = await onAdd(book)
      if (current === request.current) onOpenBook(saved)
    } catch (reason) {
      if (current === request.current) setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o livro.')
    } finally {
      if (current === request.current) setAdding(false)
    }
  }
  async function showEditions(book: CatalogBook) {
    const current = ++request.current
    setSelectedWork(book)
    setEditionResults([])
    setSearching(true)
    setError('')
    try {
      const editions = await journal.editions(book)
      if (current === request.current) setEditionResults(editions)
    } catch (reason) {
      if (current === request.current)
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as edições.')
    } finally {
      if (current === request.current) setSearching(false)
    }
  }
  function switchMode(next: boolean) {
    request.current++
    setSearching(false)
    setManual(next)
    setError('')
  }
  function addManual(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !author.trim()) {
      setError('Preencha o título e a autoria.')
      return
    }
    if (cover && !/^https:\/\//i.test(cover.trim())) {
      setError('Use um endereço de capa que comece com https://.')
      return
    }
    void add({
      title: title.trim(),
      author: author.trim(),
      coverUrl: cover.trim() || null,
      editionKey: null,
      workKey: null,
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="pg-dialog catalog-dialog">
        <DialogHeader>
          <span className="dialog-symbol">
            <LibraryBig size={23} />
          </span>
          <DialogTitle>{manual ? 'Adicionar manualmente' : 'Adicionar livro'}</DialogTitle>
          <DialogDescription>
            {manual
              ? 'Preencha os dados da sua edição.'
              : 'Busque pelo título, autor ou ISBN e escolha uma edição para a sua estante.'}
          </DialogDescription>
        </DialogHeader>
        {manual ? (
          <form className="stack-form" onSubmit={addManual}>
            <label htmlFor="manual-title">
              Título
              <Input
                id="manual-title"
                required
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label htmlFor="manual-author">
              Autoria
              <Input
                id="manual-author"
                required
                maxLength={300}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            <label htmlFor="manual-cover">
              Link da capa <small>(opcional)</small>
              <Input
                id="manual-cover"
                type="url"
                maxLength={2000}
                placeholder="https://"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={adding}>
              <Plus /> {adding ? 'Adicionando…' : 'Adicionar à estante'}
            </Button>
            <button type="button" className="text-action" onClick={() => switchMode(false)}>
              <ArrowLeft size={15} /> Voltar à busca
            </button>
          </form>
        ) : (
          <>
            <form className="catalog-search" onSubmit={runSearch}>
              <label className="sr-only" htmlFor="catalog-query">
                Título, autor ou ISBN
              </label>
              <Input
                type="search"
                id="catalog-query"
                placeholder="Título, autor ou ISBN"
                maxLength={180}
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" disabled={!query.trim() || searching}>
                <Search /> Buscar
              </Button>
            </form>
            {searching && (
              <p className="inline-notice" role="status">
                <LoaderCircle className="spin" size={17} /> Pesquisando edições…
              </p>
            )}
            {selectedWork && (
              <button
                className="text-action"
                onClick={() => {
                  request.current++
                  setSelectedWork(null)
                  setError('')
                  setSearching(false)
                }}
              >
                <ArrowLeft size={15} /> Voltar aos resultados
              </button>
            )}
            {searched && !searching && (
              <p className="result-count" role="status">
                {selectedWork
                  ? editionResults.length
                    ? 'Edições de ' + selectedWork.title
                    : 'Nenhuma outra edição disponível.'
                  : results.length
                    ? results.length + ' ' + (results.length === 1 ? 'resultado' : 'resultados')
                    : 'Nenhuma edição encontrada. Tente outra busca ou adicione o livro manualmente.'}
              </p>
            )}
            {(selectedWork ? editionResults : results).length > 0 && (
              <ul className="result-list">
                {(selectedWork ? editionResults : results).map((book, i) => (
                  <li key={(book.editionKey || book.workKey || book.title) + i}>
                    <button
                      type="button"
                      disabled={adding}
                      onClick={() => void add(book)}
                      aria-label={'Adicionar ' + book.title + ' de ' + book.author}
                    >
                      <BookCover title={book.title} coverUrl={book.coverUrl} />
                      <span className="result-info">
                        <strong>{book.title}</strong>
                        <span>{book.author}</span>
                        {book.editionKey && <small>Edição {book.editionKey.split('/').at(-1)}</small>}
                      </span>
                      <Plus size={19} />
                    </button>
                    {!selectedWork && book.workKey && (
                      <button
                        type="button"
                        className="edition-link"
                        onClick={() => void showEditions(book)}
                      >
                        <Layers size={14} /> Ver edições
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button className="manual-link" type="button" onClick={() => switchMode(true)}>
              <Plus size={17} /> Adicionar manualmente
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
