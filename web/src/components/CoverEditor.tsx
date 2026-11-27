import { useEffect, useId, useRef, useState } from 'react'
import { BookCover } from './BookCover'
import { compressCover } from './coverFile'
import './book-management.css'

export type CoverChoice =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'url'; value: string }
  | { kind: 'file'; value: File }
export const originalCover: CoverChoice = { kind: 'keep' }

export function checkedCoverUrl(url: string): string {
  try {
    const value = new URL(url.trim())
    if (value.protocol === 'https:' && !value.username && !value.password) return value.href
  } catch {
    /* A mesma mensagem orienta todos os links inválidos. */
  }
  throw new Error('Use um link público de imagem que comece com https://.')
}

export function CoverEditor({
  title,
  current,
  choice,
  change,
  onBusy,
}: {
  title: string
  current: string | null
  choice: CoverChoice
  change: (next: CoverChoice) => void
  onBusy: (value: boolean) => void
}) {
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [image, setImage] = useState('')
  const generation = useRef(0)
  const inputId = useId()
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  useEffect(() => {
    if (choice.kind !== 'file') {
      setImage('')
      return
    }
    const url = URL.createObjectURL(choice.value)
    setImage(url)
    return () => URL.revokeObjectURL(url)
  }, [choice])
  async function fileSelected(file?: File) {
    if (!file) return
    const token = ++generation.current
    setProcessing(true)
    onBusy(true)
    setError('')
    try {
      const compressed = await compressCover(file)
      if (token === generation.current) change({ kind: 'file', value: compressed })
    } catch (cause) {
      if (token === generation.current) setError(cause instanceof Error ? cause.message : 'Imagem inválida.')
    } finally {
      if (token === generation.current) {
        setProcessing(false)
        onBusy(false)
      }
    }
  }
  let preview = choice.kind === 'file' ? image : choice.kind === 'keep' ? current : null
  if (choice.kind === 'url') {
    try {
      preview = checkedCoverUrl(choice.value)
    } catch {
      /* Aguarde o endereço completo. */
    }
  }
  return (
    <fieldset className="cover-editor">
      <legend>Capa do livro</legend>
      <div className="cover-editor-row">
        <div className="cover-preview" aria-label="Prévia da capa">
          <BookCover title={title || 'Capa'} coverUrl={preview} />
        </div>
        <div className="cover-inputs">
          <label htmlFor={inputId}>Enviar imagem</label>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void fileSelected(file)
            }}
          />
          <small>
            {processing
              ? 'Preparando a imagem…'
              : choice.kind === 'file'
                ? 'Capa preparada · ' + Math.ceil(choice.value.size / 1024) + ' KiB'
                : 'JPEG, PNG ou WebP. A imagem é ajustada para até 150 KiB.'}
          </small>
          <label htmlFor={inputId + '-url'}>Link da capa (opcional)</label>
          <input
            id={inputId + '-url'}
            type="url"
            maxLength={2000}
            placeholder="https://"
            value={choice.kind === 'url' ? choice.value : ''}
            disabled={processing}
            onChange={(event) => {
              setError('')
              change(event.target.value ? { kind: 'url', value: event.target.value } : originalCover)
            }}
          />
        </div>
      </div>
      <div className="cover-actions">
        {(current || choice.kind === 'file' || choice.kind === 'url') && choice.kind !== 'remove' && (
          <button type="button" disabled={processing} onClick={() => change({ kind: 'remove' })}>
            Remover capa
          </button>
        )}
        {choice.kind !== 'keep' && (
          <button
            type="button"
            disabled={processing}
            onClick={() => {
              setError('')
              change(originalCover)
            }}
          >
            Desfazer alteração da capa
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
