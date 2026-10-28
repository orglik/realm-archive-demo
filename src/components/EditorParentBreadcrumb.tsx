import { useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import { Layers, ChevronLeft } from 'lucide-react'
import { MAX_TOPIC_DEPTH } from '@/utils/topicHierarchy'
import type { TopicPage } from '@/types/contentPage'

// Read-only parent/ancestor indicator for the topic editor — orientation only. The parent link is
// owned by the PARENT's child-topics picker (single source of truth), so here it is shown, not edited.
// Renders nothing for a root topic. Walk is depth-capped + visited-guarded like the viewer breadcrumb.
//
// DELIBERATE DIVERGENCE from the reader-facing breadcrumb (pageHierarchy.ts's ancestorChain): that one
// stops the walk at an archived ancestor and hides it entirely ("no trace", per decision 4 — archive
// is only about hiding pages from READERS). This component is analyst-facing, not reader-facing — an
// editor working on a page benefits from knowing its true structural parent even if that parent is
// currently archived, so this walk intentionally does NOT exclude archived nodes, and instead tags
// them "(בארכיון)" so the analyst isn't misled into thinking the parent is still live. Do not "fix"
// this into consistency with ancestorChain — the two components serve different audiences on purpose.
export function EditorParentBreadcrumb({ topicId }: { topicId: string }) {
  const fetch = useCallback(() => getPages(), [])
  const { data: pages } = useAsync(fetch)
  if (!pages) return null

  const byId = new Map(pages.map((p) => [p.id, p]))
  const self = byId.get(topicId)
  const chain: TopicPage[] = []
  const seen = new Set<string>([topicId])
  let cur = self && self.type === 'topic' ? self.parentTopicId : undefined
  let depth = 0
  while (cur && depth < MAX_TOPIC_DEPTH && !seen.has(cur)) {
    const t = byId.get(cur)
    if (!t || t.type !== 'topic') break
    chain.unshift(t)
    seen.add(cur)
    cur = t.parentTopicId
    depth++
  }
  if (chain.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-xl border border-[#C8E8F5] bg-[#F0FBFF] px-4 py-2.5 text-sm font-heebo"
      aria-label="דף אב"
    >
      <Layers className="size-4 text-primary shrink-0" />
      <span className="text-[11px] font-bold text-primary uppercase tracking-wide">היררכיה</span>
      <span className="text-muted-foreground/50">·</span>
      <span className="text-muted-foreground">תחת:</span>
      {chain.map((t, i) => (
        <span key={t.id} className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">
            {t.title}
            {t.status === 'archived' && <span className="text-muted-foreground/60 font-normal"> (בארכיון)</span>}
          </span>
          {i < chain.length - 1 && <ChevronLeft className="size-3.5 text-muted-foreground/50" />}
        </span>
      ))}
      <span className="text-[11px] text-muted-foreground/70">(לקריאה בלבד · נקבע מדף האב)</span>
    </div>
  )
}
