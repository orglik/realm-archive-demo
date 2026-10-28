import { useCallback } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import { LinkPicker } from '@/components/editor/LinkPicker'
import { ancestorsOf, descendantsOf, parentOf } from '@/utils/topicHierarchy'
import type { ContentPage } from '@/types/contentPage'
import type { TopicTopicLink } from '@/data/mockTopicLinks'

type Props = {
  topicId: string
  linkedIds: string[]
  onChange: (ids: string[]) => void
  bare?: boolean
}

// Child-topic picker. Reuses LinkPicker but adds hierarchy awareness: cycle-unsafe topics (self, its
// ancestors, and its descendants) are excluded from candidates, and a topic already parented
// elsewhere shows a "currently under X" note (selecting it reparents — single-parent, K1 decision).
export function ChildTopicsSection({ topicId, linkedIds, onChange, bare }: Props) {
  const fetch = useCallback(() => getPages(), [])
  const { data: pages } = useAsync(fetch)

  // Reconstruct the topic-topic edge set from the hydrated pages' derived childTopicIds.
  const edges: TopicTopicLink[] = (pages ?? []).flatMap((p) =>
    p.type === 'topic' ? (p.childTopicIds ?? []).map((childId) => ({ parentId: p.id, childId })) : []
  )

  const exclude = [topicId, ...ancestorsOf(edges, topicId), ...descendantsOf(edges, topicId)]

  const titleOf = (id: string) => pages?.find((p) => p.id === id)?.title ?? id
  const noteFor = (p: ContentPage): string | null => {
    const par = parentOf(edges, p.id)
    return par && par !== topicId && !linkedIds.includes(p.id) ? `משויך כעת ל: ${titleOf(par)}` : null
  }

  return (
    <LinkPicker
      targetType="topic"
      title="קישור דפי נושא"
      guidance="שייך דפי נושא הכפופים לנושא זה בהיררכיה. העומק אינו מוגבל; דפי אירוע הם עלים בלבד ואינם יכולים להכיל בנים."
      linkedIds={linkedIds}
      onChange={onChange}
      excludeIds={exclude}
      noteFor={noteFor}
      bare={bare}
    />
  )
}
