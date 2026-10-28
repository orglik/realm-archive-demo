import { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { getPage } from '@/services/pageService'
import { PageViewer } from '@/components/PageViewer'
import { ViewerNotice } from '@/components/ViewerNotice'
import { PageLinkContext, readerHref } from '@/components/viewerLinks'
import { Loader2 } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'

// READER-facing viewer (/read/:id). The public entry point, reached from /home.
//
// This is a separate wrapper from PageViewerPage rather than a mode of it, so the analyst controls
// (edit / management list) are STRUCTURALLY absent — this file never imports them, so no future
// conditional can accidentally expose them here. Both wrappers render the same chrome-free
// PageViewer; only the surrounding chrome and the guards differ.

/**
 * One collapsed state for every case a reader must not see: draft, archived, missing, or a
 * published page with no snapshot.
 *
 * Deliberately identical in all four cases. Distinct messages would tell an anonymous visitor
 * whether a given id exists as a draft, was archived, or was never real — an enumeration signal
 * with no benefit to a reader. The page id is not echoed either.
 */
function Unavailable() {
  return (
    <ViewerNotice title="הדף אינו זמין">
      <Link
        to="/home"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5
          text-sm font-heebo text-foreground hover:bg-muted/50 transition-colors"
      >
        ← חזרה לדף הבית
      </Link>
    </ViewerNotice>
  )
}

export function ReadPage() {
  const { id } = useParams<{ id: string }>()
  const fetch = useCallback(() => getPage(id!), [id])
  const { status, data: page } = useAsync(fetch, [id])

  if (status === 'loading') {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#FAFCFE] flex items-center justify-center gap-3 text-muted-foreground"
      >
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm font-heebo">טוען דף...</span>
      </div>
    )
  }

  // PUBLISHED-ONLY GATE. The analyst route deliberately renders drafts (that is its preview
  // affordance); this one must not, or an unpublished page would be readable by URL. Archived,
  // missing, and the published-without-snapshot data error all fall through to the same state —
  // including the error case, since a reader can do nothing with a data error and naming it would
  // confirm the id exists.
  if (status === 'error' || !page || page.status !== 'published' || !page.publishedSnapshot) {
    return <Unavailable />
  }

  const displayPage = {
    ...page,
    title: page.publishedSnapshot.title,
    content: page.publishedSnapshot.content,
  } as typeof page

  return (
    <div className="min-h-screen bg-[#FAFCFE]">
      {/* Reader chrome — same 48px dark bar as the analyst viewer, but carrying exactly one
          control. No edit, no list, no publish/archive: this wrapper does not import them. */}
      <header className="sticky top-0 z-20 bg-[#03051B] h-12 flex items-center" dir="rtl">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-white/90 font-heebo">{PRODUCT_NAME}</span>
          </div>
          <Link
            to="/home"
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-md px-2.5 h-8
              inline-flex items-center font-heebo text-sm transition-colors"
          >
            ← חזרה לדף הבית
          </Link>
        </div>
      </header>

      {/* Every page link rendered inside the viewer (breadcrumbs, ribbon) stays on /read/:id. */}
      <PageLinkContext.Provider value={readerHref}>
        <PageViewer page={displayPage} />
      </PageLinkContext.Provider>
    </div>
  )
}
