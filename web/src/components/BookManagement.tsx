import { useState, type FormEvent } from 'react'
import type { Book } from '../../../shared/contracts'
import type { BookMetadata } from '../data'
import { CoverEditor, checkedCoverUrl, originalCover, type CoverChoice } from './CoverEditor'

export type EditBook = (book: Book, data: BookMetadata, file?: File) => Promise<Book>
export type DeleteBook = (book: Book) => Promise<void>

export function BookManagement({
  book,
  action,
  onEdit,
  onDelete,
  onBack,
  busy,
  setBusy,
}: {
  book: Book
  action: 'edit' | 'delete'
  onEdit: EditBook
  onDelete: DeleteBook
  onBack: () => void
  busy: boolean
  setBusy: (value: boolean) => void
}) {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author)
  const [cover, setCover] = useState<CoverChoice>(originalCover)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const removing = action === 'delete'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || preparing) return
    setError('')
    setBusy(true)
    try {
      if (removing) {
        await onDelete(book)
        return
      }
      if (!title.trim() || !author.trim()) throw new Error('Preencha o título e a autoria.')
      const metadata: BookMetadata = { title: title.trim(), author: author.trim() }
      if (cover.kind === 'url') metadata.coverUrl = checkedCoverUrl(cover.value)
      if (cover.kind === 'remove') metadata.coverUrl = null
      await onEdit(book, metadata, cover.kind === 'file' ? cover.value : undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="jr-sheet" onSubmit={submit}>
      <header className="jr-book-head">
        <div>
          <p>{book.title}</p>
          <h2 id="jr-book-title">{removing ? 'Excluir livro' : 'Editar livro'}</h2>
        </div>
      </header>
      <div className="jr-body">
        {removing ? (
          <p>
            Excluir <strong>{book.title}</strong> removerá da sua estante o livro, suas leituras, notas e
            resenhas. Essa ação é permanente.
          </p>
        ) : (
          <fieldset disabled={busy} className="jr-fields">
            <label>
              Título
              <input
                autoFocus
                required
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Autoria
              <input required maxLength={300} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <CoverEditor
              title={title}
              current={book.coverUrl}
              choice={cover}
              change={setCover}
              onBusy={setPreparing}
            />
          </fieldset>
        )}
        {error && (
          <p className="jr-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="jr-footer">
        <button type="button" className="jr-link" autoFocus={removing} disabled={busy} onClick={onBack}>
          Cancelar
        </button>
        <button
          type="submit"
          className={'jr-primary' + (removing ? ' delete-book' : '')}
          disabled={busy || preparing}
        >
          {busy ? 'Aguarde…' : removing ? 'Excluir definitivamente' : 'Salvar alterações'}
        </button>
      </footer>
    </form>
  )
}
