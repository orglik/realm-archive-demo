import { useRef, useState } from 'react'
import type { CaptionedImage } from '@/types/contentPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, ImageOff } from 'lucide-react'

// Shared multi-image upload control for gallery / map / dashboards across all three editors. Images
// persist as self-contained base64 DATA URLs (the same approach proven for heroImage), so they survive
// a save + reload with NO backend — replacing the former blob URLs that had to be stripped to '' on
// save (and were therefore lost).
//
// SIZE GUARDS — data URLs live INSIDE the page's localStorage payload, and that payload shares one
// ~5MB origin quota with every other page. Publishing also DUPLICATES content into publishedSnapshot,
// so a published page's image bytes count roughly twice. Two guards here catch the common cases early
// with a clear message:
//   • per-image  — blocks a single oversized file (same 1MB bar as heroImage).
//   • per-section — bounds the cumulative data-URL bytes of ONE section (this component only ever sees
//                   its own `images` array, so a per-section total is the tightest bound it can enforce
//                   in one shared place without threading cross-section budget through every editor).
// Neither can guarantee the cross-section / cross-page TOTAL stays under quota — only savePage's
// QuotaExceededError catch can (it rejects the save cleanly rather than throwing a raw DOMException).
// These guards just make that ceiling far less likely to be hit, with an in-context error when it is.
const MAX_IMAGE_BYTES = 1024 * 1024        // 1MB per source file (matches heroImage)
const MAX_SECTION_BYTES = 2 * 1024 * 1024  // 2MB of stored data-URL text across a single section

// Estimate the stored (base64 data-URL) size of a not-yet-read file: base64 is ~4/3 of the raw bytes.
function estimateEncodedBytes(rawBytes: number): number {
  return Math.ceil(rawBytes * 4 / 3)
}

type Props = {
  title: string
  guidance: string
  required?: boolean
  images: CaptionedImage[]
  onChange: (images: CaptionedImage[]) => void
}

export function CaptionedImageSection({ title, guidance, required, images, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFilesChosen(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setError(null)

    // 1) Reject any single oversize file up front (clear per-file message).
    const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES)
    if (tooBig) {
      setError(`הקובץ "${tooBig.name}" גדול מדי (${(tooBig.size / 1024 / 1024).toFixed(1)}MB). המקסימום לתמונה הוא 1MB.`)
      return
    }

    // 2) Section budget: bytes already stored in this section + estimated bytes of the incoming batch.
    //    Existing data URLs are ASCII, so src.length ≈ their stored byte count (legacy stripped images
    //    have src '' → 0, so old data neither counts against nor is disturbed by the budget).
    const existingBytes = images.reduce((n, img) => n + (img.src?.length ?? 0), 0)
    const incomingBytes = files.reduce((n, f) => n + estimateEncodedBytes(f.size), 0)
    if (existingBytes + incomingBytes > MAX_SECTION_BYTES) {
      setError(
        `התמונות בקטע זה חורגות מהמכסה (עד ${(MAX_SECTION_BYTES / 1024 / 1024).toFixed(0)}MB לקטע). ` +
        `הסר תמונות קיימות או השתמש בקבצים קטנים יותר.`
      )
      return
    }

    // 3) Read all as data URLs (self-contained → persist through save + reload). Add the batch only
    //    once every file has been read, so a mid-batch read error doesn't leave a partial set.
    Promise.all(
      files.map(
        (file) =>
          new Promise<CaptionedImage>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ id: crypto.randomUUID(), src: String(reader.result), name: file.name })
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
      )
    )
      .then((newImages) => onChange([...images, ...newImages]))
      .catch(() => setError('שגיאה בקריאת קובץ תמונה. נסה שוב.'))
  }

  function remove(id: string) {
    setError(null)
    onChange(images.filter((img) => img.id !== id))
  }

  function updateCaption(id: string, caption: string) {
    onChange(images.map((img) => (img.id === id ? { ...img, caption } : img)))
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
          {required && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#21AEFF]/30 text-[#21AEFF] bg-[#F0F8FF]">
              חובה לפרסום
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">{guidance}</p>
      </div>

      {images.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">טרם נוספו תמונות</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {images.map((img) => (
            <div key={img.id} className="space-y-2">
              <div className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                {img.src ? (
                  <img
                    src={img.src}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // Legacy item saved before image persistence shipped: src was stripped to '' and the
                  // data is gone for good — never pass '' to <img src> (broken-icon + a console warning).
                  // Editor context calls for an actionable placeholder (unlike the read-only viewer,
                  // which just omits these), so the analyst knows to re-upload rather than wonder why a
                  // slot looks broken.
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-center px-2 bg-muted/60">
                    <ImageOff className="size-5 text-muted-foreground/70" />
                    <p className="text-[11px] text-muted-foreground leading-snug">תמונה ישנה — יש להעלות מחדש</p>
                  </div>
                )}
                <button
                  onClick={() => remove(img.id)}
                  className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <Input
                value={img.caption ?? ''}
                onChange={(e) => updateCaption(img.id, e.target.value)}
                placeholder="כיתוב (אופציונלי)..."
                className="text-right text-xs h-7"
              />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive font-heebo">{error}</p>}

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus className="size-4" />
        הוסף תמונות
      </Button>
      <p className="text-[11px] text-muted-foreground">עד 1MB לתמונה · התמונות נשמרות עם הדף</p>
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        ref={fileInputRef}
        // reset value so re-picking the same file after an error still fires onChange
        onChange={(e) => { handleFilesChosen(e.target.files); e.target.value = '' }}
      />
    </section>
  )
}
