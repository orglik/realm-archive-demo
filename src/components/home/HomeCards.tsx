import { Link } from 'react-router-dom'
import type { TopicPage, EventPage, ReferencePage, ContentPage } from '@/types/contentPage'
import { formatDate } from '@/utils/dateUtils'
import {
  displayOf, heroImageSrc, publishedChildCount, eventContextTopic, referenceAssignedTopic,
} from '@/utils/homeIndex'

// Reader-facing home/index page cards. Type is distinguished by PILL TREATMENT, never a new hue, per
// the design notes: topic = filled tint, event = solid ink, reference = outlined. Cards with no
// cover image render a neutral striped placeholder of the same size — never collapse.

function CardImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  if (src) return <img src={src} alt={alt} className={`${className} object-cover`} />
  return (
    <div
      className={`${className}`}
      aria-hidden
      style={{
        background: 'linear-gradient(160deg, var(--lp-ribbon-bg), var(--tag-bg))',
      }}
    />
  )
}

function EventPill() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold font-heebo text-white"
      style={{ background: 'var(--lp-ink)' }}
    >
      אירוע
    </span>
  )
}
function ReferencePill() {
  return (
    <span
      // self-start: in the horizontal shelf card below, this pill is a direct child of a flex-col
      // container with the default cross-axis stretch — without self-start it stretches to the
      // container's full width, ballooning into a giant oval instead of a tight badge.
      className="inline-flex shrink-0 self-start items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold font-heebo"
      style={{ color: 'var(--lp-accent)', borderColor: 'var(--lp-accent)' }}
    >
      עיון
    </span>
  )
}

// Literal white, not var(--card) (#FAFCFE) — confirmed against the design's raw export, cards there
// are background:#fff sitting on a #F7F9FC/#F9FBFD page wash. var(--card) is close enough to
// --lp-ribbon-bg (the page wash used below in HomePage.tsx) that the two collapsed into each other,
// making the border read as an all-but-invisible frame. True white restores the intended contrast.
//
// The explicit display class is load-bearing, not decoration. Topic and Reference cards are <Link>s,
// i.e. <a>, which is display:inline by default. `border`, `border-radius`, `overflow` and `box-shadow`
// do not apply to a non-replaced inline box, and an inline box wrapping BLOCK children (our image div
// + content div) gets split into fragments — so the frame and the white background paint around those
// empty fragments instead of around the card, leaving the card looking frameless and transparent.
// EventCard is a <div> (block) and ReferenceCard's horizontal variant adds `flex` (block-level), which
// is exactly why those two rendered a visible frame while the topic cards did not, despite all three
// sharing this identical style. Keep vertical/row split as two constants rather than appending `flex`
// to one shell — with both `block` and `flex` present the winner is CSS source order, not class order.
const CARD_BASE = 'bg-white border rounded-lg overflow-hidden'
const CARD_SHELL = `block ${CARD_BASE}`
const CARD_SHELL_ROW = `flex ${CARD_BASE}`
const cardBorder = { borderColor: 'var(--lp-hairline)' }

// ── Topic card ───────────────────────────────────────────────────────────────────

export function TopicCard({
  topic, byId, eventCount,
}: {
  topic: TopicPage; byId: Map<string, ContentPage>
  /** Direct-only, precomputed via primaryEventCounts (see homeIndex.ts) — passed in rather than
      recomputed per-card so every card on a given screen agrees with every other. */
  eventCount: number
}) {
  const { title, content } = displayOf(topic)
  const childCount = publishedChildCount(topic, byId)
  return (
    <Link to={`/read/${topic.id}`} className={CARD_SHELL} style={cardBorder}>
      <CardImage src={heroImageSrc(content)} alt={title} className="h-[132px] w-full border-b" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg font-heebo text-base font-bold text-white"
            style={{ background: 'var(--lp-ink)' }}
          >
            {title.trim().charAt(0) || '•'}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="line-clamp-2 font-heebo text-[15px] font-bold leading-snug" style={{ color: 'var(--lp-ink)' }}>
              {title}
            </p>
            <p className="mt-0.5 font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>
              {childCount} תתי־נושאים · {eventCount} אירועים
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Event card ───────────────────────────────────────────────────────────────────

export function EventCard({ event, byId }: { event: EventPage; byId: Map<string, ContentPage> }) {
  const { title, content } = displayOf(event)
  const topic = eventContextTopic(event, byId)
  const date = content?.hero?.date
  return (
    <div className={CARD_SHELL} style={cardBorder}>
      <CardImage src={heroImageSrc(content)} alt={title} className="h-[124px] w-full border-b" />
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <EventPill />
          {date && (
            <span className="font-mono text-xs" style={{ color: 'var(--lp-label)' }} dir="ltr">
              {formatDate(date)}
            </span>
          )}
        </div>
        <Link
          to={`/read/${event.id}`}
          className="mt-2 line-clamp-2 block font-heebo text-base font-bold leading-snug hover:underline"
          style={{ color: 'var(--lp-ink)' }}
        >
          {title}
        </Link>
        {/* Always rendered, even with no topic (nbsp placeholder) — reserves the line's height so an
            unlinked event's card isn't visibly shorter than every other card in the same row/grid.
            Always a link, with no draft/archived branch: byId is built from publishedOnly (HomePage.tsx),
            so eventContextTopic can only ever resolve a PUBLISHED topic here — a status branch would be
            dead code describing a state this surface cannot reach. */}
        <p className="mt-1.5 truncate font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>
          {topic ? (
            <Link to={`/read/${topic.id}`} className="hover:underline">{displayOf(topic).title}</Link>
          ) : (
            ' '
          )}
        </p>
      </div>
    </div>
  )
}

// ── Reference card ───────────────────────────────────────────────────────────────

export function ReferenceCard({
  reference, byId, horizontal = false,
}: {
  reference: ReferencePage; byId: Map<string, ContentPage>; horizontal?: boolean
}) {
  const { title, content } = displayOf(reference)
  const assignedTopic = referenceAssignedTopic(reference, byId)
  // lastPublishedAt is a full ISO timestamp (new Date().toISOString()), not a plain date — formatDate
  // only drops the time for a YYYY-MM-DD-shaped input, so slice to the date portion first or it prints
  // a stray ", HH:MM" the design never shows on a card.
  const dateLabel = reference.lastPublishedAt ? formatDate(reference.lastPublishedAt.slice(0, 10)) : ''
  const contextLabel = assignedTopic ? displayOf(assignedTopic).title : 'ללא שיוך'

  if (horizontal) {
    // Shelf variant — compact horizontal card (fixed-width thumb + flex content), matching the design's
    // דפי עיון shelf row specifically. The dedicated עיון tab uses the vertical shape below instead.
    return (
      <Link to={`/read/${reference.id}`} className={CARD_SHELL_ROW} style={cardBorder}>
        <CardImage src={heroImageSrc(content)} alt={title} className="w-[104px] shrink-0 border-e" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <ReferencePill />
          <p className="line-clamp-2 font-heebo text-[15px] font-bold leading-snug" style={{ color: 'var(--lp-ink)' }}>
            {title}
          </p>
          <p className="mt-auto font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>
            {contextLabel}{dateLabel && ` · ${dateLabel}`}
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link to={`/read/${reference.id}`} className={CARD_SHELL} style={cardBorder}>
      <CardImage src={heroImageSrc(content)} alt={title} className="h-[118px] w-full border-b" />
      <div className="p-4">
        {/* Wider gap + its own border on the second pill — without both, "עיון" (outlined, accent
            border) sat flush against "ללא שיוך" (borderless tint), and since both use the same accent
            color the two read as one merged, oversized badge rather than two distinct pills. */}
        <div className="flex flex-wrap items-center gap-2">
          <ReferencePill />
          {!assignedTopic && (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold font-heebo"
              style={{ color: 'var(--lp-accent)', background: 'var(--tag-bg)', borderColor: 'var(--lp-hairline)' }}
            >
              ללא שיוך
            </span>
          )}
        </div>
        <p className="mt-2.5 line-clamp-2 font-heebo text-[15.5px] font-bold leading-snug" style={{ color: 'var(--lp-ink)' }}>
          {title}
        </p>
        <p className="mt-1.5 font-heebo text-[12.5px]" style={{ color: 'var(--lp-label)' }}>
          {contextLabel}{dateLabel && ` · ${dateLabel}`}
        </p>
      </div>
    </Link>
  )
}
