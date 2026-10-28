import type { ContentPage, TopicPage, EventPage, ReferencePage } from '@/types/contentPage'
import type { PageLink } from '@/data/mockLinks'
import type { TopicTopicLink } from '@/data/mockTopicLinks'
import { mockPages } from '@/data/mockPages'
import { mockLinks } from '@/data/mockLinks'
import { mockTopicLinks } from '@/data/mockTopicLinks'
import { wouldCreateCycle } from '@/utils/topicHierarchy'

// ── Config ────────────────────────────────────────────────────────────────────

// Seeding runs ONLY when this key is absent (see readStorage below): an existing browser keeps its
// stored copy forever. BUMP THIS ON ANY CHANGE TO src/data/*.ts, or returning visitors silently keep
// the old dataset and it looks like a rendering bug rather than stale storage.
const PAGES_KEY = 'content_pages_v6'
const LINKS_KEY = 'content_links_v6'
const TOPIC_LINKS_KEY = 'content_topic_links_v6'
const DELAY_MS = 350

/** Set to true (e.g. in dev console) to make the next call throw. */
export const serviceConfig = { simulateError: false }

if (typeof window !== 'undefined') {
  // @ts-expect-error dev helper
  window.serviceConfig = serviceConfig
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((res) => setTimeout(res, DELAY_MS + Math.random() * 150))
}

function maybeThrow(): void {
  if (serviceConfig.simulateError) {
    serviceConfig.simulateError = false
    throw new Error('שגיאת שרת — אנא נסה שוב')
  }
}

// Pages storage — pages are stored WITHOUT linkedEventIds/linkedTopicIds (derived from links table)

function readStorage(): ContentPage[] {
  try {
    const raw = localStorage.getItem(PAGES_KEY)
    if (raw) return JSON.parse(raw) as ContentPage[]
  } catch { /* corrupted — fall through to seed */ }
  writeStorage(mockPages)
  return [...mockPages]
}

function writeStorage(pages: ContentPage[]): void {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(pages))
  } catch (e) {
    // Authoritative aggregate guard for the base64 image data URLs (hero + gallery/map/dashboards):
    // the per-section caps in the editor bound one section, but the true ceiling is the shared ~5MB
    // origin quota across ALL pages (and publishing duplicates content into publishedSnapshot). When
    // that ceiling is hit, setItem throws and leaves the PREVIOUS value intact — so we surface a clear
    // message and reject the save rather than letting a raw DOMException escape or corrupting storage.
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error('שטח האחסון המקומי מלא — לא ניתן לשמור. הסר תמונות גדולות ונסה שוב.')
    }
    throw e
  }
}

// Lateral links storage — single symmetric {aId,bId} table for page↔page relationships.
//
// NOTE: an inherited migration branch here used to read a legacy key holding DIRECTIONAL
// {topicId,eventId} rows and rewrite them as {aId,bId}. It was removed: this showcase has only
// ever written the symmetric shape, and the legacy key string was identical to LINKS_KEY, so the
// branch was unreachable — until a key bump, at which point it would have read the PREVIOUS
// version's symmetric rows as directional ones and stored {aId: undefined, bId: undefined},
// silently dropping every link. Bumping the key is now the whole migration story: an older
// version's rows are simply left behind and the dataset re-seeds.
function readLinks(): PageLink[] {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    if (raw) return JSON.parse(raw) as PageLink[]
  } catch { /* corrupted — fall through to seed */ }
  writeLinksStorage([...mockLinks])
  return [...mockLinks]
}

function writeLinksStorage(links: PageLink[]): void {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links))
}

// The other endpoint of a symmetric edge relative to `id`, or undefined if the edge doesn't touch id.
function otherEnd(link: PageLink, id: string): string | undefined {
  if (link.aId === id) return link.bId
  if (link.bId === id) return link.aId
  return undefined
}

// Topic-topic hierarchy storage — single source of truth for parent↔child topic relationships

function readTopicLinks(): TopicTopicLink[] {
  try {
    const raw = localStorage.getItem(TOPIC_LINKS_KEY)
    if (raw) return JSON.parse(raw) as TopicTopicLink[]
  } catch { /* corrupted — fall through to seed */ }
  writeTopicLinks([...mockTopicLinks])
  return [...mockTopicLinks]
}

function writeTopicLinks(links: TopicTopicLink[]): void {
  localStorage.setItem(TOPIC_LINKS_KEY, JSON.stringify(links))
}

// Derive linkedPageIds (all page types, symmetric) and — for topics only — parentTopicId /
// childTopicIds from the two join tables. The edge is the single source of truth, mirrored onto both
// ends. linkedPageIds and the hierarchy are independent mechanisms and can coexist on the same pair.

function hydratePages(
  pages: ContentPage[],
  links: PageLink[],
  topicLinks: TopicTopicLink[],
): ContentPage[] {
  return pages.map((page) => {
    const linkedPageIds = [
      ...new Set(links.map((l) => otherEnd(l, page.id)).filter((id): id is string => id !== undefined)),
    ]
    if (page.type === 'topic') {
      return {
        ...page,
        linkedPageIds,
        parentTopicId: topicLinks.find((l) => l.childId === page.id)?.parentId,
        childTopicIds: topicLinks.filter((l) => l.parentId === page.id).map((l) => l.childId),
      }
    }
    return { ...page, linkedPageIds }
  })
}

// Strip derived link fields before writing a page — they live in the join tables, not on the page

function stripLinks(page: ContentPage): ContentPage {
  if (page.type === 'topic') {
    const { linkedPageIds: _lp, parentTopicId: _p, childTopicIds: _c, ...rest } = page
    return rest as TopicPage
  }
  const { linkedPageIds: _lp, ...rest } = page
  return rest as EventPage | ReferencePage
}

function requirePage(pages: ContentPage[], id: string): [ContentPage[], number] {
  const idx = pages.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error(`דף ${id} לא נמצא`)
  return [pages, idx]
}

// THE dependency rule — one implementation, used by both the delete/unpublish gate here AND the
// list-page block reason (ContentTable), so the two can never drift (this replaces the previously
// duplicated computeBlockReason). Operates on HYDRATED pages (derived childTopicIds / linkedTopicIds).
//
// Decision 3 — hard block, no cascade: a topic with ANY published OR ARCHIVED descendant (child
// topics at any depth, or events linked to it or a descendant) blocks its own delete/unpublish. The
// analyst must reparent or unpublish descendants first; there is deliberately NO cascade path — a
// whole-subtree delete's blast radius dwarfs the single-meeting-point cascade built elsewhere, so it
// must never be a one-click action. For a leaf topic (no descendants) this reduces EXACTLY to the
// prior rule: published/archived events linked to it. Events are never blocked (they depend on
// topics, not vice versa).
// Archive counts identically to published here — archiving only hides a page from READERS (decision
// 4), it does not disown the dependency relationship, so it must not weaken this guarantee.
export function publishedBlockers(target: ContentPage, pages: ContentPage[]): ContentPage[] {
  if (target.type !== 'topic') return []
  const byId = new Map(pages.map((p) => [p.id, p]))
  const scope = new Set<string>([target.id])          // target + all descendant topic ids
  const stack = [target.id]
  while (stack.length) {
    const cur = byId.get(stack.pop()!)
    if (cur?.type !== 'topic') continue
    for (const cid of cur.childTopicIds ?? []) if (!scope.has(cid)) { scope.add(cid); stack.push(cid) }
  }
  return pages.filter((p) => {
    if (p.status !== 'published' && p.status !== 'archived') return false
    if (p.type === 'topic') return p.id !== target.id && scope.has(p.id)
    // Only EVENTS create a blocking dependency on a topic (unchanged rule; scope holds topic ids, so
    // this fires exactly when the event links a scope topic). Reference pages are lateral references,
    // never dependencies — a published/archived reference linking a topic never blocks it.
    if (p.type === 'event') return (p.linkedPageIds ?? []).some((pid) => scope.has(pid))
    return false
  })
}

// UI-facing label (list page). Same rule, "חסום:" phrasing.
export function blockReason(page: ContentPage, pages: ContentPage[]): string | null {
  const blockers = publishedBlockers(page, pages)
  if (blockers.length === 0) return null
  const n = blockers.length
  return `חסום: ${n} ${n === 1 ? 'דף מפורסם או בארכיון תלוי' : 'דפים מפורסמים או בארכיון תלויים'} בדף זה`
}

function blockedMessage(blockers: ContentPage[], action: string): string {
  const n = blockers.length
  return `לא ניתן ${action}: ${n} ${n === 1 ? 'דף מפורסם או בארכיון תלוי' : 'דפים מפורסמים או בארכיון תלויים'} בדף זה. יש לבטל את פרסומם או לשייכם מחדש תחילה.`
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPages(): Promise<ContentPage[]> {
  await delay()
  maybeThrow()
  return hydratePages(readStorage(), readLinks(), readTopicLinks())
}

export async function getPage(id: string): Promise<ContentPage | null> {
  await delay()
  maybeThrow()
  const page = readStorage().find((p) => p.id === id)
  if (!page) return null
  return hydratePages([page], readLinks(), readTopicLinks())[0]
}

/**
 * Creates or updates a page.
 * If the payload contains linkedPageIds (any page type), they are written to the symmetric lateral
 * join table; for topics, childTopicIds are written to the topic-topic hierarchy table. Both derived
 * link fields are stripped from the stored page record (they live in the join tables, not on the page).
 * Never touches publishedSnapshot, lastPublishedAt, or status (for existing pages).
 */
export async function savePage(page: ContentPage): Promise<ContentPage> {
  await delay()
  maybeThrow()

  // Persist lateral links from the payload into the symmetric join table. Rewrite THIS page's edges:
  // drop every edge touching it, then re-add one per linked id. Because the editor loads the full
  // hydrated linkedPageIds, this preserves links made from the other end unless explicitly removed
  // here (symmetric unlink). Self-links are dropped.
  const links = readLinks()
  if (page.linkedPageIds !== undefined) {
    const without = links.filter((l) => l.aId !== page.id && l.bId !== page.id)
    const added = [...new Set(page.linkedPageIds)]
      .filter((pid) => pid !== page.id)
      .map((pid) => ({ aId: page.id, bId: pid }))
    writeLinksStorage([...without, ...added])
  }

  // Persist child-topic edges (hierarchy). Rebuild this topic's child set from the payload: drop its
  // existing parent-edges, then add one per child — rejecting any that would create a cycle (primary
  // write-time guard) and enforcing single-parent by dropping a child's prior parent edge (reparent).
  if (page.type === 'topic' && page.childTopicIds !== undefined) {
    let next = readTopicLinks().filter((l) => l.parentId !== page.id)
    for (const childId of page.childTopicIds) {
      if (childId === page.id) continue
      if (wouldCreateCycle(next, page.id, childId)) {
        throw new Error(`לא ניתן לשייך דף נושא בן: הקישור ייצור מעגל בהיררכיה`)
      }
      next = next.filter((l) => l.childId !== childId)   // single parent → reparent if needed
      next.push({ parentId: page.id, childId })
    }
    writeTopicLinks(next)
  }

  const stored = stripLinks(page)
  const pages = readStorage()
  const idx = pages.findIndex((p) => p.id === page.id)

  if (idx >= 0) {
    const existing = pages[idx]
    pages[idx] = {
      ...stored,
      status: existing.status,
      publishedSnapshot: existing.publishedSnapshot,
      lastPublishedAt: existing.lastPublishedAt,
    } as ContentPage
  } else {
    pages.unshift(stored)
  }

  writeStorage(pages)
  const saved = pages[idx >= 0 ? idx : 0]
  return hydratePages([saved], readLinks(), readTopicLinks())[0]
}

/**
 * Freezes the current title + content into publishedSnapshot, then sets status to published.
 * Call savePage() first to flush any unsaved editor state before calling this.
 *
 * ACCEPTED SECOND UNARCHIVE PATH — this function does not check the page's prior status, so calling
 * it on an ARCHIVED page also un-archives it, as a side effect of "publish always sets status to
 * published." This is deliberately left as-is rather than special-cased: it is a DIFFERENT action from
 * unarchivePage below — publishPage re-freezes a NEW snapshot from whatever content is current (e.g.
 * edits made while archived), whereas unarchivePage restores the EXACT prior published content with no
 * re-freeze. Both are legitimate; an analyst who edits an archived page and hits "פרסום" in the editor
 * gets this path, an analyst who just wants the old version back gets the list's "הוצא מארכיון". Do
 * not add status-gating here to "fix" this into a single path — it isn't a bug.
 */
export async function publishPage(id: string): Promise<ContentPage> {
  await delay()
  maybeThrow()
  const pages = readStorage()
  const [, idx] = requirePage(pages, id)
  const page = pages[idx]
  const now = new Date().toISOString()

  // Decision 2 — no parent-published requirement for topics. A child topic can be published while its
  // parent is still a draft. This is a DELIBERATE divergence from the event rule (an event requires a
  // published linked topic to publish): a strict bottom-up-blocked order would stop an analyst from
  // publishing a finished operation-level page while the broader campaign framing is still in
  // progress. Intentional product decision — do not "fix" this into consistency without that context.
  pages[idx] = {
    ...page,
    status: 'published',
    lastPublishedAt: now,
    updatedAt: now,
    publishedSnapshot: {
      title: page.title,
      content: page.content ?? {},
    },
  } as ContentPage

  writeStorage(pages)
  return hydratePages([pages[idx]], readLinks(), readTopicLinks())[0]
}

/**
 * Sets status back to draft. Keeps both content and publishedSnapshot intact.
 * Blocked if this topic has any published descendant (see publishedBlockers).
 */
export async function unpublishPage(id: string): Promise<ContentPage> {
  await delay()
  maybeThrow()
  const links = readLinks()
  const topicLinks = readTopicLinks()
  const pages = readStorage()
  const [, idx] = requirePage(pages, id)
  const hydrated = hydratePages(pages, links, topicLinks)
  const target = hydrated.find((p) => p.id === id)!
  const blockers = publishedBlockers(target, hydrated)
  if (blockers.length > 0) throw new Error(blockedMessage(blockers, 'לבטל פרסום'))
  pages[idx] = { ...pages[idx], status: 'draft', updatedAt: new Date().toISOString() }
  writeStorage(pages)
  return hydratePages([pages[idx]], links, topicLinks)[0]
}

/**
 * Sets status to archived. Content and publishedSnapshot are untouched — archive is a pure visibility
 * flip, reversible via unarchivePage back to the exact same published content.
 * NEVER blocked by publishedBlockers: archiving has zero cascading effect on parents, children, or
 * linked pages — an analyst can archive a page regardless of the status of anything connected to it.
 * (Contrast unpublishPage above, which IS blocked — going published→draft removes a page from the
 * blocking set entirely, whereas archived still counts identically to published for that purpose.)
 * Only reachable from 'published'.
 */
export async function archivePage(id: string): Promise<ContentPage> {
  await delay()
  maybeThrow()
  const pages = readStorage()
  const [, idx] = requirePage(pages, id)
  if (pages[idx].status !== 'published') {
    throw new Error(`דף ${id} אינו מפורסם — ניתן להעביר לארכיון רק דף מפורסם`)
  }
  pages[idx] = { ...pages[idx], status: 'archived', updatedAt: new Date().toISOString() }
  writeStorage(pages)
  return hydratePages([pages[idx]], readLinks(), readTopicLinks())[0]
}

/**
 * Sets status back to published. Content and publishedSnapshot are untouched — restores exactly the
 * page that was archived, with no re-freeze (contrast publishPage's JSDoc above, which re-freezes).
 * Never blocked, for the same reason archivePage isn't (see above).
 * Only reachable from 'archived'.
 */
export async function unarchivePage(id: string): Promise<ContentPage> {
  await delay()
  maybeThrow()
  const pages = readStorage()
  const [, idx] = requirePage(pages, id)
  if (pages[idx].status !== 'archived') {
    throw new Error(`דף ${id} אינו בארכיון`)
  }
  pages[idx] = { ...pages[idx], status: 'published', updatedAt: new Date().toISOString() }
  writeStorage(pages)
  return hydratePages([pages[idx]], readLinks(), readTopicLinks())[0]
}

/**
 * Copies publishedSnapshot title + content back into the working copy.
 * Status and snapshot are unchanged. Only valid when a publishedSnapshot exists.
 */
export async function restorePage(id: string): Promise<ContentPage> {
  await delay()
  maybeThrow()
  const pages = readStorage()
  const [, idx] = requirePage(pages, id)
  const page = pages[idx]

  if (!page.publishedSnapshot) {
    throw new Error(`דף ${id} אין לו גרסה מפורסמת לשחזור`)
  }

  pages[idx] = {
    ...page,
    title: page.publishedSnapshot.title,
    content: page.publishedSnapshot.content as ContentPage['content'],
    updatedAt: new Date().toISOString(),
  } as ContentPage

  writeStorage(pages)
  return hydratePages([pages[idx]], readLinks(), readTopicLinks())[0]
}

export async function deletePage(id: string): Promise<void> {
  await delay()
  maybeThrow()
  const links = readLinks()
  const topicLinks = readTopicLinks()
  const pages = readStorage()
  requirePage(pages, id) // validate existence (throws if missing)
  const hydrated = hydratePages(pages, links, topicLinks)
  const target = hydrated.find((p) => p.id === id)!
  const blockers = publishedBlockers(target, hydrated)
  if (blockers.length > 0) throw new Error(blockedMessage(blockers, 'למחוק'))

  // Clean up the page's edges from BOTH join tables (event links + topic hierarchy). Detaching a
  // deleted parent's children leaves them as roots — allowed, since delete is only reachable once no
  // published descendant remains (drafts may still hang off it and simply become top-level).
  writeTopicLinks(topicLinks.filter((l) => l.parentId !== id && l.childId !== id))
  writeLinksStorage(links.filter((l) => l.aId !== id && l.bId !== id))

  writeStorage(pages.filter((p) => p.id !== id))
}
