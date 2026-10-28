import { useState } from 'react'
import type { ContentPage, TopicPage, EventPage, ReferencePage } from '@/types/contentPage'
import { TopicCard, EventCard, ReferenceCard } from './HomeCards'
import { Shelf, LoadMoreGrid } from './HomeShelf'
import { ancestorChain } from '@/utils/pageHierarchy'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  displayOf, sortTopics, sortEventsByDate, eventYears, sortReferencesByUpdated, isUnassignedReference,
  primaryEventCounts, compareTitles,
} from '@/utils/homeIndex'

// ── Shared chip/sort primitives ─────────────────────────────────────────────────

function chip(active: boolean): string {
  return active
    ? 'rounded-full px-4 py-1.5 font-heebo text-[13px] font-semibold text-white'
    // Literal white, not bg-card — same reasoning as HomeCards' CARD_SHELL: var(--card) (#FAFCFE) sits
    // ~1 RGB unit from the --lp-ribbon-bg page wash these chips sit on, collapsing their hairline
    // border into the background. The design's own export uses #fff for both chips and cards.
    : 'rounded-full border px-4 py-1.5 font-heebo text-[13px] font-medium bg-white hover:bg-[var(--tag-bg)] transition-colors'
}
const chipStyle = (active: boolean) =>
  active ? { background: 'var(--lp-ink)' } : { borderColor: 'var(--lp-hairline)', color: 'var(--lp-ink)' }

// A real, functional sort control. The design notes only specify each tab's DEFAULT sort (events by
// date, topics by hierarchy then title, reference by last update) — it never draws an open dropdown
// state or lists alternate options anywhere. The extra options below are therefore INFERRED, not
// pixel-specified, disclosed as such rather than silently invented. Follows this codebase's existing
// Select usage convention exactly (see TopicEditor.tsx's region picker): the trigger's own children
// render the current label directly, no SelectValue.
function SortSelect<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger
        size="sm"
        className="h-auto gap-1 border-none bg-transparent px-0 shadow-none hover:bg-transparent font-heebo text-[13px]"
        style={{ color: 'var(--lp-label)' }}
      >
        <span>מיון: {current?.label}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// RTL order confirmed against the design's raw export: filter chips come FIRST in DOM (rightmost —
// first-in-DOM is rightmost in RTL) and the sort control comes LAST, pushed away from the chips via
// margin-inline-start:auto on the sort side specifically — NOT on the chips. The previous build had
// this backwards (sort rendered first, chips wrapped in ms-auto), which pushes the CHIPS left instead
// of the sort control — one shared mistake across all three tabs, fixed once here since every tab
// routes through this same primitive.
function FilterRow({ chips, sort }: { chips: React.ReactNode; sort: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">{chips}</div>
      <div className="ms-auto">{sort}</div>
    </div>
  )
}

// One column below sm: at 320px a two-column cell is 132px wide, which clipped the card's own
// date and title inside its overflow-hidden border box.
const GRID_4 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
const GRID_3 = 'grid grid-cols-1 sm:grid-cols-3 gap-4'
const GRID_2_HORIZ = 'grid grid-cols-1 sm:grid-cols-2 gap-4'

// ── הכל tab — three shelves ──────────────────────────────────────────────────────

export function HomeAllTab({
  topics, events, references, byId, onSelectTab,
}: {
  topics: TopicPage[]; events: EventPage[]; references: ReferencePage[]
  byId: Map<string, ContentPage>
  onSelectTab: (tab: 'topic' | 'event' | 'reference') => void
}) {
  const sortedTopics = sortTopics(topics, byId)
  const sortedEvents = sortEventsByDate(events)
  const sortedRefs = sortReferencesByUpdated(references)
  const eventCounts = primaryEventCounts(events, byId)

  return (
    <div className="flex flex-col gap-8">
      <Shelf
        label="דפי נושא" count={topics.length} totalLabel={`הצג את כל ${topics.length} הדפים`}
        items={sortedTopics} windowSize={3} gridClassName={GRID_3}
        renderCard={(t) => <TopicCard topic={t} byId={byId} eventCount={eventCounts.get(t.id) ?? 0} />}
        onShowAll={() => onSelectTab('topic')}
      />
      <Shelf
        label="דפי אירוע" count={events.length} totalLabel={`הצג את כל ${events.length} הדפים`}
        items={sortedEvents} windowSize={4} gridClassName={GRID_4}
        renderCard={(e) => <EventCard event={e} byId={byId} />}
        onShowAll={() => onSelectTab('event')}
      />
      <Shelf
        label="דפי עיון" count={references.length} totalLabel={`הצג את כל ${references.length} הדפים`}
        items={sortedRefs} windowSize={4} gridClassName={GRID_2_HORIZ}
        renderCard={(r) => <ReferenceCard reference={r} byId={byId} horizontal />}
        onShowAll={() => onSelectTab('reference')}
      />
    </div>
  )
}

// ── דפי נושא tab ──────────────────────────────────────────────────────────────────
// Chips not pixel-specified in the design notes (topic tab state was deliberately left undrawn — "build it
// from 7f... structurally identical... with topic chips"). Root vs. sub-topic is the one binary split
// that's actually meaningful against our hierarchy data, mirroring the shape of the reference tab's own
// assignment split; this is an inferred, not a drawn, design decision — flagging it as such.

type TopicSort = 'hierarchy' | 'title'
const TOPIC_SORT_OPTIONS: { value: TopicSort; label: string }[] = [
  { value: 'hierarchy', label: 'היררכיה' },
  { value: 'title', label: 'לפי כותרת' },
]

export function HomeTopicsTab({
  topics, events, byId,
}: {
  topics: TopicPage[]; events: EventPage[]; byId: Map<string, ContentPage>
}) {
  const [filter, setFilter] = useState<'all' | 'root' | 'child'>('all')
  const [sort, setSort] = useState<TopicSort>('hierarchy')
  const hierarchySorted = sortTopics(topics, byId)
  const sorted = sort === 'hierarchy'
    ? hierarchySorted
    : [...topics].sort(compareTitles)   // published title, not live — see compareTitles
  const rootCount = hierarchySorted.filter((t) => ancestorChain(t, byId).length === 0).length
  const childCount = hierarchySorted.length - rootCount
  const filtered = sorted.filter((t) => {
    if (filter === 'all') return true
    const isRoot = ancestorChain(t, byId).length === 0
    return filter === 'root' ? isRoot : !isRoot
  })
  const eventCounts = primaryEventCounts(events, byId)

  return (
    <div>
      <FilterRow
        chips={
          <>
            <button type="button" className={chip(filter === 'root')} style={chipStyle(filter === 'root')} onClick={() => setFilter(filter === 'root' ? 'all' : 'root')}>
              נושאי אב · {rootCount}
            </button>
            <button type="button" className={chip(filter === 'child')} style={chipStyle(filter === 'child')} onClick={() => setFilter(filter === 'child' ? 'all' : 'child')}>
              תת־נושאים · {childCount}
            </button>
            <button type="button" className={chip(filter === 'all')} style={chipStyle(filter === 'all')} onClick={() => setFilter('all')}>
              הכל
            </button>
          </>
        }
        sort={<SortSelect value={sort} onChange={setSort} options={TOPIC_SORT_OPTIONS} />}
      />
      <LoadMoreGrid
        key={`${filter}:${sort}`}
        items={filtered} pageSize={8} gridClassName={GRID_4}
        renderCard={(t) => <TopicCard topic={t} byId={byId} eventCount={eventCounts.get(t.id) ?? 0} />}
      />
    </div>
  )
}

// ── דפי אירוע tab ─────────────────────────────────────────────────────────────────

type EventSort = 'date-desc' | 'date-asc' | 'title'
const EVENT_SORT_OPTIONS: { value: EventSort; label: string }[] = [
  { value: 'date-desc', label: 'תאריך אירוע (חדש לישן)' },
  { value: 'date-asc', label: 'תאריך אירוע (ישן לחדש)' },
  { value: 'title', label: 'לפי כותרת' },
]

export function HomeEventsTab({ events, byId }: { events: EventPage[]; byId: Map<string, ContentPage> }) {
  const [year, setYear] = useState<number | 'all'>('all')
  const [sort, setSort] = useState<EventSort>('date-desc')
  const years = eventYears(events)   // order-independent — it sorts the years itself
  // Direction is passed INTO the comparator rather than reversing a descending list: reversing would
  // promote undated events from last to first and flip equal-dated events against each other.
  const sorted = sort === 'title'
    ? [...events].sort(compareTitles)
    : sortEventsByDate(events, sort === 'date-asc' ? 'asc' : 'desc')
  const filtered = year === 'all'
    ? sorted
    : sorted.filter((e) => {
        const date = displayOf(e).content?.hero?.date
        return date && new Date(date).getFullYear() === year
      })

  return (
    <div>
      <FilterRow
        chips={
          <>
            {years.map((y) => (
              <button key={y} type="button" className={chip(year === y)} style={chipStyle(year === y)} onClick={() => setYear(year === y ? 'all' : y)}>
                {y}
              </button>
            ))}
            <button type="button" className={chip(year === 'all')} style={chipStyle(year === 'all')} onClick={() => setYear('all')}>
              הכל
            </button>
          </>
        }
        sort={<SortSelect value={sort} onChange={setSort} options={EVENT_SORT_OPTIONS} />}
      />
      <LoadMoreGrid
        key={`${String(year)}:${sort}`}
        items={filtered} pageSize={8} gridClassName={GRID_4}
        renderCard={(e) => <EventCard event={e} byId={byId} />}
      />
    </div>
  )
}

// ── דפי עיון tab — the actual answer to the orphaned-Reference problem ────────────

type RefSort = 'updated-desc' | 'updated-asc' | 'title'
// Label grammar deliberately parallels EVENT_SORT_OPTIONS above ("<key> (חדש לישן)" / "(ישן לחדש)")
// rather than three different phrasings — these two dropdowns sit in the same position on sibling tabs.
const REF_SORT_OPTIONS: { value: RefSort; label: string }[] = [
  { value: 'updated-desc', label: 'עדכון אחרון (חדש לישן)' },
  { value: 'updated-asc', label: 'עדכון אחרון (ישן לחדש)' },
  { value: 'title', label: 'לפי כותרת' },
]

export function HomeReferencesTab({ references, byId }: { references: ReferencePage[]; byId: Map<string, ContentPage> }) {
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [sort, setSort] = useState<RefSort>('updated-desc')
  // Direction passed into the comparator, not a post-hoc reverse — see sortReferencesByUpdated.
  const sorted = sort === 'title'
    ? [...references].sort(compareTitles)
    : sortReferencesByUpdated(references, sort === 'updated-asc' ? 'asc' : 'desc')
  const unassigned = sorted.filter((r) => isUnassignedReference(r, byId))
  const assigned = sorted.filter((r) => !isUnassignedReference(r, byId))

  return (
    <div>
      <FilterRow
        chips={
          <>
            <button type="button" className={chip(filter === 'unassigned')} style={chipStyle(filter === 'unassigned')} onClick={() => setFilter(filter === 'unassigned' ? 'all' : 'unassigned')}>
              ללא שיוך · {unassigned.length}
            </button>
            <button type="button" className={chip(filter === 'assigned')} style={chipStyle(filter === 'assigned')} onClick={() => setFilter(filter === 'assigned' ? 'all' : 'assigned')}>
              משויכים לנושא · {assigned.length}
            </button>
            <button type="button" className={chip(filter === 'all')} style={chipStyle(filter === 'all')} onClick={() => setFilter('all')}>
              הכל
            </button>
          </>
        }
        sort={<SortSelect value={sort} onChange={setSort} options={REF_SORT_OPTIONS} />}
      />
      {/* Same `key={filter:sort}` reset the other two tabs get from LoadMoreGrid — this tab can't use
          LoadMoreGrid (it renders TWO independently-headed sections off one shared page size), so the
          paged region is its own component and the key remounts it. Without this the "טען עוד" count
          survives a filter/sort change, which no other tab does. */}
      <ReferenceSections
        key={`${filter}:${sort}`}
        unassigned={unassigned} assigned={assigned} filter={filter} byId={byId}
      />
    </div>
  )
}

const REF_PAGE_SIZE = 4

function ReferenceSections({
  unassigned, assigned, filter, byId,
}: {
  unassigned: ReferencePage[]; assigned: ReferencePage[]
  filter: 'all' | 'unassigned' | 'assigned'
  byId: Map<string, ContentPage>
}) {
  const [pageSize, setPageSize] = useState(REF_PAGE_SIZE)

  const showUnassigned = filter !== 'assigned'
  const showAssigned = filter !== 'unassigned'
  const visibleUnassigned = unassigned.slice(0, pageSize)
  const visibleAssigned = assigned.slice(0, pageSize)
  const shown = (showUnassigned ? visibleUnassigned.length : 0) + (showAssigned ? visibleAssigned.length : 0)
  const total = (showUnassigned ? unassigned.length : 0) + (showAssigned ? assigned.length : 0)
  const hasMore = shown < total

  return (
    <>
      {showUnassigned && unassigned.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline gap-2.5">
            <span className="font-heebo text-sm font-bold" style={{ color: 'var(--lp-ink)' }}>ללא שיוך לנושא</span>
            <span className="font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>{unassigned.length}</span>
            <span className="font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>· נגישים מדף זה בלבד</span>
          </div>
          <div className={GRID_4}>
            {visibleUnassigned.map((r) => <ReferenceCard key={r.id} reference={r} byId={byId} />)}
          </div>
        </section>
      )}

      {showAssigned && assigned.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline gap-2.5">
            <span className="font-heebo text-sm font-bold" style={{ color: 'var(--lp-ink)' }}>משויכים לנושא</span>
            <span className="font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>{assigned.length}</span>
          </div>
          <div className={GRID_4}>
            {visibleAssigned.map((r) => <ReferenceCard key={r.id} reference={r} byId={byId} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <p className="py-16 text-center font-heebo text-sm" style={{ color: 'var(--lp-label)' }}>לא נמצאו דפים</p>
      )}

      {total > 0 && (
        <div className="mt-6 flex items-center justify-center gap-3.5 font-heebo text-[13px]" style={{ color: 'var(--lp-label)' }}>
          {hasMore && (
            <button type="button" onClick={() => setPageSize((n) => n + REF_PAGE_SIZE)} className="font-semibold hover:underline" style={{ color: 'var(--lp-accent)' }}>
              טען עוד ←
            </button>
          )}
          <span>מציג {shown} מתוך {total}</span>
        </div>
      )}
    </>
  )
}
