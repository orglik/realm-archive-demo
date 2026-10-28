// Topic→topic hierarchy edges (a topic's children). Parallel to the lateral link table, kept as a
// separate flat join table. Both directions (parent / children) are DERIVED from these edges in
// pageService.hydratePages — the edge is the single source of truth.
//
// Single-parent tree: each childId appears at most once, which keeps the ancestor chain unambiguous
// for breadcrumbs and makes the cycle check trivial.
export type TopicTopicLink = { parentId: string; childId: string }

export const mockTopicLinks: TopicTopicLink[] = [
  // t1 holds two arenas as children, so the tree shows a parent with more than one child.
  { parentId: 't1', childId: 't2' },
  { parentId: 't1', childId: 't3' },
  // An ARCHIVED child under a published parent — the management list still nests it (tagged),
  // while the reader-facing breadcrumb and ribbon exclude it entirely.
  { parentId: 't4', childId: 't7' },
  // A DRAFT child under a published parent. publishedChildCount() counts published children
  // only, so this adds a node to the editor tree WITHOUT changing any reader-facing count.
  { parentId: 't4', childId: 't6' },
]
