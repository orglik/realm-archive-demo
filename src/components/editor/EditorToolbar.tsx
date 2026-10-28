import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ChevronRight, Loader2, Archive } from 'lucide-react'

type Props = {
  pageType: 'topic' | 'event' | 'reference'
  title: string
  // An archived page is still openable in its editor (e.g. via the archived-notice screen's "עריכה"
  // button), so the toolbar needs to represent all three statuses, not just draft/published.
  status: 'draft' | 'published' | 'archived'
  onSaveDraft: () => void
  saveStatus: 'idle' | 'saving'
  onPublish: () => void
  publishStatus: 'idle' | 'saving'
  publishReady: boolean
  onPreview?: () => void
  hasPendingChanges?: boolean
  gate?: { done: number; total: number; missing: string[] }
}

export function EditorToolbar({
  pageType, title, status,
  onSaveDraft, saveStatus,
  onPublish, publishStatus,
  publishReady,
  onPreview,
  hasPendingChanges,
  gate,
}: Props) {
  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">

        {/* Right side (first in DOM = rightmost in RTL): back + title + chips */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 font-heebo"
          >
            <span>ניהול עמודי תוכן</span>
            <ChevronRight className="size-4" />
          </Link>

          <div className="w-px h-4 bg-border shrink-0" />

          <span className="text-sm font-semibold text-foreground truncate font-heebo">
            {title || 'ללא כותרת'}
          </span>

          {status === 'published' ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#F0F8FF] text-[#21AEFF] border border-[#21AEFF]/20 shrink-0 font-heebo">
              <span className="size-1.5 rounded-full bg-[#21AEFF] shrink-0" />
              פורסם
            </span>
          ) : status === 'archived' ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border shrink-0 font-heebo">
              <Archive className="size-3" />
              בארכיון
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-muted-foreground border border-border shrink-0 font-heebo">
              <span className="size-1.5 rounded-full border border-current shrink-0 opacity-60" />
              טיוטה
            </span>
          )}

          <span className="hidden md:inline text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0 font-heebo">
            {pageType === 'topic' ? 'דף נושא' : pageType === 'event' ? 'דף אירוע' : 'דף עיון'}
          </span>

          {(status === 'published' || status === 'archived') && hasPendingChanges && (
            <span className="hidden md:inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border border-dashed border-primary/40 text-primary/70 bg-primary/5 shrink-0 font-heebo">
              יש שינויים שלא פורסמו
            </span>
          )}
        </div>

        {/* Left side (last in DOM = leftmost in RTL): actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPreview}
            disabled={!onPreview}
            className="hidden sm:block text-sm text-[#458FFF] hover:text-[#21AEFF] transition-colors font-heebo disabled:opacity-40 disabled:cursor-not-allowed"
          >
            תצוגה מקדימה
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={saveStatus === 'saving'}
            className="font-heebo"
          >
            {saveStatus === 'saving'
              ? <Loader2 className="size-3.5 animate-spin" />
              : 'שמירת טיוטה'}
          </Button>

          <div className="relative group">
            <Button
              size="sm"
              onClick={onPublish}
              disabled={!publishReady || publishStatus === 'saving'}
              className="font-heebo"
              style={{ backgroundColor: publishReady ? '#21AEFF' : undefined }}
            >
              {publishStatus === 'saving'
                ? <Loader2 className="size-3.5 animate-spin" />
                : 'פרסום'}
            </Button>
            {!publishReady && gate && gate.missing.length > 0 && (
              // Anchored BELOW the button, not above: the toolbar is sticky top-0, so a bottom-full
              // tooltip rendered off the top of the viewport and showed only a clipped sliver.
              // On a phone the publish button sits close to the viewport edge, so a 192px box
              // centred on it (left-1/2 + -translate-x-1/2) hung ~51px off-screen and clipped the
              // one message that explains WHY publishing is blocked. Below sm it is anchored to the
              // button's inline-end instead and allowed to wrap; sm+ keeps the original centring.
              <div className="absolute top-full mt-2 end-0 lg:end-auto lg:left-1/2 lg:-translate-x-1/2 hidden group-hover:block
                bg-foreground text-white text-[11px] rounded-lg px-3 py-2 min-w-[12rem]
                max-w-[calc(100vw-2rem)] text-right
                leading-relaxed shadow-xl pointer-events-none z-50 whitespace-normal lg:whitespace-nowrap">
                חסרים: {gate.missing.join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
