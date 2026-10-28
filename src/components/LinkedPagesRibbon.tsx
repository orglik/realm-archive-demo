import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import { formatDate } from '@/utils/dateUtils'
import { ancestorChain } from '@/utils/pageHierarchy'
import { usePageHref } from './viewerLinks'
import type { ContentPage } from '@/types/contentPage'

// ── קישור דפים ribbon (design anchors 2a / 3a / 3b) ────────────────────────────
// Navigation chrome welded under the hero, above the numbered sections — NOT a numbered card.
//   • right (fixed): hierarchy anchor — what is ABOVE this page (0–2 ancestors)
//   • left (flexible): horizontally-scrollable rail of the OTHER linked pages
//   • far left: scroll arrows (forward = leftward, per RTL)
// Renders nothing when there is neither a parent nor any linked page. Never shows an empty message.

function heroSrc(p: ContentPage): string | undefined {
  return p.content?.hero?.heroImage?.src || undefined
}
function firstLetter(title: string): string {
  return title.trim().charAt(0) || '•'
}
function chipMeta(p: ContentPage, byId: Map<string, ContentPage>): string {
  if (p.type === 'event') {
    const d = p.content?.hero?.date
    return d ? `אירוע · ${formatDate(d)}` : 'אירוע'
  }
  if (p.type === 'reference') return 'עיון'
  // topic: count its linked EVENTS (linkedPageIds is type-agnostic → resolve each type).
  const n = (p.linkedPageIds ?? []).filter((id) => byId.get(id)?.type === 'event').length
  return n > 0 ? `נושא · ${n} אירועים` : 'נושא'
}

// Empty image → dark plate with the title's first Hebrew letter (never a generic grey box).
function Thumb({ page, w, h, radius }: { page: ContentPage; w: number; h: number; radius: number }) {
  const src = heroSrc(page)
  if (src) {
    return <img src={src} alt="" className="shrink-0 object-cover" style={{ width: w, height: h, borderRadius: radius }} />
  }
  return (
    <div
      className="shrink-0 flex items-center justify-center font-bold"
      style={{ width: w, height: h, borderRadius: radius, background: 'var(--lp-plate)', color: 'rgba(255,255,255,.85)', fontSize: Math.round(h * 0.4) }}
    >
      {firstLetter(page.title)}
    </div>
  )
}

// A stacked group label: word / word / count, centre-aligned — shown only when the rail carries both
// linked events and linked topics.
function GroupLabel({ word1, word2, count, padStart }: { word1: string; word2: string; count: number; padStart?: boolean }) {
  return (
    <div
      /* Below md the label sits ABOVE the rail on ONE line (word word · count); from md it
         returns to the original stacked word/word/count column beside the rail. The three
         spans were wrapping letter by letter once the rail squeezed the column. */
      className="flex-none flex flex-row md:flex-col items-center gap-1 md:gap-px text-center font-semibold leading-[1.2] whitespace-nowrap"
      style={{ fontSize: 10.5, letterSpacing: '.06em', color: 'var(--lp-label)', paddingInlineStart: padStart ? 6 : 2, paddingInlineEnd: 2 }}
    >
      <span>{word1}</span>
      <span>{word2}</span>
      <span className="md:hidden" style={{ color: 'var(--lp-faint)' }}>·</span>
      <span style={{ color: 'var(--lp-faint)' }}>{count}</span>
    </div>
  )
}

// One rail chip. Whole surface is the link; hover lifts the border/bg.
function Chip({ page, byId }: { page: ContentPage; byId: Map<string, ContentPage> }) {
  const pageHref = usePageHref()
  return (
    <Link
      to={pageHref(page.id)}
      /* snap-start plus one fixed phone width gives every card the same size and a predictable
         resting position, so a half-visible next card reads as "there is more to the side". */
      className="flex-none snap-start w-[232px] md:w-auto flex items-center gap-2.5 rounded-lg bg-white border border-[var(--lp-hairline)]
        hover:border-[var(--lp-blue-hover)] hover:bg-[var(--lp-chip-hover)] transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      style={{ padding: '6px 12px 6px 6px' }}
    >
      <Thumb page={page} w={44} h={32} radius={4} />
      <div className="flex flex-col gap-px min-w-0">
        <div className="text-[13.5px] font-semibold whitespace-nowrap truncate md:text-clip font-heebo" style={{ color: 'var(--lp-ink)' }}>{page.title}</div>
        <div className="text-[11px] whitespace-nowrap truncate md:text-clip font-heebo" style={{ color: 'var(--lp-label)' }}>{chipMeta(page, byId)}</div>
      </div>
    </Link>
  )
}

// One anchor title — links when published, plain text when a draft ancestor (chain stays complete).
// `marker` (↑ / ↑↑) renders INSIDE the link so the whole "up N levels" row is a single hit area.
//
// The two-branch test on a THREE-value status is safe only by construction: every caller passes a
// parent/grandparent taken from ancestorChain (pageHierarchy.ts), which BREAKS its walk at an archived
// ancestor, so an archived page can never reach here and the else is reachable by 'draft' alone. (The
// rail groups below are separately protected by resolve()'s own published-only filter, but they do not
// render through this component.) If ancestorChain ever stops excluding archived, add an explicit
// archived branch here — otherwise an archived ancestor would silently get the draft treatment.
function AnchorTitle({ page, className, style, marker, markerStyle }: {
  page: ContentPage; className: string; style?: React.CSSProperties; marker?: string; markerStyle?: React.CSSProperties
}) {
  const pageHref = usePageHref()
  const inner = <>{marker && <span style={markerStyle}>{marker}</span>}<span>{page.title}</span></>
  return page.status === 'published' ? (
    <Link to={pageHref(page.id)} className={className} style={style}>{inner}</Link>
  ) : (
    <span className={className} style={style}>{inner}</span>
  )
}

export function LinkedPagesRibbon({ page }: { page: ContentPage }) {
  const fetch = useCallback(() => getPages(), [])
  const { data: pages } = useAsync(fetch)
  const railRef = useRef<HTMLDivElement>(null)
  // Arrows appear ONLY when the rail actually overflows its visible width. Measured from the live DOM
  // (scrollWidth vs clientWidth) rather than assumed — a one- or few-item rail that fits shows none.
  const [overflowing, setOverflowing] = useState(false)

  // All of the below is null-safe so the hooks above/below stay unconditional (Rules of Hooks).
  const byId = new Map((pages ?? []).map((p) => [p.id, p]))

  // Anchor: nearest two ancestors (deeper ancestry stays in the top breadcrumb).
  const chain = pages ? ancestorChain(page, byId) : []
  const parent = chain[chain.length - 1]
  const grandparent = chain.length >= 2 ? chain[chain.length - 2] : undefined

  // Rail groups (exclude self + anything already in the anchor; published only; de-duplicated). Four
  // distinct groups, each with its own stacked label + count + divider:
  //   1. hierarchy CHILDREN (topic childTopicIds)      — parent/child, a different relationship
  //   2. LATERAL topics (linkedPageIds → topic)        — related topics, NOT hierarchy
  //   3. linked EVENTS (linkedPageIds → event)
  //   4. related REFERENCE pages (linkedPageIds → reference)
  // Children are resolved first (shared `seen`), so a topic that is both a child and a lateral link
  // appears once, in the hierarchy group.
  const excluded = new Set<string>([page.id, ...chain.map((t) => t.id)])
  const seen = new Set<string>()
  const resolve = (ids: string[]) => ids
    .filter((id) => !excluded.has(id) && !seen.has(id) && (seen.add(id), true))
    .map((id) => byId.get(id))
    .filter((p): p is ContentPage => !!p && p.status === 'published')

  const hierarchyChildren = resolve(page.type === 'topic' ? (page.childTopicIds ?? []) : [])
  const lateral = resolve(page.linkedPageIds ?? [])

  const groups = [
    { key: 'children',      word1: 'נושאים',   word2: 'כפופים',  pages: hierarchyChildren },
    { key: 'lateralTopics', word1: 'דפי נושא', word2: 'רוחביים', pages: lateral.filter((p) => p.type === 'topic') },
    { key: 'events',        word1: 'אירועים',  word2: 'מקושרים', pages: lateral.filter((p) => p.type === 'event') },
    { key: 'references',    word1: 'דפי עיון', word2: 'קשורים',  pages: lateral.filter((p) => p.type === 'reference') },
  ].filter((g) => g.pages.length > 0)

  const railPages = groups.flatMap((g) => g.pages)
  const multiGroup = groups.length > 1
  const railKey = railPages.map((p) => p.id).join(',')

  // Measure overflow after layout, and re-measure on any width change of the rail (viewport resize,
  // or the arrows themselves appearing/disappearing). Converges: hiding the arrows widens the rail, so
  // if content then fits, arrows stay hidden; if it still overflows, they stay shown. 1px tolerance
  // guards against subpixel rounding.
  useEffect(() => {
    const el = railRef.current
    if (!el) { setOverflowing(false); return }
    const measure = () => setOverflowing(el.scrollWidth - el.clientWidth > 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [railKey])

  if (!pages) return null
  // Neither parent nor links → no ribbon at all.
  if (!parent && railPages.length === 0) return null

  // Forward = leftward: scrollLeft goes negative in RTL. Back = +, forward = −.
  const scroll = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })

  const arrowClass =
    'w-[26px] h-[26px] rounded-md border border-[var(--lp-control)] bg-white text-[var(--lp-ink-muted)] ' +
    'hover:border-[var(--lp-blue-hover)] hover:text-[var(--lp-blue-label)] transition-colors ' +
    'flex items-center justify-center text-[13px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'

  return (
    <div dir="rtl" style={{ background: 'var(--lp-ribbon-bg)', borderBottom: '1px solid var(--lp-hairline)' }}>
      <div className="max-w-[1120px] mx-auto flex flex-col sm:flex-row sm:items-stretch">

        {/* Anchor zone (right, fixed) — omitted entirely for a root/no-parent page */}
        {parent && (
          <div
            className="flex-none flex items-center gap-[11px] min-w-0"
            style={{ padding: grandparent ? '10px 20px' : '12px 20px', borderInlineStart: '1px solid var(--lp-hairline)', background: 'var(--lp-anchor-bg)' }}
          >
            <Thumb page={parent} w={46} h={34} radius={5} />
            {grandparent ? (
              <div className="flex flex-col gap-[3px]">
                <AnchorTitle
                  page={grandparent}
                  marker="↑↑"
                  markerStyle={{ fontSize: 10 }}
                  className="flex items-center gap-1.5 text-[11.5px] font-heebo hover:text-[var(--lp-blue-label)] transition-colors"
                  style={{ color: 'var(--lp-meta)' }}
                />
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold" style={{ fontSize: 10.5, letterSpacing: '.1em', color: 'var(--lp-blue-label)' }}>↑</span>
                  <AnchorTitle
                    page={parent}
                    className="text-[14px] font-semibold font-heebo hover:text-[var(--lp-blue-label)] transition-colors"
                    style={{ color: 'var(--lp-ink)' }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <div className="font-semibold" style={{ fontSize: 10.5, letterSpacing: '.1em', color: 'var(--lp-blue-label)' }}>↑ דף אב</div>
                <AnchorTitle
                  page={parent}
                  className="text-[14px] font-semibold font-heebo hover:text-[var(--lp-blue-label)] transition-colors"
                  style={{ color: 'var(--lp-ink)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Rail zone (left, flexible) — removed entirely when there are no linked pages */}
        {railPages.length > 0 && (
          <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-2.5 overflow-hidden" style={{ padding: '12px 16px' }}>
            {/* First group's label is pinned outside the scroll; later groups' labels + dividers ride
                inside the rail. Labels only appear when there is more than one type present. */}
            {multiGroup && <GroupLabel word1={groups[0].word1} word2={groups[0].word2} count={groups[0].pages.length} padStart />}
            {/* min-w-0 lets flex shrink the rail below its content so the content overflows INSIDE it
                (making it scrollable) instead of the rail expanding and being clipped by the parent. */}
            <div
              ref={railRef}
              className="flex-1 min-w-0 w-full flex gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {multiGroup ? (
                groups.map((g, gi) => (
                  <Fragment key={g.key}>
                    {gi > 0 && <div className="flex-none w-px my-0.5 mx-1" style={{ background: 'var(--lp-hairline)' }} />}
                    {gi > 0 && <div className="flex items-center"><GroupLabel word1={g.word1} word2={g.word2} count={g.pages.length} /></div>}
                    {g.pages.map((p) => <Chip key={p.id} page={p} byId={byId} />)}
                  </Fragment>
                ))
              ) : (
                railPages.map((p) => <Chip key={p.id} page={p} byId={byId} />)
              )}
            </div>
            {/* Arrows only when the rail overflows. DOM order: back first, then forward (RTL). */}
            {overflowing && (
              <div className="flex-none flex gap-[5px]">
                <button type="button" onClick={() => scroll(1)} aria-label="גלול אחורה" className={arrowClass}>→</button>
                <button type="button" onClick={() => scroll(-1)} aria-label="גלול קדימה" className={arrowClass}>←</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
