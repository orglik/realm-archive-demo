import type { InfoGrid } from '@/types/contentPage'
import { EVENT_TYPES } from '@/types/contentPage'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

type Props = {
  value: InfoGrid
  onChange: (v: InfoGrid) => void
}

export function EventInfoGrid({ value, onChange }: Props) {
  function set<K extends keyof InfoGrid>(key: K, val: InfoGrid[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">פרטי אירוע</h2>
        <p className="text-[13px] text-muted-foreground">מלא את כל פרטי האירוע (כולם נדרשים לפרסום): תקציר, סוג האירוע, מיקום מדויק, טווח שעות, צד א׳ וצד ב׳.</p>
      </div>

      {/* תקציר */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">תקציר</label>
        <p className="text-xs text-muted-foreground">סיכום קצר מנקודת מבט כוללת — מה קרה והערכת מצב.</p>
        <Textarea
          value={value.commanderSummary}
          onChange={(e) => set('commanderSummary', e.target.value)}
          placeholder="תקציר..."
          className="text-right resize-none"
          rows={3}
        />
      </div>

      {/* סוג אירוע */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">סוג אירוע</label>
        <p className="text-xs text-muted-foreground">בחר מהרשימה. אם אין התאמה, בחר 'אחר' ופרט.</p>
        <Select
          value={value.eventType}
          onValueChange={(v) => set('eventType', v ?? '')}
        >
          <SelectTrigger className="w-56">
            <span>{value.eventType || 'בחר סוג אירוע...'}</span>
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t} label={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.eventType === 'אחר' && (
          <div className="space-y-1 pt-1">
            <label className="text-xs text-muted-foreground">פירוט</label>
            <Input
              value={value.eventTypeDetail}
              onChange={(e) => set('eventTypeDetail', e.target.value)}
              placeholder="פרט את סוג האירוע..."
              className="text-right"
            />
          </div>
        )}
      </div>

      {/* מיקום */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">מיקום</label>
        <p className="text-xs text-muted-foreground">המיקום המדויק שבו התרחש האירוע.</p>
        <Input
          value={value.sector}
          onChange={(e) => set('sector', e.target.value)}
          placeholder="מיקום ספציפי..."
          className="text-right"
        />
      </div>

      {/* טווח זמנים */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">טווח שעות</label>
        <p className="text-xs text-muted-foreground">שעת התחלה וסיום.</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">מ-</span>
            <Input
              type="time"
              value={value.timeFrom}
              onChange={(e) => set('timeFrom', e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">עד</span>
            <Input
              type="time"
              value={value.timeTo}
              onChange={(e) => set('timeTo', e.target.value)}
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* צד א׳ */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">צד א׳</label>
        <p className="text-xs text-muted-foreground">אילו יחידות השתתפו מצד א׳.</p>
        <Textarea
          value={value.forces}
          onChange={(e) => set('forces', e.target.value)}
          placeholder="פרט את צד א׳..."
          className="text-right resize-none"
          rows={2}
        />
      </div>

      {/* צד ב׳ */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">צד ב׳</label>
        <p className="text-xs text-muted-foreground">תיאור צד ב׳ — הרכב, גודל וציוד.</p>
        <Textarea
          value={value.enemy}
          onChange={(e) => set('enemy', e.target.value)}
          placeholder="פרט גורם עוין..."
          className="text-right resize-none"
          rows={2}
        />
      </div>
    </section>
  )
}
