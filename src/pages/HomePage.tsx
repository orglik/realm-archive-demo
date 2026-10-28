import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { getPages } from '@/services/pageService'
import type { TopicPage, EventPage, ReferencePage } from '@/types/contentPage'
import { byIdMap, displayOf, publishedOnly } from '@/utils/homeIndex'
import { HomeAllTab, HomeTopicsTab, HomeEventsTab, HomeReferencesTab } from '@/components/home/HomeTabBodies'
import { PRODUCT_NAME } from '@/lib/brand'

// דף הבית — the reader-facing, generated index. Published only, no exceptions: the base
// filter (publishedOnly) is applied once, here, before anything downstream ever sees a page — drafts
// and archived pages never reach any tab, count, or search result on this page.

type Tab = 'all' | 'topic' | 'event' | 'reference'

function isTab(v: string | null): v is Tab {
  return v === 'all' || v === 'topic' || v === 'event' || v === 'reference'
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawType = searchParams.get('type')
  const tab: Tab = isTab(rawType) ? rawType : 'all'
  const search = searchParams.get('q') ?? ''

  const fetchPages = useCallback(() => getPages(), [])
  const { status, data: pages, error, reload } = useAsync(fetchPages)

  const { topics, events, references, byId, total } = useMemo(() => {
    const all = publishedOnly(pages ?? [])
    return {
      topics: all.filter((p): p is TopicPage => p.type === 'topic'),
      events: all.filter((p): p is EventPage => p.type === 'event'),
      references: all.filter((p): p is ReferencePage => p.type === 'reference'),
      byId: byIdMap(all),
      total: all.length,
    }
  }, [pages])

  function setTab(next: Tab) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === 'all') p.delete('type')
      else p.set('type', next)
      p.delete('q')
      return p
    })
  }

  function setSearch(q: string) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (q) p.set('q', q)
      else p.delete('q')
      return p
    })
  }

  const q = search.trim()
  const searchedTopics = q ? topics.filter((t) => displayOf(t).title.includes(q)) : topics
  const searchedEvents = q ? events.filter((e) => displayOf(e).title.includes(q)) : events
  const searchedReferences = q ? references.filter((r) => displayOf(r).title.includes(q)) : references

  const searchPlaceholder = {
    all: 'חיפוש בכל הדפים…',
    topic: 'חיפוש בדפי נושא…',
    event: 'חיפוש בדפי אירוע…',
    reference: 'חיפוש בדפי עיון…',
  }[tab]

  return (
    <div className="min-h-screen" style={{ background: 'var(--lp-ribbon-bg)' }} dir="rtl">
      {/* Dark nav — reuses the existing white-on-dark logo asset already used on every other dark
          header in the app (App.tsx, PageViewerPage.tsx); no new asset needed. */}
      <header className="h-14 flex items-center" style={{ background: 'var(--lp-ink)' }}>
        <div className="max-w-[1280px] mx-auto px-5 sm:px-7 w-full flex items-center gap-3 sm:gap-4.5">
          <span className="font-heebo text-sm text-white/90">{PRODUCT_NAME}</span>
          <Link
            to="/home"
            className="ms-auto font-heebo text-[13px] text-white pb-1 border-b-2"
            style={{ borderColor: 'var(--lp-tab-underline)' }}
          >
            עמוד הבית
          </Link>
        </div>
      </header>

      <div className="border-b" style={{ background: 'var(--card)', borderColor: 'var(--lp-hairline)' }}>
        <div className="max-w-[1280px] mx-auto px-5 sm:px-11 pt-7">
          {/* Stacks under the title on phones; the search box only becomes a fixed 320px column
              once there is room for it beside the heading. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
            <div className="min-w-0">
              <h1 className="font-heebo text-2xl sm:text-3xl font-bold" style={{ color: 'var(--lp-ink)' }}>דפי תוכן</h1>
              <p className="mt-1.5 font-heebo text-[13.5px]" style={{ color: 'var(--lp-label)' }}>
                כל התוכן המפורסם · {total} דפים
              </p>
            </div>
            <div className="relative w-full min-w-0 sm:ms-auto sm:w-80 sm:shrink-0">
              <Search className="absolute end-4 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: 'var(--lp-faint)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border pe-10 ps-4 py-2.5 font-heebo text-sm text-right outline-none"
                style={{ borderColor: 'var(--lp-hairline)', background: 'var(--card)' }}
              />
            </div>
          </div>

          <nav className="mt-6 flex gap-5 sm:gap-7 font-heebo text-[14.5px] overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['all', 'הכול', total],
              ['topic', 'דפי נושא', topics.length],
              ['event', 'דפי אירוע', events.length],
              ['reference', 'דפי עיון', references.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="pb-2.5 border-b-2 -mb-px transition-colors"
                style={{
                  borderColor: tab === key ? 'var(--lp-tab-underline)' : 'transparent',
                  color: tab === key ? 'var(--lp-ink)' : 'var(--lp-faint)',
                  fontWeight: tab === key ? 700 : 400,
                }}
              >
                {label} <span className="text-[12.5px]" style={{ color: 'var(--lp-label)' }}>{count}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-5 sm:px-11 py-8">
        {status === 'loading' && (
          <div className="py-24 flex items-center justify-center gap-2.5" style={{ color: 'var(--lp-label)' }}>
            <Loader2 className="size-5 animate-spin" />
            <span className="font-heebo text-sm">טוען דפים...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="py-24 flex flex-col items-center gap-3">
            <p className="font-heebo text-sm text-red-600">{error}</p>
            <button type="button" onClick={reload} className="font-heebo text-sm underline" style={{ color: 'var(--lp-accent)' }}>
              נסה שוב
            </button>
          </div>
        )}

        {status === 'success' && tab === 'all' && (
          <HomeAllTab topics={searchedTopics} events={searchedEvents} references={searchedReferences} byId={byId} onSelectTab={setTab} />
        )}
        {status === 'success' && tab === 'topic' && <HomeTopicsTab topics={searchedTopics} events={events} byId={byId} />}
        {status === 'success' && tab === 'event' && <HomeEventsTab events={searchedEvents} byId={byId} />}
        {status === 'success' && tab === 'reference' && <HomeReferencesTab references={searchedReferences} byId={byId} />}
      </main>
    </div>
  )
}
