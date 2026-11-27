export const MAX_COVER_BYTES = 150 * 1024
const rasterTypes = ['image/jpeg', 'image/png', 'image/webp']

export function isPrivateCover(url: string | null): url is string {
  return !!url && /^\/books\/[a-zA-Z0-9_-]+\/cover(?:\?v=\d+)?$/.test(url)
}

export async function compressCover(source: File): Promise<File> {
  if (!rasterTypes.includes(source.type)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.')
  const src = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = src
    await image.decode().catch(() => {
      throw new Error('Este arquivo não pôde ser lido como imagem.')
    })
    const scale = Math.min(1, 1200 / Math.max(image.naturalHeight, image.naturalWidth))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    while (true) {
      context.fillStyle = '#faf8f2'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.72, 0.57]) {
        const encoded = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        )
        if (!encoded) throw new Error('O navegador não conseguiu converter a capa em JPEG.')
        if (encoded.size <= MAX_COVER_BYTES) return new File([encoded], 'capa.jpg', { type: 'image/jpeg' })
      }
      if (Math.max(canvas.width, canvas.height) <= 160) break
      canvas.width = Math.max(1, Math.floor(canvas.width * 0.75))
      canvas.height = Math.max(1, Math.floor(canvas.height * 0.75))
    }
    throw new Error('Não foi possível preparar a capa com até 150 KiB. Escolha outra imagem.')
  } finally {
    URL.revokeObjectURL(src)
  }
}
