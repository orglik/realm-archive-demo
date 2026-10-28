import { useRef } from 'react'
import type { MediaImage } from '@/types/contentPage'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

type Props = {
  images: MediaImage[]
  onChange: (images: MediaImage[]) => void
}

export function MediaSection({ images, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFilesChosen(files: FileList | null) {
    if (!files) return
    const newImages: MediaImage[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      src: URL.createObjectURL(file),
      name: file.name,
    }))
    onChange([...images, ...newImages])
  }

  function remove(id: string) {
    onChange(images.filter((img) => img.id !== id))
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">מדיה</h2>
        <p className="text-[13px] text-muted-foreground">העלה תמונות רלוונטיות שיוצגו בגלריית העמוד.</p>
      </div>

      {images.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">טרם נוספו תמונות</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border aspect-video bg-muted">
              <img
                src={img.src}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => remove(img.id)}
                className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus className="size-4" />
        הוסף תמונות
      </Button>
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => handleFilesChosen(e.target.files)}
      />
    </section>
  )
}
