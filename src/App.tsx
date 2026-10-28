import { createHashRouter, RouterProvider, Link } from 'react-router-dom'
import { ContentTable } from '@/components/ContentTable'
import { PageEditorRouter } from '@/pages/PageEditorRouter'
import { PageViewerPage } from '@/pages/PageViewerPage'
import { ReadPage } from '@/pages/ReadPage'
import { HomePage } from '@/pages/HomePage'
import { PRODUCT_NAME } from '@/lib/brand'
import { DemoBanner } from '@/components/DemoBanner'

function AppHeader() {
  return (
    <header className="bg-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between" dir="rtl">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-white/90 font-heebo tracking-wide">{PRODUCT_NAME} · ניהול תוכן</p>
        </div>
        {/* Cross-link to the reader-facing index — mirrors PageViewerPage's existing עריכה/רשימה
            pattern for moving between the analyst tool and the reader-facing surfaces.
            Opens in a NEW TAB on purpose. /home is deliberately reader-pure — it carries no link
            back to the management list, because a public reader must never be offered one. Sending
            the analyst there in the same tab would strand them; a new tab keeps their workspace
            untouched and makes closing it the way back. This also keeps /home free of any
            "did an analyst arrive here?" conditional, so its reader-purity holds by construction
            rather than by a check that could regress. */}
        <Link
          to="/home"
          target="_blank"
          rel="noopener"
          className="text-xs text-white/70 hover:text-white transition-colors font-heebo"
        >
          תצוגת קוראים ←
        </Link>
      </div>
    </header>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ContentTable />
        </main>
      </div>
    ),
  },
  {
    path: '/home',
    element: <HomePage />,
  },
  {
    path: '/page/:id/edit',
    element: <PageEditorRouter />,
  },
  {
    // ANALYST viewer: edit/list/reader-view controls, renders drafts for preview.
    path: '/page/:id/view',
    element: <PageViewerPage />,
  },
  {
    // READER viewer: public chrome, one way back to /home, published-only.
    // Separate route (not a mode of the one above) so the analyst controls are structurally
    // unreachable here rather than conditionally hidden.
    path: '/read/:id',
    element: <ReadPage />,
  },
])

export default function App() {
  // DemoBanner sits ABOVE the router, not inside any route element. One insertion point means no
  // route — including loading and error branches, and any route added later — can render without it.
  return (
    <>
      <DemoBanner />
      <RouterProvider router={router} />
    </>
  )
}
