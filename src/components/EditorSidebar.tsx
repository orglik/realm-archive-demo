import { Check } from 'lucide-react'

export type SidebarSection = {
  id: string
  label: string
  required?: boolean
  complete: boolean
}

type Props = {
  pageTypeLabel: string
  sections: SidebarSection[]
  active: string
  onSelect: (id: string) => void
}

export function EditorSidebar({ pageTypeLabel, sections, active, onSelect }: Props) {
  const requiredSections = sections.filter((s) => s.required)
  const donCount = requiredSections.filter((s) => s.complete).length
  const totalRequired = requiredSections.length
  const missingSections = requiredSections.filter((s) => !s.complete)

  return (
    <aside className="w-full lg:w-auto shrink-0">

      {/* ── Mobile / tablet: horizontal pill tabs ── */}
      <div className="lg:hidden overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-1.5 min-w-max">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <button
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={[
                  'whitespace-nowrap px-3 py-1.5 text-sm rounded-full border transition-all flex items-center gap-1 font-heebo',
                  isActive
                    ? 'bg-[#F0F8FF] text-[#458FFF] border-[#21AEFF]/30 font-semibold'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
                ].join(' ')}
              >
                {section.label}
                {section.required && (
                  <span className="text-[#21AEFF] opacity-70 text-xs">*</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Desktop: vertical sidebar ── */}
      <div className="hidden lg:flex flex-col w-[300px] bg-card border border-card-border rounded-xl overflow-hidden sticky top-[65px]">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-card-border">
          <p className="text-[11px] font-bold text-muted-foreground tracking-[0.1em] uppercase font-heebo">
            {pageTypeLabel}
          </p>
        </div>

        {/* Section list */}
        <nav className="py-1.5 flex-1">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <button
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={[
                  'w-full px-4 py-2.5 text-sm transition-colors flex items-center gap-3',
                  isActive
                    ? 'bg-[#F0F8FF] text-[#458FFF]'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted/30',
                ].join(' ')}
              >
                {/* Completion circle */}
                <span className={[
                  'size-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  section.complete
                    ? 'bg-[#21AEFF] border-[#21AEFF]'
                    : 'border-border bg-transparent',
                ].join(' ')}>
                  {section.complete && <Check className="size-2.5 text-white stroke-[3]" />}
                </span>

                <span className="flex-1 text-right">
                  {section.label}
                  {section.required && (
                    <span className="text-[#21AEFF] opacity-70 mr-0.5 text-xs">*</span>
                  )}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Bottom readiness panel */}
        <div className="mx-3 mb-3 mt-1 rounded-xl bg-[#F0FBFF] px-3 py-2.5">
          {donCount >= totalRequired ? (
            <p className="text-[13px] text-green-700 font-medium">
              כל {totalRequired} סעיפי החובה הושלמו ✓
            </p>
          ) : (
            <>
              <p className="text-[13px] text-foreground">
                {donCount} מתוך {totalRequired} סעיפי חובה הושלמו.
              </p>
              {missingSections.length > 0 && (
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  נדרש: {missingSections.map((s) => s.label).join(', ')}.
                </p>
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <p className="text-[11px] text-muted-foreground px-4 pb-3 -mt-1">
          <span className="text-[#21AEFF]">*</span> שדה חובה לפרסום
        </p>
      </div>
    </aside>
  )
}
