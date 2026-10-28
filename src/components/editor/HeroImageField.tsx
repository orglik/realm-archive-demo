import { useRef, useState } from 'react'
import type { CaptionedImage } from '@/types/contentPage'
import { Button } from '@/components/ui/button'
import { ImagePlus, X } from 'lucide-react'

// Single hero/banner image control for the editor's header section. Reuses the compact entry idiom of
// CaptionedImageSection (file picker → CaptionedImage), for one image, inline beside the metadata
// fields rather than in its own section. Optional — no image is a valid state (viewer shows text-only).
//
// All four image fields (hero + gallery/map/dashboards) now persist the same way: a self-contained
// base64 DATA URL that survives being written to storage and reloaded with NO backend. The trade-off
// is that data URLs live inside the localStorage payload, so uploads must stay small (see
// MAX_HERO_BYTES here / MAX_IMAGE_BYTES + MAX_SECTION_BYTES in CaptionedImageSection) or a large one
// could blow the shared quota and fail OTHER pages' saves, not just its own. The aggregate backstop is
// savePage's QuotaExceededError catch. When a real file-storage endpoint lands, all four fields move
// onto it and these in-payload data URLs go away.
const MAX_HERO_BYTES = 1024 * 1024 // ~1MB source file; the base64 data URL is ~1.33× this in storage.

type Props = {
  value: CaptionedImage | null
  onChange: (image: CaptionedImage | null) => void
}

export function HeroImageField({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChosen(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    // Reject (not just warn) oversize files: the data URL goes into the shared localStorage budget,
    // so letting a large one through could break unrelated pages' saves — a hard stop is safer.
    if (file.size > MAX_HERO_BYTES) {
      setError(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). המקסימום הוא 1MB.`)
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => onChange({ id: crypto.randomUUID(), src: String(reader.result), name: file.name })
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">תמונת שער (אופציונלי)</label>
      {value ? (
        <div className="flex items-start gap-3">
          <div className="relative group rounded-lg overflow-hidden border border-border w-48 aspect-video bg-muted shrink-0">
            <img src={value.src} alt={value.name} className="w-full h-full object-cover" />
            <button
              onClick={() => { onChange(null); setError(null) }}
              aria-label="הסר תמונת שער"
              className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground pt-1 min-w-0 break-all">{value.name}</p>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="size-4" />
          הוסף תמונת שער
        </Button>
      )}
      {error && <p className="text-xs text-destructive font-heebo">{error}</p>}
      <p className="text-[11px] text-muted-foreground">עד 1MB · התמונה נשמרת עם הדף</p>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        // reset value so re-picking the same file after an error still fires onChange
        onChange={(e) => { handleFileChosen(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
