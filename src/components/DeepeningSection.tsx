import { useRef } from 'react'
import type { DeepeningItem } from '@/types/contentPage'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

type Props = {
  items: DeepeningItem[]
  onChange: (items: DeepeningItem[]) => void
}

export function DeepeningSection({ items, onChange }: Props) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  function updateTitle(index: number, title: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, title } : item)))
  }

  function updateType(index: number, type: 'אוגדן' | 'מסמך') {
    const base = { title: items[index].title }
    const updated: DeepeningItem =
      type === 'אוגדן'
        ? { type: 'אוגדן', ...base, url: '' }
        : { type: 'מסמך', ...base, fileName: '', fileRef: '' }
    onChange(items.map((item, i) => (i === index ? updated : item)))
  }

  function updateUrl(index: number, url: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, url } : item)))
  }

  function handleFileChosen(index: number, file: File | undefined) {
    if (!file) return
    // fileRef is a mock placeholder — replace with the storage endpoint's return value when ready
    onChange(items.map((item, i) =>
      i === index ? { ...item, fileName: file.name, fileRef: `mock://${file.name}` } : item
    ))
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    onChange([...items, { type: 'אוגדן', title: '', url: '' }])
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">העמקה</h2>
        <p className="text-[13px] text-muted-foreground">הוסף קישורים להעמקה - העלה מסמך בודד או צרף לינק. לכל פריט הזן כותרת</p>
      </div>

      {items.length === 0 && (
        <p className="text-[13px] text-muted-foreground">טרם נוספו פריטים</p>
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-border/60 rounded-lg p-4 space-y-3 bg-muted/60"
          >
            {/* Type + remove row */}
            <div className="flex items-center justify-between">
              <Select
                value={item.type}
                onValueChange={(v) => updateType(index, (v ?? 'אוגדן') as 'אוגדן' | 'מסמך')}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <span>{item.type}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="אוגדן" label="אוגדן">אוגדן</SelectItem>
                  <SelectItem value="מסמך" label="מסמך">מסמך</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 px-2"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">כותרת</label>
              <Input
                value={item.title}
                onChange={(e) => updateTitle(index, e.target.value)}
                placeholder="כותרת..."
                className="text-right h-8 text-sm"
              />
            </div>

            {/* URL — אוגדן only */}
            {item.type === 'אוגדן' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">קישור לאוגדן</label>
                <Input
                  value={item.url}
                  onChange={(e) => updateUrl(index, e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                  dir="ltr"
                />
              </div>
            )}

            {/* File upload — מסמך only */}
            {item.type === 'מסמך' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">קובץ</label>
                <div className="flex items-center gap-3">
                  {item.fileName ? (
                    <>
                      <span className="text-sm text-foreground truncate flex-1">{item.fileName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 px-2 shrink-0"
                        onClick={() => {
                          if (fileInputRefs.current[index]) fileInputRefs.current[index]!.value = ''
                          onChange(items.map((it, i) => i === index ? { ...it, fileName: '', fileRef: '' } : it))
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm"
                      onClick={() => fileInputRefs.current[index]?.click()}
                    >
                      בחר קובץ
                    </Button>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[index] = el }}
                    onChange={(e) => handleFileChosen(index, e.target.files?.[0])}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={addItem}>
        <Plus className="size-4" />
        הוסף פריט
      </Button>
    </section>
  )
}
