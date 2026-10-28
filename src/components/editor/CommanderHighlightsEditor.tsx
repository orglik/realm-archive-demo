import { useState, useRef, useEffect } from 'react'
import type { CommanderHighlight } from '@/types/contentPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'

const DEFAULT_HEADINGS = [
  'נקודות מרכזיות',
  'לקחים מרכזיים',
  'כשלים והצלחות',
  'המלצות לתרגול',
  'תובנות מערכתיות',
]

export function initHighlights(): CommanderHighlight[] {
  return DEFAULT_HEADINGS.map((heading) => ({ heading, points: [] }))
}

type Props = {
  value: CommanderHighlight[]
  onChange: (value: CommanderHighlight[]) => void
}

export function CommanderHighlightsEditor({ value, onChange }: Props) {
  const highlights = value.length > 0 ? value : initHighlights()
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(highlights.map((_, i) => i).filter((i) => highlights[i].points.length > 0))
  )
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const draftInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    if (value.length === 0) onChange(initHighlights())
  }, [])

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function removePoint(catIdx: number, ptIdx: number) {
    const next = highlights.map((cat, i) =>
      i === catIdx ? { ...cat, points: cat.points.filter((_, j) => j !== ptIdx) } : cat
    )
    onChange(next)
  }

  function commitDraft(catIdx: number) {
    const text = (drafts[catIdx] ?? '').trim()
    if (!text) return
    const next = highlights.map((cat, i) =>
      i === catIdx ? { ...cat, points: [...cat.points, text] } : cat
    )
    onChange(next)
    setDrafts((d) => ({ ...d, [catIdx]: '' }))
    // Keep focus in the input
    draftInputRefs.current[catIdx]?.focus()
  }

  function addCategory() {
    const next = [...highlights, { heading: 'קטגוריה חדשה', points: [] }]
    onChange(next)
    const newIdx = next.length - 1
    setExpanded((prev) => new Set([...prev, newIdx]))
  }

  function updateHeading(i: number, heading: string) {
    onChange(highlights.map((cat, idx) => (idx === i ? { ...cat, heading } : cat)))
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">נקודות</h2>
        <p className="text-[13px] text-muted-foreground">
          סדר קטגוריות עם נקודות מרכזיות. הקטגוריות הריקות לא יוצגו בעמוד הצפייה.
        </p>
      </div>

      <div className="space-y-3">
        {highlights.map((cat, i) => {
          const isEmpty = cat.points.length === 0
          const isExpanded = expanded.has(i)

          if (isEmpty && !isExpanded) {
            return (
              <button
                key={i}
                onClick={() => toggleExpand(i)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <span>{cat.heading}</span>
                <span className="text-[11px] opacity-60">· ריק</span>
                <Plus className="size-3.5 opacity-60" />
              </button>
            )
          }

          return (
            <div key={i} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={cat.heading}
                  onChange={(e) => updateHeading(i, e.target.value)}
                  className="text-right text-sm font-semibold h-8 border-transparent bg-transparent hover:border-border focus:border-border px-2"
                />
                {isEmpty && (
                  <button
                    onClick={() => toggleExpand(i)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {cat.points.length > 0 && (
                <ul className="space-y-1.5">
                  {cat.points.map((pt, j) => (
                    <li key={j} className="flex items-start gap-2 group">
                      <span className="flex-1 text-sm text-foreground text-right leading-snug pt-0.5">{pt}</span>
                      <button
                        onClick={() => removePoint(i, j)}
                        className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Input
                ref={(el) => { draftInputRefs.current[i] = el }}
                value={drafts[i] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(i) } }}
                placeholder="נקודה חדשה... Enter מוסיף ונשאר כאן"
                className="text-right text-sm h-8 border-dashed bg-transparent placeholder:text-muted-foreground/60"
              />
            </div>
          )
        })}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={addCategory}>
        <Plus className="size-4" />
        הוספת קטגוריה
      </Button>
    </section>
  )
}
