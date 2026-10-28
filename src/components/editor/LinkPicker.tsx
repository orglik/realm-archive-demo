import { useState, useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import { Input } from '@/components/ui/input'
import { Search, X, Check } from 'lucide-react'
import { formatRelativeTime } from '@/utils/dateUtils'
import { hasPublishedLinkOfType } from '@/utils/publishValidation'
import type { ContentPage } from '@/types/contentPage'

const TYPE_LABEL: Record<ContentPage['type'], string> = { topic: 'דף נושא', event: 'דף אירוע', reference: 'דף עיון' }

// Small type badge shown per row/chip so a heterogeneous candidate list is unambiguous.
function TypeBadge({ type }: { type: ContentPage['type'] }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground whitespace-nowrap shrink-0">
      {type === 'topic' ? 'נושא' : type === 'event' ? 'אירוע' : 'עיון'}
    </span>
  )
}

type Props = {
  /** Restrict candidates to one type (the topic-hierarchy child picker uses this). Omit and set
   *  anyType for the unified lateral picker that lists every page type. */
  targetType?: 'topic' | 'event'
  /** Unified mode: list all published pages of any type, with per-row type badges. */
  anyType?: boolean
  /** The page being edited — excluded from candidates, and used to detect topic→topic lateral links. */
  currentPageId?: string
  currentPageType?: ContentPage['type']
  title: string
  guidance: string
  required?: boolean
  linkedIds: string[]
  onChange: (ids: string[]) => void
  /** Ids removed from the candidate list — used to hide cycle-unsafe topics (self/ancestors/descendants). */
  excludeIds?: string[]
  /** Optional per-row note under the title — used to flag a topic already parented elsewhere (reparent). */
  noteFor?: (page: ContentPage) => string | null
  /** Bare mode: no card wrapper and no title header. */
  bare?: boolean
}

export function LinkPicker({
  targetType, anyType = false, currentPageId, title, guidance, required,
  linkedIds, onChange, excludeIds = [], noteFor, bare = false,
}: Props) {
  const fetch = useCallback(() => getPages(), [])
  const { data: pages } = useAsync(fetch)

  const [search, setSearch] = useState('')

  // Candidate pool for NEW links: any published page (unified) or one type (restricted), never the
  // page itself. Creating a fresh link stays restricted to live pages — unchanged.
  const published = (pages ?? []).filter(
    (p): p is ContentPage =>
      p.status === 'published' && p.id !== currentPageId && (anyType || p.type === targetType)
  )

  const candidates = published.filter((p) => !excludeIds.includes(p.id))
  const filtered = candidates.filter((p) => !search.trim() || p.title.includes(search.trim()))

  // EXISTING links stay visible even if the linked page has since been archived — resolved
  // independently of the published-only candidate pool above, so an archived-linked page's chip
  // doesn't silently vanish. Mirrors EditorParentBreadcrumb's divergence: analyst-facing context needs
  // visibility into archived relationships even though the reader-facing ribbon/viewer hides them
  // entirely (decision 4). Drafts stay excluded here, unchanged — this fix is scoped to archived only.
  const linkedPages = (pages ?? []).filter(
    (p): p is ContentPage =>
      (p.status === 'published' || p.status === 'archived') &&
      p.id !== currentPageId && (anyType || p.type === targetType) && linkedIds.includes(p.id)
  )

  function toggle(id: string) {
    onChange(linkedIds.includes(id) ? linkedIds.filter((i) => i !== id) : [...linkedIds, id])
  }

  // ONE call for both modes — they differ only in which page type satisfies the gate, never in how
  // "counts as satisfied" is computed. This is the same shared rule publishValidation.validateEvent
  // (the list's publish button) and EventEditor's own gate call, so the inline message below cannot
  // drift from the real gate. Previously the two modes reached "published-only" by two different
  // routes (one calling the shared rule, one length-checking a locally filtered list) — correct at the
  // time, but two routes to one guarantee is exactly how the three earlier copies drifted apart.
  //   anyType (the unified links picker) → the EVENT publish rule: ≥1 published linked TOPIC.
  //   single-type picker                 → ≥1 published linked page of its own targetType.
  //
  // Reads linkedIds, not linkedPages: linkedPages deliberately also carries ARCHIVED links so an
  // archived chip stays visible above, but an archived link must never SATISFY the gate.
  const byId = new Map((pages ?? []).map((p) => [p.id, p]))
  const gateMet = required && hasPublishedLinkOfType(linkedIds, byId, anyType ? 'topic' : targetType)
  const searchLabel = anyType ? 'דף' : targetType === 'topic' ? 'דף נושא' : 'דף אירוע'

  return (
    <section className={bare ? 'space-y-5' : 'bg-card rounded-xl shadow border border-border p-6 space-y-5'}>
      {!bare && (
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
          <p className="text-[12px] text-muted-foreground/70">
            טיוטות אינן מוצגות · הקישור נקרא חי — עד שיבוטל פרסומו לא יוצג בעמוד
          </p>
        </div>
      )}

      {/* Selected chips */}
      {linkedPages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkedPages.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-[#F0F8FF] text-[#458FFF] border border-[#21AEFF]/20"
            >
              {anyType && <TypeBadge type={p.type} />}
              {p.title}
              {p.status === 'archived' && <span className="text-muted-foreground/60"> (בארכיון)</span>}
              <button onClick={() => toggle(p.id)} className="hover:text-red-500 transition-colors">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Gate satisfaction line */}
      {required && (
        gateMet ? (
          <p className="text-[13px] text-green-600 font-medium">
            {anyType ? 'נבחר דף נושא מקושר ✓ — דרישת הפרסום מולאה' : 'נבחר פריט אחד ✓ — דרישת הפרסום מולאה'}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {anyType ? 'לא נבחר דף נושא מקושר עדיין — נדרש לפחות אחד לפרסום' : 'לא נבחר פריט עדיין — נדרש לפחות אחד לפרסום'}
          </p>
        )
      )}

      {/* Search + badge */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`חיפוש ${searchLabel}...`}
              className="text-right pe-9"
            />
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground whitespace-nowrap">
            מוצגים דפים שפורסמו בלבד
          </span>
        </div>

        {/* Checkbox list */}
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-2">
            {candidates.length === 0 ? `אין ${anyType ? 'דפים מפורסמים' : `${TYPE_LABEL[targetType!]} מפורסמים`}` : 'לא נמצאו תוצאות'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden">
            {filtered.map((p) => {
              const checked = linkedIds.includes(p.id)
              return (
                <li key={p.id}>
                  <button
                    onClick={() => toggle(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-muted/40 transition-colors"
                  >
                    <div className={[
                      'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'bg-[#21AEFF] border-[#21AEFF]' : 'border-border',
                    ].join(' ')}>
                      {checked && <Check className="size-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {anyType && <TypeBadge type={p.type} />}
                        <p className="text-sm text-foreground truncate">{p.title}</p>
                      </div>
                      {noteFor?.(p) && <p className="text-[11px] text-amber-600">{noteFor(p)}</p>}
                      {p.lastPublishedAt && (
                        <p className="text-[11px] text-muted-foreground">פורסם {formatRelativeTime(p.lastPublishedAt)}</p>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
