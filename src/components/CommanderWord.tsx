import { Textarea } from '@/components/ui/textarea'

// "דבר המלך" — a shared, optional narrative block on ALL THREE page types. One component, reused in
// every editor and viewer. Empty = not rendered (viewer) / just an empty field (editor).

export function CommanderWordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">דבר המלך (אופציונלי)</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="הוסף את דבר המלך — הקשר, דגשים או הנחיות..."
        className="text-right resize-none"
        rows={4}
      />
    </div>
  )
}

// Viewer content — sits inside the numbered "דבר המלך" SectionCard (which supplies num + title).
// Quote-style tinted block. Renders nothing when empty.
export function CommanderWordView({ text }: { text?: string }) {
  if (!text?.trim()) return null
  return (
    <div className="rounded-lg border-r-4 border-primary bg-[#F0FBFF] px-5 py-4">
      <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap font-heebo">{text}</p>
    </div>
  )
}
