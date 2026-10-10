// File import, downloads and sharing (architecture.md §4.1 files.ts).

/** Opens the system file picker. Resolves null if the user cancels. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'
    let settled = false
    const done = (f: File | null): void => {
      if (settled) return
      settled = true
      input.remove()
      window.removeEventListener('focus', onFocus)
      resolve(f)
    }
    // Older browsers have no 'cancel' event: after the dialog closes the window regains focus.
    const onFocus = (): void => {
      setTimeout(() => done(input.files?.[0] ?? null), 600)
    }
    input.addEventListener('change', () => done(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => done(null))
    document.body.appendChild(input)
    window.addEventListener('focus', onFocus, { once: true })
    input.click()
  })
}

/** Drag-and-drop a file onto an element. `accept` is a list of MIME prefixes (default ['image/']). */
export function onFileDrop(
  el: HTMLElement,
  cb: (f: File) => void,
  o: { accept?: string[]; hoverClass?: string } = {},
): () => void {
  const accept = o.accept ?? ['image/']
  let depth = 0
  const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
  const setHover = (on: boolean): void => {
    if (o.hoverClass) el.classList.toggle(o.hoverClass, on)
  }
  const onEnter = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth++
    setHover(true)
  }
  const onOver = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
  const onLeave = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) setHover(false)
  }
  const onDropEv = (e: DragEvent): void => {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth = 0
    setHover(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    const ok = files.find((f) => accept.some((a) => f.type.startsWith(a)) || (f.type === '' && /\.(png|jpe?g|webp)$/i.test(f.name)))
    if (ok) cb(ok)
  }
  el.addEventListener('dragenter', onEnter)
  el.addEventListener('dragover', onOver)
  el.addEventListener('dragleave', onLeave)
  el.addEventListener('drop', onDropEv)
  return () => {
    el.removeEventListener('dragenter', onEnter)
    el.removeEventListener('dragover', onOver)
    el.removeEventListener('dragleave', onLeave)
    el.removeEventListener('drop', onDropEv)
    setHover(false)
  }
}

export interface ImportedImage {
  image: ImageData
  w: number
  h: number
  name: string
  srcW: number
  srcH: number
}

/** The message is user-safe copy. */
export class ImportError extends Error {
  constructor(message = "That file wouldn't load.") {
    super(message)
    this.name = 'ImportError'
  }
}

async function sniffImage(f: Blob): Promise<boolean> {
  try {
    const b = new Uint8Array(await f.slice(0, 12).arrayBuffer())
    const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    return png || jpg || webp
  } catch {
    return false
  }
}

/**
 * Decode PNG, JPEG or WebP to ImageData (EXIF orientation applied). Limits the long side to maxSide
 * (default 1600); cropAspect (w/h) centre-crops first; outW/outH force an exact output size.
 * Anything else throws ImportError("That file wouldn't load.").
 */
export async function importImage(
  f: Blob,
  o: { maxSide?: number; cropAspect?: number; outW?: number; outH?: number } = {},
): Promise<ImportedImage> {
  if (!(await sniffImage(f))) throw new ImportError()
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
  } catch {
    throw new ImportError()
  }
  try {
    const srcW = bmp.width
    const srcH = bmp.height
    if (srcW < 1 || srcH < 1) throw new ImportError()
    const aspect = o.cropAspect ?? (o.outW && o.outH ? o.outW / o.outH : null)
    // source crop rectangle
    let sx = 0
    let sy = 0
    let sw = srcW
    let sh = srcH
    if (aspect && aspect > 0) {
      if (srcW / srcH > aspect) {
        sw = Math.round(srcH * aspect)
        sx = Math.round((srcW - sw) / 2)
      } else {
        sh = Math.round(srcW / aspect)
        sy = Math.round((srcH - sh) / 2)
      }
    }
    let w: number
    let h: number
    if (o.outW && o.outH) {
      w = Math.max(1, Math.round(o.outW))
      h = Math.max(1, Math.round(o.outH))
    } else {
      const maxSide = o.maxSide ?? 1600
      const k = Math.min(1, maxSide / Math.max(sw, sh))
      w = Math.max(1, Math.round(sw * k))
      h = Math.max(1, Math.round(sh * k))
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new ImportError()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h)
    const image = ctx.getImageData(0, 0, w, h)
    canvas.width = canvas.height = 0
    return { image, w, h, name: (f as File).name || 'image', srcW, srcH }
  } finally {
    bmp.close()
  }
}

export function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, type = 'image/png', quality?: number): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), type, quality)
  })
}

export function downloadBlob(b: Blob, filename: string): void {
  const url = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1500)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * Share through the OS sheet when possible; otherwise download the blob, or copy the text.
 * Returns what actually happened. A dismissed share sheet is 'failed' (do not toast a success).
 */
export async function shareOrDownload(o: {
  blob?: Blob
  filename?: string
  text?: string
  title?: string
  url?: string
}): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const name = o.filename ?? 'andrew-rankin'
  try {
    if (typeof navigator.share === 'function') {
      const data: ShareData = { title: o.title, text: o.text, url: o.url }
      if (o.blob) {
        const file = new File([o.blob], name, { type: o.blob.type || 'application/octet-stream' })
        if (navigator.canShare?.({ files: [file] })) data.files = [file]
      }
      const hasPayload = !!(data.files?.length || data.text || data.url)
      if (hasPayload && (!navigator.canShare || navigator.canShare(data))) {
        try {
          await navigator.share(data)
          return 'shared'
        } catch (e) {
          if ((e as DOMException)?.name === 'AbortError') return 'failed'
          // otherwise fall through to download or copy
        }
      }
    }
    if (o.blob) {
      downloadBlob(o.blob, name)
      return 'downloaded'
    }
    const t = [o.text, o.url].filter(Boolean).join(' ')
    if (t && (await copyText(t))) return 'copied'
  } catch {
    /* fall through */
  }
  return 'failed'
}
