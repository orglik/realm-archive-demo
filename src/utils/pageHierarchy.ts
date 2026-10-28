import type { ContentPage, TopicPage } from '@/types/contentPage'
import { MAX_TOPIC_DEPTH } from './topicHierarchy'

// Ancestor resolution over HYDRATED pages (a byId map from getPages, carrying parentTopicId /
// linkedTopicIds). Shared by the linked-pages ribbon anchor AND the top breadcrumb so the two never
// disagree about where a page sits. Every walk is depth-capped + visited-guarded so malformed data
// can't loop.

/** Depth of a topic in the tree (0 for a root), measured by walking parentTopicId up. */
function topicDepth(id: string, byId: Map<string, ContentPage>): number {
  let depth = 0
  const seen = new Set<string>([id])
  let cur = byId.get(id)
  let parent = cur && cur.type === 'topic' ? cur.parentTopicId : undefined
  while (parent && depth < MAX_TOPIC_DEPTH && !seen.has(parent)) {
    const p = byId.get(parent)
    // Archived ancestors don't count toward depth — they're excluded from the reader-facing chain
    // entirely (see ancestorChain below), so they must not influence which candidate anchor "wins".
    if (!p || p.type !== 'topic' || p.status === 'archived') break
    seen.add(parent)
    depth++
    parent = p.parentTopicId
  }
  return depth
}

/**
 * The id of the page's direct parent topic:
 * - topic → its parentTopicId (single-parent tree)
 * - event → the linked topic with the DEEPEST ancestry (most specific placement). A multi-topic event
 *   thus anchors under its most specific topic and shows the richest chain, rather than an arbitrary
 *   first link. Undefined when there is no parent.
 */
export function primaryParentId(page: ContentPage, byId: Map<string, ContentPage>): string | undefined {
  if (page.type === 'topic') return page.parentTopicId
  // Reference pages are NOT in the hierarchy — no anchor parent (their topic links show in the rail).
  if (page.type !== 'event') return undefined
  // Archived topics are excluded from candidacy — an event must never anchor its breadcrumb/ribbon
  // parent under a topic that readers can't see (decision 4: archived = hidden, no trace).
  const linked = (page.linkedPageIds ?? []).filter((id) => {
    const t = byId.get(id)
    return t?.type === 'topic' && t.status !== 'archived'
  })
  if (linked.length === 0) return undefined
  let best = linked[0]
  let bestDepth = topicDepth(best, byId)
  for (const id of linked.slice(1)) {
    const d = topicDepth(id, byId)
    if (d > bestDepth) { best = id; bestDepth = d }
  }
  return best
}

/**
 * Ancestor topic chain from ROOT → … → direct parent (excludes the page itself). Empty for a root
 * topic (or an event with no linked topic). Draft ancestors are included so the chain stays complete.
 */
export function ancestorChain(page: ContentPage, byId: Map<string, ContentPage>): TopicPage[] {
  const chain: TopicPage[] = []
  const seen = new Set<string>([page.id])
  let cur = primaryParentId(page, byId)
  let depth = 0
  while (cur && depth < MAX_TOPIC_DEPTH && !seen.has(cur)) {
    const t = byId.get(cur)
    // Archived ancestors STOP the walk rather than being skipped over — decision 4 wants them hidden
    // "no trace", and skipping through to the next visible grandparent would stitch together a
    // breadcrumb link that misrepresents the real structure (e.g. showing A as C's direct ancestor
    // when the real chain is A→B→C with B hidden). Reuses the same break-the-loop style already used
    // for an unknown/malformed node just above.
    if (!t || t.type !== 'topic' || t.status === 'archived') break
    chain.unshift(t)
    seen.add(cur)
    cur = t.parentTopicId
    depth++
  }
  return chain
}
