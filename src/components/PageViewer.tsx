import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type {
  ContentPage, TopicPage, EventPage, ReferencePage, CaptionedImage, CommanderHighlight,
} from '@/types/contentPage'
import { TimelineViewer } from './TimelineViewer'
import { LinkedPagesRibbon } from './LinkedPagesRibbon'
import { DeepeningIndex } from './DeepeningIndex'
import { CommanderWordView } from './CommanderWord'
import { formatDate } from '@/utils/dateUtils'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import { X, ChevronLeft, Layers } from 'lucide-react'
import { ancestorChain } from '@/utils/pageHierarchy'
import { usePageHref } from './viewerLinks'

// ── Constants ────────────────────────────────────────────────────────────────

// Explicit same-kind pairs: both sections must be present and consecutive to share a row.
// deepening+gallery = flat item lists; map+dashboards = single-image sections.
const TOPIC_PAIRS = new Set(['deepening:gallery', 'map:dashboards'])
const EVENT_PAIRS = new Set(['deepening:gallery', 'map:dashboards'])

// ── Image modal ───────────────────────────────────────────────────────────────

function ImageModal({ image, onClose }: { image: CaptionedImage; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex flex-col items-center w-[92vw] max-w-6xl h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* flex-1 + a definite parent height gives the image a real box to fill, so object-contain
            scales the source UP to fit the viewport (not just down) — small images no longer render
            tiny inside a large modal, while large ones still fit without cropping. */}
        <img
          src={image.src}
          alt={image.name}
          className="w-full flex-1 min-h-0 object-contain rounded-lg shadow-2xl"
        />
        {image.caption && (
          <p className="text-white/80 text-base text-center mt-3 shrink-0 font-heebo">{image.caption}</p>
        )}
        <button
          onClick={onClose}
          aria-label="סגור"
          className="absolute -top-3 -left-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Captioned image section (gallery, map, dashboards) ────────────────────────
// Single implementation — click any image to open it enlarged in a modal.

function CaptionedImageSection({ images }: { images: CaptionedImage[] }) {
  const [selected, setSelected] = useState<CaptionedImage | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => setSelected(img)}
            className="text-right group focus:outline-none"
          >
            <div className="aspect-video rounded-lg overflow-hidden bg-muted border border-[#E6E6E6] group-hover:border-primary/40 transition-colors">
              <img
                src={img.src}
                alt={img.name}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
              />
            </div>
            {img.caption && (
              <p className="text-sm text-muted-foreground font-heebo text-center mt-1.5">
                {img.caption}
              </p>
            )}
          </button>
        ))}
      </div>
      {selected && <ImageModal image={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ── History modal ────────────────────────────────────────────────────────────

function HistoryModal({
  pageTitle,
  fullContent,
  onClose,
}: {
  pageTitle: string
  fullContent: string
  onClose: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir="rtl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[720px] max-w-[calc(100vw-2rem)] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-[#E6E6E6] shrink-0">
          <span className="text-xs font-semibold bg-[#F0FBFF] text-primary border border-primary/20 rounded-full px-3 py-1 font-heebo">
            סקירת המאסטרים
          </span>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground transition-colors p-1"
            aria-label="סגור"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-8 py-6 overflow-y-auto">
          <h2 className="text-2xl font-extrabold text-foreground font-heebo mb-5">{pageTitle}</h2>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-heebo">
            {fullContent}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  id,
  num,
  title,
  children,
}: {
  id: string
  num: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="bg-white rounded-xl border border-[#E6E6E6] scroll-mt-24">
      <div className="px-5 sm:px-8 pt-7 pb-5">
        <h2 className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-bold text-primary font-heebo leading-none">{num}</span>
          <span className="text-2xl font-extrabold text-foreground font-heebo leading-tight">{title}</span>
        </h2>
      </div>
      <div className="px-5 sm:px-8 pb-8">{children}</div>
    </section>
  )
}

// ── Nav strip ────────────────────────────────────────────────────────────────

function SectionNavStrip({
  sections,
}: {
  sections: { id: string; num: string; label: string }[]
}) {
  return (
    <nav
      className="bg-white border-y border-[#E6E6E6] overflow-x-auto sticky top-12 z-10"
      dir="rtl"
    >
      <div className="max-w-[1120px] mx-auto flex divide-x divide-x-reverse divide-[#E6E6E6]">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-1.5 px-5 py-3.5 text-sm whitespace-nowrap shrink-0
              hover:bg-[#F0FBFF] transition-colors text-foreground/60 hover:text-primary font-heebo"
          >
            <span className="text-primary font-bold text-[13px]">{s.num}</span>
            <span>{s.label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

// ── Commander highlights ──────────────────────────────────────────────────────

function CommanderHighlightsView({ highlights }: { highlights: CommanderHighlight[] }) {
  const filled = highlights.filter((h) => h.points.filter(Boolean).length > 0)
  if (filled.length === 0) return null

  return (
    <div
      className={`grid gap-6 ${
        filled.length >= 3
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : filled.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1'
      }`}
    >
      {filled.map((h, i) => (
        <div key={i}>
          <h3 className="text-sm font-bold text-foreground font-heebo border-b-2 border-primary pb-2 mb-3">
            {h.heading}
          </h3>
          <ul className="space-y-1.5">
            {h.points.filter(Boolean).map((p, j) => (
              <li key={j} className="flex gap-2 text-sm text-foreground font-heebo">
                <span className="text-primary shrink-0 mt-0.5 leading-none">•</span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Hierarchy breadcrumbs (ancestor topic chain, live) ───────────────────────
// Uses the SHARED ancestorChain helper (also used by the LinkedPagesRibbon anchor) so the two never
// disagree: for an event the chain starts from its DEEPEST linked topic (most specific placement).
// Ancestors that are published link through; draft ancestors show as plain text so the chain stays
// complete even though decision 2 lets a published child sit under a draft parent.

function Breadcrumbs({ page }: { page: ContentPage }) {
  const fetch = useCallback(() => getPages(), [])
  const { data: pages } = useAsync(fetch)
  // Audience-blind: asks how to link to a page, never who is looking. See viewerLinks.tsx.
  const pageHref = usePageHref()
  if (!pages) return null

  const byId = new Map(pages.map((p) => [p.id, p]))
  const chain = ancestorChain(page, byId)
  if (chain.length === 0) return null

  // A prominent full-width tinted bar above the hero — this is the primary "where am I in the
  // hierarchy" signal, so it is deliberately heavy (icon + eyebrow + bordered band) rather than a
  // thin muted line that scrolls past unnoticed.
  return (
    <nav dir="rtl" aria-label="מסלול היררכיה" className="border-b border-[#C8E8F5] bg-[#F0FBFF]">
      <div className="max-w-[1120px] mx-auto px-6 py-2.5 flex items-center gap-2 flex-wrap text-sm font-heebo">
        <Layers className="size-4 text-primary shrink-0" />
        <span className="text-[11px] font-bold text-primary uppercase tracking-wide">היררכיה</span>
        <span className="text-muted-foreground/40">·</span>
        {chain.map((t) => (
          <span key={t.id} className="flex items-center gap-2">
            {/* Two-branch on a THREE-value status is safe only because ancestorChain (pageHierarchy.ts)
                BREAKS its walk at an archived ancestor, so `chain` can never contain one — the else
                here is reachable by 'draft' alone, which is why it renders as plain unlinked text. If
                ancestorChain ever starts including archived nodes, this needs an explicit archived
                branch or it will silently present an archived topic with the draft treatment. */}
            {t.status === 'published' ? (
              <Link to={pageHref(t.id)} className="text-link font-medium hover:underline">{t.title}</Link>
            ) : (
              <span className="text-muted-foreground">{t.title}</span>
            )}
            <ChevronLeft className="size-4 text-muted-foreground/50 shrink-0" />
          </span>
        ))}
        <span className="text-foreground font-bold">{page.title}</span>
      </div>
    </nav>
  )
}

// ── Section grouping for 2-col pairs ─────────────────────────────────────────

type SectionEntry = { key: string; label: string; num: string; id: string }
type RenderItem =
  | { type: 'single'; section: SectionEntry }
  | { type: 'pair'; left: SectionEntry; right: SectionEntry }

function buildRenderGroups(sections: SectionEntry[], pairKeys: Set<string>): RenderItem[] {
  const items: RenderItem[] = []
  let i = 0
  while (i < sections.length) {
    const cur = sections[i]
    const next = sections[i + 1]
    if (next && pairKeys.has(`${cur.key}:${next.key}`)) {
      items.push({ type: 'pair', left: cur, right: next })
      i += 2
    } else {
      items.push({ type: 'single', section: cur })
      i++
    }
  }
  return items
}

// ── Topic page ───────────────────────────────────────────────────────────────

function TopicPageView({ page }: { page: TopicPage }) {
  const [historyOpen, setHistoryOpen] = useState(false)

  const c = page.content ?? {}
  const hero = (c.hero ?? {}) as NonNullable<typeof c.hero>
  const overview = c.overview
  const deepening = (c.deepening ?? []).filter(Boolean)
  const gallery = (c.gallery ?? []).filter((img) => img && img.src)
  const historySection = c.historySection
  const map = (c.map ?? []).filter((img) => img && img.src)
  const dashboards = (c.dashboards ?? []).filter((img) => img && img.src)
  const arena = overview?.arenaCharacteristics
  const hasArena = !!(
    arena?.ourForces ||
    arena?.enemy ||
    (arena?.additional?.filter(Boolean).length ?? 0) > 0
  )
  const hasOverview = !!(overview?.summary || overview?.background || hasArena)
  const hasHistory = !!(historySection?.teaser && historySection?.fullContent)
  const hasTimeline = (c.timeline?.enemyEvents.length ?? 0) > 0 || (c.timeline?.friendlyEvents.length ?? 0) > 0

  // Section order: linked pages before deepening/gallery so readers see related pages first.
  const defs = [
    { key: 'hero',      label: 'כותרת ומטא-דאטה',         present: true },
    { key: 'overview',  label: 'סקירה כללית',               present: hasOverview },
    { key: 'commanderWord', label: 'דבר המלך',            present: !!c.commanderWord?.trim() },
    // 'links' is no longer a numbered section — it's the LinkedPagesRibbon welded under the hero.
    { key: 'deepening', label: 'העמקה',                     present: deepening.length > 0 },
    { key: 'gallery',   label: 'גלריה',                     present: gallery.length > 0 },
    { key: 'history',   label: 'סקירת המאסטרים',     present: hasHistory },
    { key: 'timeline',  label: 'ציר זמן',                   present: hasTimeline },
    { key: 'map',       label: 'מפה',                       present: map.length > 0 },
    { key: 'dashboards',label: 'דשבורדים',                  present: dashboards.length > 0 },
  ]

  // The hero is the always-present banner at the very top — it is NOT a numbered, navigable section
  // (there's nothing to jump to directly below the nav bar), so it is excluded from the counter and
  // from the nav strip. Numbering therefore starts at the first real section (overview = "01"), and
  // the same `num`/`id` drive both the nav strip and the body SectionCards so they stay in lockstep.
  let counter = 0
  const present: SectionEntry[] = defs
    .filter((d) => d.present)
    .map((d) => {
      if (d.key === 'hero') return { key: d.key, label: d.label, num: '', id: 'section-hero' }
      counter++
      return { key: d.key, label: d.label, num: String(counter).padStart(2, '0'), id: `section-${counter}` }
    })

  const heroEntry = present[0]
  const bodyGroups = buildRenderGroups(present.slice(1), TOPIC_PAIRS)

  // Banner image comes from the explicit hero.heroImage field (no longer derived from gallery[0]).
  const coverSrc = hero.heroImage?.src

  function renderBody(entry: SectionEntry): React.ReactNode {
    switch (entry.key) {
      case 'commanderWord':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CommanderWordView text={c.commanderWord} />
          </SectionCard>
        )
      case 'overview':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <div className="space-y-5">
              {overview?.summary && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-heebo">תקציר כללי</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-heebo">{overview.summary}</p>
                </div>
              )}
              {overview?.background && (
                <div className={overview.summary ? 'pt-4 border-t border-[#E6E6E6]' : ''}>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-heebo">רקע</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-heebo">{overview.background}</p>
                </div>
              )}
              {hasArena && arena && (
                <div className={overview?.summary || overview?.background ? 'pt-4 border-t border-[#E6E6E6]' : ''}>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 font-heebo">מאפייני הזירה</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {arena.ourForces && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-widest mb-1.5 font-heebo">צד א׳</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap font-heebo">{arena.ourForces}</p>
                      </div>
                    )}
                    {arena.enemy && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-[11px] font-bold text-red-700 uppercase tracking-widest mb-1.5 font-heebo">צד ב׳</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap font-heebo">{arena.enemy}</p>
                      </div>
                    )}
                    {arena.additional?.filter(Boolean).map((item, i) => (
                      <div key={i} className="bg-white border border-[#E6E6E6] rounded-lg p-4">
                        <p className="text-sm text-foreground whitespace-pre-wrap font-heebo">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )

      case 'deepening':
        return <DeepeningIndex id={entry.id} num={entry.num} items={deepening} />

      case 'gallery':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={gallery} />
          </SectionCard>
        )

      case 'history':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <div className="bg-[#F0FBFF] rounded-lg border border-[#C8E8F5] p-5 space-y-3">
              <p className="text-sm font-bold text-foreground font-heebo">{page.title}</p>
              <p className="text-sm text-foreground/70 leading-relaxed font-heebo whitespace-pre-wrap">
                {historySection!.teaser}
              </p>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors rounded-lg px-4 py-2 font-heebo"
              >
                עבור לסקירה המלאה
              </button>
            </div>
          </SectionCard>
        )

      case 'timeline':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <TimelineViewer data={c.timeline!} scale="months" pageType="דף נושא" />
          </SectionCard>
        )

      case 'map':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={map} />
          </SectionCard>
        )

      case 'dashboards':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={dashboards} />
          </SectionCard>
        )

      default:
        return null
    }
  }

  return (
    <div dir="rtl">
      <Breadcrumbs page={page} />
      {/* Hero — section 01: full-bleed banner with the image on the LEFT and metadata on the RIGHT
          when a heroImage is set; otherwise a text-only header (metadata spans full width, no image,
          no placeholder). flex-row-reverse: the page is dir="rtl", so the image (first child) would
          otherwise land on the right — reversing the row puts it on the left as the design requires. */}
      <div id={heroEntry.id} className="flex flex-col md:flex-row-reverse md:min-h-[var(--hero-min)] scroll-mt-12" style={coverSrc ? ({ '--hero-min': '360px' } as React.CSSProperties) : undefined}>
        {coverSrc && (
          // Phone: full width at the illustration's own 16/9 ratio with object-contain, so the
          // caption drawn inside the SVG is never cropped. md+: the original cropped column.
          <div className="relative w-full aspect-[16/9] md:aspect-auto md:w-2/5 shrink-0 overflow-hidden bg-[#F0FBFF]">
            {/* absolute inset-0: the image fills the banner height (set by minHeight + metadata) and
                is cropped by object-cover — it must never drive the height itself, or a tall source
                image would balloon the whole header. */}
            <img src={coverSrc} alt={page.title} className="absolute inset-0 w-full h-full object-contain md:object-cover" />
          </div>
        )}

        {/* Metadata panel — right side of the banner, or full width when there is no image */}
        <div className="flex-1 bg-[#F0FBFF] flex flex-col justify-center px-5 sm:px-10 lg:px-14 py-8 md:py-10 min-w-0 space-y-4">
          <span className="text-[15px] font-semibold text-primary font-heebo">דף נושא</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight tracking-tight font-heebo">
            {page.title}
          </h1>
          {hero.subtitle && (
            <p className="text-lg font-light text-foreground/70 leading-relaxed font-heebo max-w-prose">
              {hero.subtitle}
            </p>
          )}
          {(hero.periodFrom || hero.periodTo || hero.region) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-[#C8E8F5] rounded-lg overflow-hidden w-full sm:w-fit mt-2">
              {(hero.periodFrom || hero.periodTo) && (
                <div className="px-4 py-3 border-b sm:border-b-0 sm:border-l border-[#C8E8F5]">
                  <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">תקופת האירועים</p>
                  <p className="text-sm font-semibold text-foreground font-heebo whitespace-normal sm:whitespace-nowrap" dir="ltr">
                    {hero.periodFrom && formatDate(hero.periodFrom)}
                    {hero.periodFrom && hero.periodTo && ' – '}
                    {hero.periodTo && formatDate(hero.periodTo)}
                  </p>
                </div>
              )}
              {hero.region && (
                <div className="px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">אזור</p>
                  <p className="text-sm font-semibold text-foreground font-heebo">{hero.region}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* קישור דפים ribbon — navigation chrome welded under the hero, above the numbered sections.
          Renders nothing when the page has neither a parent nor any linked page. */}
      <LinkedPagesRibbon page={page} />

      {/* Nav strip */}
      {/* Hero (present[0]) is excluded — it's the banner directly above, nothing to navigate to. */}
      <SectionNavStrip sections={present.slice(1)} />

      {/* Section body */}
      <div className="max-w-[1120px] mx-auto px-6 py-8 space-y-7">
        {bodyGroups.map((group, i) =>
          group.type === 'pair' ? (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {renderBody(group.left)}
              {renderBody(group.right)}
            </div>
          ) : (
            <div key={i}>{renderBody(group.section)}</div>
          )
        )}
      </div>

      {historyOpen && historySection && (
        <HistoryModal
          pageTitle={page.title}
          fullContent={historySection.fullContent}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}

// ── Event page ───────────────────────────────────────────────────────────────

function EventPageView({ page }: { page: EventPage }) {
  const [historyOpen, setHistoryOpen] = useState(false)

  const c = page.content ?? {}
  const hero = (c.hero ?? {}) as NonNullable<typeof c.hero>
  const grid = c.infoGrid
  const deepening = (c.deepening ?? []).filter(Boolean)
  const gallery = (c.gallery ?? []).filter((img) => img && img.src)
  const historySection = c.historySection
  const highlights = (c.commanderHighlights ?? []).filter(
    (h) => h.points.filter(Boolean).length > 0
  )
  const map = (c.map ?? []).filter((img) => img && img.src)
  const dashboards = (c.dashboards ?? []).filter((img) => img && img.src)

  const eventTypeLabel =
    grid?.eventType === 'אחר' && grid.eventTypeDetail
      ? `אחר — ${grid.eventTypeDetail}`
      : (grid?.eventType ?? '')

  const hasHistory = !!(historySection?.teaser && historySection?.fullContent)
  const hasTimeline = (c.timeline?.enemyEvents.length ?? 0) > 0 || (c.timeline?.friendlyEvents.length ?? 0) > 0

  // Section order: linked pages before deepening/gallery so readers see related pages first.
  const defs = [
    { key: 'hero',       label: 'כותרת ומטא-דאטה',        present: true },
    { key: 'infoGrid',   label: 'פרטי האירוע',              present: true },
    { key: 'commanderWord', label: 'דבר המלך',           present: !!c.commanderWord?.trim() },
    // 'קישור דפים' is now the LinkedPagesRibbon under the hero, not a numbered section.
    { key: 'deepening',  label: 'העמקה',                    present: deepening.length > 0 },
    { key: 'gallery',    label: 'גלריה',                    present: gallery.length > 0 },
    { key: 'history',    label: 'סקירת המאסטרים',    present: hasHistory },
    { key: 'timeline',   label: 'ציר זמן',                  present: hasTimeline },
    { key: 'highlights', label: 'נקודות',             present: highlights.length > 0 },
    { key: 'map',        label: 'מפה',                      present: map.length > 0 },
    { key: 'dashboards', label: 'דשבורדים',                 present: dashboards.length > 0 },
  ]

  // Hero is the always-present top banner, not a numbered/navigable section — excluded from the
  // counter and the nav strip, so numbering starts at the first real section (overview = "01"). The
  // same num/id feed both the nav strip and the body SectionCards, keeping them in lockstep.
  let counter = 0
  const present: SectionEntry[] = defs
    .filter((d) => d.present)
    .map((d) => {
      if (d.key === 'hero') return { key: d.key, label: d.label, num: '', id: 'section-hero' }
      counter++
      return { key: d.key, label: d.label, num: String(counter).padStart(2, '0'), id: `section-${counter}` }
    })

  const heroEntry = present[0]
  const bodyGroups = buildRenderGroups(present.slice(1), EVENT_PAIRS)

  // Banner image comes from the explicit hero.heroImage field (no longer derived from gallery[0]).
  const coverSrc = hero.heroImage?.src

  function renderBody(entry: SectionEntry): React.ReactNode {
    switch (entry.key) {
      case 'commanderWord':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CommanderWordView text={c.commanderWord} />
          </SectionCard>
        )
      case 'infoGrid':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <div className="space-y-5">
              {grid?.commanderSummary && (
                <div className="pb-5 border-b border-[#E6E6E6]">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 font-heebo">תקציר</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-heebo">{grid.commanderSummary}</p>
                </div>
              )}
              {grid && (eventTypeLabel || grid.sector || grid.timeFrom || grid.timeTo) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-[#E6E6E6] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b sm:border-b-0 sm:border-l border-[#E6E6E6]">
                    <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">סוג אירוע</p>
                    <p className="text-sm font-semibold text-foreground font-heebo">{eventTypeLabel || '—'}</p>
                  </div>
                  <div className="px-4 py-3 border-b sm:border-b-0 sm:border-l border-[#E6E6E6]">
                    <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">מיקום</p>
                    <p className="text-sm font-semibold text-foreground font-heebo">{grid.sector || '—'}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">שעות זמן</p>
                    <p className="text-sm font-semibold text-foreground font-heebo whitespace-nowrap" dir="ltr">
                      {grid.timeFrom || '—'} – {grid.timeTo || '—'}
                    </p>
                  </div>
                </div>
              )}
              {grid && (grid.forces || grid.enemy) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grid.forces && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-heebo">צד א׳</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap font-heebo">{grid.forces}</p>
                    </div>
                  )}
                  {grid.enemy && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 font-heebo">צד ב׳</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap font-heebo">{grid.enemy}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        )

      case 'deepening':
        return <DeepeningIndex id={entry.id} num={entry.num} items={deepening} />

      case 'gallery':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={gallery} />
          </SectionCard>
        )

      case 'history':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <div className="bg-[#F0FBFF] rounded-lg border border-[#C8E8F5] p-5 space-y-3">
              <p className="text-sm font-bold text-foreground font-heebo">{page.title}</p>
              <p className="text-sm text-foreground/70 leading-relaxed font-heebo whitespace-pre-wrap">
                {historySection!.teaser}
              </p>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors rounded-lg px-4 py-2 font-heebo"
              >
                עבור לסקירה המלאה
              </button>
            </div>
          </SectionCard>
        )

      case 'timeline':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <TimelineViewer data={c.timeline!} scale="hours" pageType="דף אירוע" />
          </SectionCard>
        )

      case 'highlights':
        return (
          <SectionCard id={entry.id} num={entry.num} title="נקודות – למידה ולקחים">
            <CommanderHighlightsView highlights={highlights} />
          </SectionCard>
        )

      case 'map':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={map} />
          </SectionCard>
        )

      case 'dashboards':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CaptionedImageSection images={dashboards} />
          </SectionCard>
        )

      default:
        return null
    }
  }

  return (
    <div dir="rtl">
      <Breadcrumbs page={page} />
      {/* Hero — section 01: full-bleed banner with the image on the LEFT and metadata on the RIGHT
          when a heroImage is set; otherwise a text-only header (metadata spans full width, no image,
          no placeholder). flex-row-reverse: the page is dir="rtl", so the image (first child) would
          otherwise land on the right — reversing the row puts it on the left as the design requires. */}
      <div id={heroEntry.id} className="flex flex-col md:flex-row-reverse md:min-h-[var(--hero-min)] scroll-mt-12" style={coverSrc ? ({ '--hero-min': '320px' } as React.CSSProperties) : undefined}>
        {coverSrc && (
          // Phone: full width at the illustration's own 16/9 ratio with object-contain, so the
          // caption drawn inside the SVG is never cropped. md+: the original cropped column.
          <div className="relative w-full aspect-[16/9] md:aspect-auto md:w-2/5 shrink-0 overflow-hidden bg-[#F0FBFF]">
            {/* absolute inset-0: the image fills the banner height (set by minHeight + metadata) and
                is cropped by object-cover — it must never drive the height itself, or a tall source
                image would balloon the whole header. */}
            <img src={coverSrc} alt={page.title} className="absolute inset-0 w-full h-full object-contain md:object-cover" />
          </div>
        )}

        {/* Metadata panel — right side of the banner, or full width when there is no image */}
        <div className="flex-1 bg-[#F0FBFF] flex flex-col justify-center px-5 sm:px-10 lg:px-14 py-8 md:py-10 min-w-0 space-y-4">
          <span className="text-[15px] font-semibold text-primary font-heebo">דף אירוע</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight tracking-tight font-heebo">
            {page.title}
          </h1>
          {hero.subtitle && (
            <p className="text-lg font-light text-foreground/70 leading-relaxed font-heebo max-w-prose">
              {hero.subtitle}
            </p>
          )}
          {(hero.date || hero.region) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-[#C8E8F5] rounded-lg overflow-hidden w-full sm:w-fit mt-2">
              {hero.date && (
                <div className="px-4 py-3 border-l border-[#C8E8F5]">
                  <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">תאריך</p>
                  <p className="text-sm font-semibold text-foreground font-heebo whitespace-nowrap" dir="ltr">
                    {formatDate(hero.date)}
                  </p>
                </div>
              )}
              {hero.region && (
                <div className="px-4 py-3">
                  <p className="text-[11px] text-muted-foreground font-heebo mb-0.5">אזור</p>
                  <p className="text-sm font-semibold text-foreground font-heebo">{hero.region}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* קישור דפים ribbon — navigation chrome welded under the hero, above the numbered sections.
          Renders nothing when the page has neither a parent nor any linked page. */}
      <LinkedPagesRibbon page={page} />

      {/* Nav strip */}
      {/* Hero (present[0]) is excluded — it's the banner directly above, nothing to navigate to. */}
      <SectionNavStrip sections={present.slice(1)} />

      {/* Section body */}
      <div className="max-w-[1120px] mx-auto px-6 py-8 space-y-7">
        {bodyGroups.map((group, i) =>
          group.type === 'pair' ? (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {renderBody(group.left)}
              {renderBody(group.right)}
            </div>
          ) : (
            <div key={i}>{renderBody(group.section)}</div>
          )
        )}
      </div>

      {historyOpen && historySection && (
        <HistoryModal
          pageTitle={page.title}
          fullContent={historySection.fullContent}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}

// ── Public export ────────────────────────────────────────────────────────────

// דף עיון — text-only header (no image/period/region), dossier deepening as primary content, plus
// optional synthesis and commanderWord. Shares the ribbon (linkedPageIds), nav strip, and dossier.
function ReferencePageView({ page }: { page: ReferencePage }) {
  const c = page.content ?? { deepening: [] }
  const deepening = (c.deepening ?? []).filter(Boolean)
  const coverSrc = c.hero?.heroImage?.src

  // Numbering order: רקע (01), then דבר המלך (02, RIGHT) + העמקה (03, LEFT) side by side — numbers
  // ascend right-to-left, matching RTL reading. In RTL the first grid child renders on the right.
  const defs = [
    { key: 'hero',          label: 'כותרת',      present: true },
    { key: 'synthesis',     label: 'רקע',        present: !!c.overview?.synthesis?.trim() },
    { key: 'commanderWord', label: 'דבר המלך',  present: !!c.commanderWord?.trim() },
    { key: 'deepening',     label: 'העמקה',      present: deepening.length > 0 },
  ]
  let counter = 0
  const present: SectionEntry[] = defs
    .filter((d) => d.present)
    .map((d) => {
      if (d.key === 'hero') return { key: d.key, label: d.label, num: '', id: 'section-hero' }
      counter++
      return { key: d.key, label: d.label, num: String(counter).padStart(2, '0'), id: `section-${counter}` }
    })
  const bySynthesis = present.find((e) => e.key === 'synthesis')
  const byDeepening = present.find((e) => e.key === 'deepening')
  const byCommander = present.find((e) => e.key === 'commanderWord')

  function renderBody(entry: SectionEntry): React.ReactNode {
    switch (entry.key) {
      case 'deepening':
        return <DeepeningIndex id={entry.id} num={entry.num} items={deepening} />
      case 'synthesis':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-heebo">{c.overview?.synthesis}</p>
          </SectionCard>
        )
      case 'commanderWord':
        return (
          <SectionCard id={entry.id} num={entry.num} title={entry.label}>
            <CommanderWordView text={c.commanderWord} />
          </SectionCard>
        )
      default:
        return null
    }
  }

  return (
    <div dir="rtl">
      <Breadcrumbs page={page} />
      {/* Full-bleed banner — image on the LEFT, metadata on the RIGHT when a heroImage is set;
          otherwise a text-only header (same treatment as Topic & Event pages). */}
      <div id="section-hero" className="flex flex-col md:flex-row-reverse md:min-h-[var(--hero-min)] scroll-mt-12" style={coverSrc ? ({ '--hero-min': '320px' } as React.CSSProperties) : undefined}>
        {coverSrc && (
          // Phone: full width at the illustration's own 16/9 ratio with object-contain, so the
          // caption drawn inside the SVG is never cropped. md+: the original cropped column.
          <div className="relative w-full aspect-[16/9] md:aspect-auto md:w-2/5 shrink-0 overflow-hidden bg-[#F0FBFF]">
            <img src={coverSrc} alt={page.title} className="absolute inset-0 w-full h-full object-contain md:object-cover" />
          </div>
        )}
        <div className="flex-1 bg-[#F0FBFF] flex flex-col justify-center px-5 sm:px-10 lg:px-14 py-8 md:py-10 min-w-0 space-y-4">
          <span className="text-[15px] font-semibold text-primary font-heebo">דף עיון</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-tight tracking-tight font-heebo">
            {page.title}
          </h1>
          {c.hero?.subtitle && (
            <p className="text-lg font-light text-foreground/70 leading-relaxed font-heebo max-w-prose">
              {c.hero.subtitle}
            </p>
          )}
        </div>
      </div>

      <LinkedPagesRibbon page={page} />
      <SectionNavStrip sections={present.slice(1)} />

      <div className="max-w-[1120px] mx-auto px-6 py-8 space-y-7">
        {bySynthesis && <div>{renderBody(bySynthesis)}</div>}
        {byDeepening && byCommander ? (
          // Side by side — first grid child renders on the RIGHT in RTL, so דבר המלך sits on the right.
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {renderBody(byCommander)}
            {renderBody(byDeepening)}
          </div>
        ) : (byDeepening || byCommander) ? (
          <div>{renderBody(byDeepening ?? byCommander!)}</div>
        ) : null}
      </div>
    </div>
  )
}

export function PageViewer({ page }: { page: ContentPage }) {
  if (page.type === 'topic') return <TopicPageView page={page} />
  if (page.type === 'event') return <EventPageView page={page} />
  return <ReferencePageView page={page} />
}
