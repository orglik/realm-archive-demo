// Unified LATERAL link table — a symmetric, type-agnostic edge between any two pages. The linked
// page's type is looked up from its id at hydration time. Kept separate from the topic-topic
// parent/child hierarchy (see mockTopicLinks). Edges are unordered pairs — hydratePages checks both
// columns — so aId/bId order carries no meaning.
export type PageLink = { aId: string; bId: string }

export const mockLinks: PageLink[] = [
  // t1 (the umbrella topic) ↔ its events
  { aId: 't1', bId: 'e1' },
  { aId: 't1', bId: 'e7' },

  // e1 is relevant to BOTH the umbrella topic and the northern march — a multi-topic event. In the
  // ribbon and breadcrumb it anchors under its most specific (deepest) topic, which is t2.
  { aId: 't2', bId: 'e1' },

  // t2 / t3 / t4 / t5 ↔ their events
  { aId: 't3', bId: 'e2' },
  { aId: 't2', bId: 'e3' },
  { aId: 't4', bId: 'e3' },
  { aId: 't5', bId: 'e4' },

  // e5 links ONLY to t6, which is a DRAFT topic. This is the publish-gate demo: every field on e5 is
  // filled, so the single remaining blocker is that no LINKED TOPIC IS PUBLISHED.
  { aId: 't6', bId: 'e5' },

  // e6 links only to an ARCHIVED topic (t7) — archived does not count as a published link either.
  { aId: 't7', bId: 'e6' },

  // Reference pages reach sideways into topics. r3 is deliberately absent here: with no topic link
  // it renders in the "unassigned references" group on the reader home.
  { aId: 'r1', bId: 't4' },
  { aId: 'r1', bId: 't5' },
  { aId: 'r2', bId: 't1' },
  { aId: 'r4', bId: 't1' },

  // Lateral topic↔topic reference (NOT hierarchy): two related arenas of the same period.
  { aId: 't2', bId: 't3' },
]
