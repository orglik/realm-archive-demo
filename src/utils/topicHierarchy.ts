import type { TopicTopicLink } from '@/data/mockTopicLinks'

// Depth cap is the render/traversal BACKSTOP against cycles in data that never went through the
// write-time guard (imported/legacy/corrupted). Every walk here is also visited-guarded, so even a
// malformed multi-parent loop terminates. Write-time rejection (wouldCreateCycle) is the primary
// guard; this cap ensures the UI can never recurse forever regardless of data.
export const MAX_TOPIC_DEPTH = 10

/** The single parent of a topic under the single-parent model (undefined for a root). */
export function parentOf(links: TopicTopicLink[], id: string): string | undefined {
  return links.find((l) => l.childId === id)?.parentId
}

/** Direct children of a topic. */
export function childrenOf(links: TopicTopicLink[], id: string): string[] {
  return links.filter((l) => l.parentId === id).map((l) => l.childId)
}

/** Ancestor ids from nearest parent up to the root, depth-capped and visited-guarded. */
export function ancestorsOf(links: TopicTopicLink[], id: string): string[] {
  const out: string[] = []
  const seen = new Set<string>([id])
  let cur = parentOf(links, id)
  let depth = 0
  while (cur !== undefined && depth < MAX_TOPIC_DEPTH && !seen.has(cur)) {
    out.push(cur)
    seen.add(cur)
    cur = parentOf(links, cur)
    depth++
  }
  return out
}

/** All descendant ids (any depth), depth-capped and visited-guarded. */
export function descendantsOf(links: TopicTopicLink[], id: string): string[] {
  const out: string[] = []
  const seen = new Set<string>([id])
  const walk = (node: string, depth: number) => {
    if (depth >= MAX_TOPIC_DEPTH) return
    for (const child of childrenOf(links, node)) {
      if (seen.has(child)) continue
      seen.add(child)
      out.push(child)
      walk(child, depth + 1)
    }
  }
  walk(id, 0)
  return out
}

/**
 * Would attaching `childId` under `parentId` create a cycle? True if they are the same node, or if
 * `childId` is already an ancestor of `parentId` (attaching would close a loop). Primary write-time
 * guard, also used to filter the editor picker so an unsafe target can't even be selected.
 */
export function wouldCreateCycle(links: TopicTopicLink[], parentId: string, childId: string): boolean {
  if (parentId === childId) return true
  return ancestorsOf(links, parentId).includes(childId)
}
