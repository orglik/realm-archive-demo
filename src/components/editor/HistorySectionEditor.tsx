import type { HistorySection } from '@/types/contentPage'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  value: HistorySection
  onChange: (value: HistorySection) => void
}

export function HistorySectionEditor({ value, onChange }: Props) {
  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">סקירת המאסטרים</h2>
        <p className="text-[13px] text-muted-foreground">
          הדבק את הסקירה שהתקבלה מהמאסטרים. עיצוב בסיסי נשמר בהדבקה: הדגשות, כותרות ורשימות…
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">תקציר לכרטיס</label>
        <p className="text-[12px] text-muted-foreground">1–2 משפטים שיוצגו בכרטיס הסקירה.</p>
        <Textarea
          value={value.teaser}
          onChange={(e) => onChange({ ...value, teaser: e.target.value })}
          placeholder="תקציר קצר..."
          className="text-right resize-none"
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">תוכן מלא</label>
          {/* Deferred: paste-formatting toolbar (Tiptap) — textarea only in Pass 1 */}
          <span className="text-[11px] text-muted-foreground border border-border rounded px-2 py-0.5 font-heebo">
            הדבקה שומרת עיצוב בסיסי
          </span>
        </div>
        <Textarea
          value={value.fullContent}
          onChange={(e) => onChange({ ...value, fullContent: e.target.value })}
          placeholder="הדבק כאן את תוכן הסקירה המלאה..."
          className="text-right resize-none font-mono text-sm"
          rows={12}
        />
      </div>
    </section>
  )
}
