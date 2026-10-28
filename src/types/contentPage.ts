export type Region = 'הצפון' | 'הדרום' | 'מעבר לים הצר' | 'ארצות הסערה'

export const EVENT_TYPES = [
  'הסתערות על מעוז',
  'חציית גדר',
  'פיגוע',
  'ירי',
  'שיגור רקטות',
  'חדירת כטב"ם',
  'הברחה',
  'ניסיון חטיפה',
  'הנחת מטען חבלה',
  'אחר',
] as const

export type CaptionedImage = {
  id: string
  src: string
  name: string
  caption?: string
}

/** @deprecated Use CaptionedImage */
export type MediaImage = CaptionedImage

export type DeepeningItem =
  | { type: 'אוגדן'; title: string; url: string }
  | { type: 'מסמך'; title: string; fileName: string; fileRef: string }

export type ArenaCharacteristics = {
  ourForces: string
  enemy: string
  additional: string[]
}

export type HistorySection = {
  teaser: string
  fullContent: string
}

export type CommanderHighlight = {
  heading: string
  points: string[]
}

export type TimelineEvent = {
  id: string
  /**
   * 'YYYY-MM-DD' on topic pages (months scale)
   * | full ISO datetime 'YYYY-MM-DDTHH:MM' on event pages (hours scale)
   *
   * Event pages carry the date as well as the time so an incident running past midnight
   * (e.g. 23:40 → 01:15) sorts and measures correctly. Both forms parse with `new Date()`.
   */
  timestamp: string
  label: string
  description?: string
}

export type MeetingPoint = {
  id: string
  kind: 'תגובה' | 'בו-זמני'
  enemyEventId: string
  friendlyEventId: string
  label?: string
}

/**
 * "גורם משפיע" — context that shaped the period, deliberately NOT an event: it has no axis, no dot
 * on the spine, and takes no part in windowing, gap detection or lane assignment. The viewer renders
 * it as a background tint behind everything plus a label chip in its own strip.
 *
 * `endTs` absent = a point in time; present = a range. That presence IS the mode discriminant —
 * there is no separate `kind`, matching how `MeetingPoint.label` already uses `undefined`.
 */
export type InfluencingFactor = {
  id: string
  label: string
  /** Same convention as `TimelineEvent.timestamp` — date-only on topic pages, ISO datetime on event pages. */
  startTs: string
  /** Absent = point in time. When present, expected ≥ startTs (the editor warns but does not block). */
  endTs?: string
}

export type TimelineData = {
  enemyEvents: TimelineEvent[]
  friendlyEvents: TimelineEvent[]
  meetingPoints?: MeetingPoint[]
  influencingFactors?: InfluencingFactor[]
}

export type TopicContent = {
  hero?: {
    subtitle: string
    periodFrom: string
    periodTo: string
    region: Region
    // Optional banner image for the full-bleed header (image-left / metadata-right). Reuses
    // CaptionedImage for consistency with gallery/map/dashboards; caption is typically unused here.
    heroImage?: CaptionedImage
  }
  overview?: {
    summary: string
    background: string
    arenaCharacteristics: ArenaCharacteristics
  }
  // "דבר המלך" — shared across all three page types, optional everywhere. Rendered by the shared
  // CommanderWord component (editor + viewer).
  commanderWord?: string
  deepening?: DeepeningItem[]
  gallery?: CaptionedImage[]
  map?: CaptionedImage[]
  dashboards?: CaptionedImage[]
  historySection?: HistorySection
  timeline?: TimelineData
}

export type InfoGrid = {
  commanderSummary: string
  eventType: string
  eventTypeDetail: string
  sector: string
  timeFrom: string
  timeTo: string
  forces: string
  enemy: string
}

export type EventContent = {
  hero?: {
    subtitle: string
    date: string
    region: Region
    // Optional banner image — identical field/behavior to TopicContent.hero.heroImage (no divergence).
    heroImage?: CaptionedImage
  }
  infoGrid?: InfoGrid
  commanderWord?: string
  deepening?: DeepeningItem[]
  gallery?: CaptionedImage[]
  map?: CaptionedImage[]
  dashboards?: CaptionedImage[]
  historySection?: HistorySection
  timeline?: TimelineData
  commanderHighlights?: CommanderHighlight[]
}

// דף עיון (Reference page) — a cross-cutting research/synthesis page. Deliberately has NO
// period/region/arenaCharacteristics (those produce placeholder "does not apply" content on a
// synthesis page). deepening is its PRIMARY content and is required (>=1 item) to publish.
export type ReferencePageContent = {
  hero?: {
    subtitle: string
    // Banner image — same field/component/behavior as Topic & Event heroes (image-left / metadata-
    // right, text-only fallback when absent). Reverses the original text-only-header decision.
    heroImage?: CaptionedImage
  }
  // The analyst's own narrative tying the referenced material together — new to this type.
  overview?: {
    synthesis: string
  }
  commanderWord?: string
  deepening: DeepeningItem[]
}

type BasePage = {
  id: string
  title: string
  // 'archived' is only reachable from 'published' and only reversible back to 'published' (exact same
  // content — see pageService.archivePage/unarchivePage). A single enum, not a separate boolean, so a
  // meaningless "draft + archived" state can never exist.
  status: 'draft' | 'published' | 'archived'
  createdAt: string
  updatedAt: string
  // Unified LATERAL links — any page to any page, the linked page's type is looked up from its id.
  // Symmetric: derived by hydratePages from the single lateral join table, mirrored onto both ends,
  // never stored on the page. This is DISTINCT from the topic parent/child hierarchy below.
  linkedPageIds?: string[]
}

export type TopicPage = BasePage & {
  type: 'topic'
  // Topic hierarchy (derived by pageService.hydratePages from the SEPARATE topic-topic join table,
  // never stored on the page). parentTopicId powers upward breadcrumbs; childTopicIds powers the
  // children section. Both come from one edge, mirrored. A different mechanism from linkedPageIds.
  parentTopicId?: string
  childTopicIds?: string[]
  content?: TopicContent
  publishedSnapshot?: { title: string; content: TopicContent }
  lastPublishedAt?: string
}

export type EventPage = BasePage & {
  type: 'event'
  content?: EventContent
  publishedSnapshot?: { title: string; content: EventContent }
  lastPublishedAt?: string
}

export type ReferencePage = BasePage & {
  type: 'reference'
  content?: ReferencePageContent
  publishedSnapshot?: { title: string; content: ReferencePageContent }
  lastPublishedAt?: string
}

export type ContentPage = TopicPage | EventPage | ReferencePage
