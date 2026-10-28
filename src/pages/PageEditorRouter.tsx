import { useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { getPage } from '@/services/pageService'
import type { ContentPage } from '@/types/contentPage'
import { TopicEditor } from './TopicEditor'
import { EventEditor } from './EventEditor'
import { ReferenceEditor } from './ReferenceEditor'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Renders an editor for a page that already exists in the service
function ExistingPageEditor({ id }: { id: string }) {
  const fetch = useCallback(() => getPage(id), [id])
  const { status, data: page, error, reload } = useAsync(fetch, [id])

  if (status === 'loading') {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">טוען דף...</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={reload}>נסה שוב</Button>
      </div>
    )
  }

  if (!page) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">דף לא נמצא</p>
      </div>
    )
  }

  if (page.type === 'topic') return <TopicEditor page={page} onSaved={reload} />
  if (page.type === 'event') return <EventEditor page={page} onSaved={reload} />
  return <ReferenceEditor page={page} onSaved={reload} />
}

export function PageEditorRouter() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()

  // New unsaved page passed via navigation state — skip the service fetch entirely.
  // The page will be persisted to the service only when the analyst clicks "Save Draft".
  const newPage = (location.state as { newPage?: ContentPage } | null)?.newPage

  if (newPage) {
    if (newPage.type === 'topic') return <TopicEditor page={newPage} />
    if (newPage.type === 'event') return <EventEditor page={newPage} />
    return <ReferenceEditor page={newPage} />
  }

  return <ExistingPageEditor id={id!} />
}
