import { useState } from 'react'

// Shared windowed-paging shelf (the הכל tab's three type bands) and load-more grid (the individual
// type tabs) primitives. RTL arrow semantics per the design notes: ← (left-pointing) advances
// FORWARD into later items, → (right-pointing) goes back; DOM order is back-then-forward, matching
// LinkedPagesRibbon's existing arrow pair exactly — not re-derived here.

// Literal white, not bg-card — same reasoning as HomeCards' CARD_SHELL and HomeTabBodies' chips:
// var(--card) (#FAFCFE) is within ~1 RGB unit of the --lp-ribbon-bg page wash, which makes these
// buttons' 1px hairline border effectively invisible. The design's export uses #fff here too.
const ARROW_CLASS =
  'flex size-[26px] items-center justify-center rounded-md border bg-white text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const arrowStyle = { borderColor: 'var(--lp-hairline)', color: 'var(--lp-ink)' }

export function Shelf<T extends { id: string }>({
  label, count, totalLabel, items, windowSize, gridClassName, renderCard, onShowAll,
}: {
  label: string
  count: number
  totalLabel: string
  items: T[]
  windowSize: number
  gridClassName: string
  renderCard: (item: T) => React.ReactNode
  onShowAll: () => void
}) {
  const [windowStart, setWindowStart] = useState(0)
  const total = items.length
  if (total === 0) return null

  const canBack = windowStart > 0
  const canForward = windowStart + windowSize < total
  const visible = items.slice(windowStart, windowStart + windowSize)

  return (
    <section>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="font-heebo text-[15px] font-bold" style={{ color: 'var(--lp-ink)' }}>{label}</span>
        <span className="font-heebo text-[13px]" style={{ color: 'var(--lp-label)' }}>{count}</span>
        <div className="ms-auto flex items-center gap-3">
          {/* Same destination as the tab, not a second route — activates the tab, per the design notes. */}
          <button
            type="button"
            onClick={onShowAll}
            className="whitespace-nowrap font-heebo text-[13px] font-semibold hover:underline"
            style={{ color: 'var(--lp-accent)' }}
          >
            {totalLabel} ←
          </button>
          {total > windowSize && (
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-label="גלול אחורה"
                disabled={!canBack}
                onClick={() => setWindowStart((s) => Math.max(0, s - windowSize))}
                className={ARROW_CLASS}
                style={arrowStyle}
              >→</button>
              <button
                type="button"
                aria-label="גלול קדימה"
                disabled={!canForward}
                onClick={() => setWindowStart((s) => Math.min(total - windowSize, s + windowSize))}
                className={ARROW_CLASS}
                style={arrowStyle}
              >←</button>
            </div>
          )}
        </div>
      </div>
      <div className={gridClassName}>
        {visible.map((item) => <div key={item.id}>{renderCard(item)}</div>)}
      </div>
    </section>
  )
}

export function LoadMoreGrid<T extends { id: string }>({
  items, pageSize, gridClassName, renderCard,
}: {
  items: T[]
  pageSize: number
  gridClassName: string
  renderCard: (item: T) => React.ReactNode
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const visible = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  if (items.length === 0) {
    return <p className="py-16 text-center font-heebo text-sm" style={{ color: 'var(--lp-label)' }}>לא נמצאו דפים</p>
  }

  return (
    <>
      <div className={gridClassName}>
        {visible.map((item) => <div key={item.id}>{renderCard(item)}</div>)}
      </div>
      <div className="mt-6 flex items-center justify-center gap-3.5 font-heebo text-[13px]" style={{ color: 'var(--lp-label)' }}>
        {hasMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + pageSize)}
            className="font-semibold hover:underline"
            style={{ color: 'var(--lp-accent)' }}
          >
            טען עוד ←
          </button>
        )}
        <span>מציג {visible.length} מתוך {items.length}</span>
      </div>
    </>
  )
}
