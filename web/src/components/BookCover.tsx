import { createContext, useContext, useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { Journal } from '../data'
import { isPrivateCover } from './coverFile'

export const CoverContext = createContext<Pick<Journal, 'cover'> | null>(null)

export function BookCover({
  title,
  coverUrl,
  className = '',
}: {
  title: string
  coverUrl: string | null
  className?: string
}) {
  const [broken, setBroken] = useState<string | null>(null)
  const journal = useContext(CoverContext)
  const [privateImage, setPrivateImage] = useState<{ path: string; src: string } | null>(null)
  useEffect(() => {
    if (!journal || !isPrivateCover(coverUrl)) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    journal
      .cover(coverUrl, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setPrivateImage({ path: coverUrl, src: objectUrl })
      })
      .catch(() => {
        /* Uma capa indisponível usa a ilustração com o título. */
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [coverUrl, journal])
  const src = isPrivateCover(coverUrl)
    ? privateImage?.path === coverUrl
      ? privateImage.src
      : null
    : coverUrl
  return (
    <span className={'book-cover ' + className}>
      {src && broken !== src ? (
        <img src={src} alt="" onError={() => setBroken(src)} referrerPolicy="no-referrer" />
      ) : (
        <span className="fallback-cover">
          <BookOpen size={24} strokeWidth={1} />
          <span>{title}</span>
        </span>
      )}
    </span>
  )
}
