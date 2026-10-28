import type { ContentPage, TopicPage, EventPage, ReferencePage, CaptionedImage } from '@/types/contentPage'
import { primaryParentId, ancestorChain } from './pageHierarchy'

// Derivation utilities for the reader-facing home/index page. Every function
// here is READER-facing: it must only ever be fed already-published-filtered pages, and must resolve
// display data from publishedSnapshot, never live content/title (an analyst's unsaved in-progress
// edits on a published page must never leak onto the public index — see displayOf below).
//
// Reuses pageHierarchy.ts's primaryParentId/ancestorChain (which already correctly exclude archived
// topics from anchor candidacy) — NOT ContentTable.tsx's local primaryTopicOf/localTopicDepth, which
// deliberately do the OPPOSITE (archived stays a valid nesting parent there, because the management
// list shows archived pages inline). Reusing the ContentTable versions here would let an archived
// topic anchor a reader-facing card — the wrong policy for this surface.

// ── Reader-safe display resolution ──────────────────────────────────────────────

/**
 * Resolves a page's PUBLIC display data — always publishedSnapshot when present, falling back to live
 * title/content only for the (never-expected-here) case a page without one slips through. Any page
 * with status 'published' is guaranteed a publishedSnapshot (enforced by publishPage/archivePage's own
 * preconditions), so this fallback is purely defensive, not a real code path for this page.
 */
export function displayOf<T extends ContentPage>(page: T): { title: string; content: T['content'] } {
  if (page.publishedSnapshot) {
    return { title: page.publishedSnapshot.title, content: page.publishedSnapshot.content as T['content'] }
  }
  return { title: page.title, content: page.content }
}

// ── Base filtering ───────────────────────────────────────────────────────────────

/** The one filter every homepage query starts from — drafts and archived never appear, no trace. */
export function publishedOnly(pages: ContentPage[]): ContentPage[] {
  return pages.filter((p) => p.status === 'published')
}

export function byIdMap(pages: ContentPage[]): Map<string, ContentPage> {
  return new Map(pages.map((p) => [p.id, p]))
}

// ── Cover image ──────────────────────────────────────────────────────────────────

/** Common shape across all three content types' optional hero.heroImage. */
export function heroImageSrc(content: { hero?: { heroImage?: CaptionedImage } } | undefined): string | undefined {
  return content?.hero?.heroImage?.src
}

// ── Topic cards ──────────────────────────────────────────────────────────────────

/** Direct child topics, published only (drafts/archived children don't count on a reader-facing card). */
export function publishedChildCount(topic: TopicPage, byId: Map<string, ContentPage>): number {
  return (topic.childTopicIds ?? []).filter((id) => byId.get(id)?.status === 'published').length
}

/**
 * Direct-only event count per topic: an event counts toward exactly the ONE topic primaryParentId
 * assigns it to (its deepest linked topic), not every topic it happens to link — matching exactly what
 * the management list now nests an event under post-dedup-fix. Deliberately NOT a recursive subtree
 * rollup (no existing precedent for that anywhere in the codebase, and it wasn't asked for). Precomputed
 * once for all topics in a single pass, not per-card, so every card's count is guaranteed consistent
 * with every other — same reasoning as ContentTable's own precomputed primaryTopicOf map.
 */
export function primaryEventCounts(events: EventPage[], byId: Map<string, ContentPage>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const e of events) {
    const topicId = primaryParentId(e, byId)
    if (!topicId) continue
    counts.set(topicId, (counts.get(topicId) ?? 0) + 1)
  }
  return counts
}

/** Sort order for the topics tab/shelf: hierarchy (root-first, by depth) then title. Depth is read via
 *  ancestorChain's length (0 = root) rather than re-deriving depth locally — one source of truth.
 *  The tie-break sorts on the PUBLISHED title (displayOf), not the live one: sorting by a title the
 *  reader can't see would order the grid by an analyst's unsaved draft rename. */
export function sortTopics(topics: TopicPage[], byId: Map<string, ContentPage>): TopicPage[] {
  return [...topics].sort((a, b) => {
    const depthA = ancestorChain(a, byId).length
    const depthB = ancestorChain(b, byId).length
    if (depthA !== depthB) return depthA - depthB
    return compareTitles(a, b)
  })
}

/** Shared published-title comparator — the one place every reader-facing "by title" sort goes through,
 *  so no surface can drift back to reading the live title. */
export function compareTitles(a: ContentPage, b: ContentPage): number {
  return displayOf(a).title.localeCompare(displayOf(b).title, 'he')
}

/**
 * Comparator for an optional string sort key, direction-aware.
 * Two properties a post-hoc `.reverse()` of a descending list does NOT have:
 *  - Items with NO key (empty string) always sort LAST, in BOTH directions. Reversing instead promotes
 *    every undated/never-published item to the very top of the ascending view.
 *  - Equal keys return 0, so Array.prototype.sort's stability preserves the incoming relative order in
 *    both directions. Reversing flips equal-key items against each other when direction changes.
 */
function compareOptionalKey(a: string, b: string, dir: SortDir): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return dir === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
}

export type SortDir = 'desc' | 'asc'

// ── Event cards ──────────────────────────────────────────────────────────────────

/** The topic an event's card should name as context — its primary (deepest) linked topic, or
 *  undefined if none is in view (no linked topic, or its only one is archived). */
export function eventContextTopic(event: EventPage, byId: Map<string, ContentPage>): TopicPage | undefined {
  const id = primaryParentId(event, byId)
  if (!id) return undefined
  const t = byId.get(id)
  return t?.type === 'topic' ? t : undefined
}

/** Events by hero date. Undated events sort last in BOTH directions — see compareOptionalKey. */
export function sortEventsByDate(events: EventPage[], dir: SortDir = 'desc'): EventPage[] {
  return [...events].sort((a, b) =>
    compareOptionalKey(
      displayOf(a).content?.hero?.date ?? '',
      displayOf(b).content?.hero?.date ?? '',
      dir,
    )
  )
}

/** Distinct years present across the current event set, descending — derived from OUR real data, not
 *  a hardcoded list, so the year chips always match what's actually there. */
export function eventYears(events: EventPage[]): number[] {
  const years = new Set<number>()
  for (const e of events) {
    const date = displayOf(e).content?.hero?.date
    if (date) years.add(new Date(date).getFullYear())
  }
  return [...years].sort((a, b) => b - a)
}

// ── Reference cards ──────────────────────────────────────────────────────────────

/**
 * The reference's "assigned" topic — a linked page that is BOTH type 'topic' AND status 'published'.
 * This drives the ללא שיוך / משויכים split, whose entire purpose is real reader discoverability ("זו
 * נקודת הכניסה היחידה אליהם במוצר"): a reference linked only to a draft or archived topic is exactly
 * as undiscoverable as one with no link at all, so it must land in ללא שיוך.
 *
 * The status check is REDUNDANT BY CONSTRUCTION on the homepage — byId there is built from
 * publishedOnly (HomePage.tsx), so an unpublished topic is absent from the map entirely and the
 * `!!p` guard already rejects it. It is kept as a real guard, not decoration, so the function stays
 * correct if it is ever handed an unfiltered map; do not read it as a behavioral contrast with
 * eventContextTopic, which resolves against the same published-only map and is therefore no more
 * permissive in practice.
 *
 * If a reference links more than one published topic, the first (by linkedPageIds order) is shown as
 * context; no "deepest wins" tie-break here — unlike events, references aren't IN the hierarchy at all
 * (see pageHierarchy.ts), so there's no structural depth to compare, and the design shows no overflow
 * indicator for this card's single context line.
 */
export function referenceAssignedTopic(ref: ReferencePage, byId: Map<string, ContentPage>): TopicPage | undefined {
  return (ref.linkedPageIds ?? [])
    .map((id) => byId.get(id))
    .find((p): p is TopicPage => !!p && p.type === 'topic' && p.status === 'published')
}

export function isUnassignedReference(ref: ReferencePage, byId: Map<string, ContentPage>): boolean {
  return referenceAssignedTopic(ref, byId) === undefined
}

/** Sort for the reference tab: last UPDATE meaning last time it was actually published, not the live
 *  updatedAt field — a page can accumulate unpublished draft edits that bump updatedAt with nothing
 *  publicly visible changing; lastPublishedAt is what a reader's "last updated" claim must reflect,
 *  same reasoning as displayOf resolving from publishedSnapshot rather than live content.
 *  References with no lastPublishedAt sort last in BOTH directions — see compareOptionalKey. */
export function sortReferencesByUpdated(refs: ReferencePage[], dir: SortDir = 'desc'): ReferencePage[] {
  return [...refs].sort((a, b) =>
    compareOptionalKey(a.lastPublishedAt ?? '', b.lastPublishedAt ?? '', dir)
  )
}
