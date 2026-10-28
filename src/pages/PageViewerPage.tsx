import { useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { getPage } from '@/services/pageService'
import { PageViewer } from '@/components/PageViewer'
import { ViewerNotice } from '@/components/ViewerNotice'
import { PageLinkContext, analystHref } from '@/components/viewerLinks'
import { Button } from '@/components/ui/button'
import { ArrowRight, Pencil, Loader2, Archive } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'

export function PageViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const fetch = useCallback(() => getPage(id!), [id])
  const { status, data: page, error, reload } = useAsync(fetch, [id])

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

  if (status === 'error') {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#FAFCFE] flex flex-col items-center justify-center gap-3"
      >
        <p className="text-sm text-red-600 font-heebo">{error}</p>
        <Button variant="outline" size="sm" onClick={reload} className="font-heebo">
          נסה שוב
        </Button>
      </div>
    )
  }

  if (!page) {
    return <ViewerNotice title="דף לא נמצא" />
  }

  // Decision 6 — direct navigation to an archived page's URL shows an explicit blocked state, not the
  // normal content view and not a 404. Checked before the snapshot-integrity guard below so an
  // archived page (which DOES have a valid publishedSnapshot) still shows the archive notice, not the
  // real content. No unarchive action here on purpose — that action lives ONLY in ContentTable's
  // ⋯ menu (single source of truth, matching how delete/unpublish/restore already work).
  if (page.status === 'archived') {
    return (
      <ViewerNotice
        icon={<Archive className="size-8 text-muted-foreground/50" />}
        title="דף זה הועבר לארכיון"
        body="הדף אינו מוצג עוד לקוראים. ניתן לשחזר אותו לפרסום מרשימת עמודי התוכן."
      >
        <Button variant="outline" size="sm" onClick={() => navigate(`/page/${page.id}/edit`)} className="font-heebo">
          עריכה
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/')} className="font-heebo">
          חזרה לרשימה
        </Button>
      </ViewerNotice>
    )
  }

  if (page.status === 'published' && !page.publishedSnapshot) {
    return (
      <ViewerNotice
        title="שגיאת נתונים: דף מפורסם ללא גרסה מפורסמת שמורה"
        body={`ID: ${page.id}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('/')} className="font-heebo">
          חזרה לרשימה
        </Button>
      </ViewerNotice>
    )
  }

  const displayPage = page.publishedSnapshot
    ? { ...page, title: page.publishedSnapshot.title, content: page.publishedSnapshot.content }
    : page

  return (
    <div className="min-h-screen bg-[#FAFCFE]">
      {/* Platform chrome — 48px dark bar */}
      <header className="sticky top-0 z-20 bg-[#03051B] h-12 flex items-center" dir="rtl">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 w-full flex items-center justify-between gap-2">
          {/* min-w-0 + truncate: at 320px the product name must yield width to the actions,
              which were running past the edge because this column refused to shrink. */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-semibold text-white/90 font-heebo truncate">{PRODUCT_NAME}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/page/${page.id}/edit`)}
              className="text-white/70 hover:text-white hover:bg-white/10 font-heebo text-sm gap-1.5 h-8"
            >
              <Pencil className="size-3.5" />
              עריכה
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-white/70 hover:text-white hover:bg-white/10 font-heebo text-sm gap-1.5 h-8"
            >
              <ArrowRight className="size-3.5" />
              רשימה
            </Button>
            {/* Third destination, closing the loop list <-> editor <-> viewer <-> /home. Label and
                arrow copied from AppHeader's cross-link so the two read as the same affordance.
                Goes to the index, not this page's reader view: "see the reader's world".
                New tab, for the same reason as AppHeader's copy of this link — see the note there. */}
            <Link
              to="/home"
              target="_blank"
              rel="noopener"
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-md px-2.5 h-8
                inline-flex items-center font-heebo text-sm transition-colors"
            >
              תצוגת קוראים ←
            </Link>
          </div>
        </div>
      </header>

      {/* Analyst context: breadcrumbs and ribbon links stay on /page/:id/view. */}
      <PageLinkContext.Provider value={analystHref}>
        <PageViewer page={displayPage as typeof page} />
      </PageLinkContext.Provider>
    </div>
  )
}
