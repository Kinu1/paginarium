import { useState } from 'react'
import { BookOpen } from 'lucide-react'

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
  return (
    <span className={'book-cover ' + className}>
      {coverUrl && broken !== coverUrl ? (
        <img src={coverUrl} alt="" onError={() => setBroken(coverUrl)} referrerPolicy="no-referrer" />
      ) : (
        <span className="fallback-cover">
          <BookOpen size={24} strokeWidth={1} />
          <span>{title}</span>
        </span>
      )}
    </span>
  )
}
