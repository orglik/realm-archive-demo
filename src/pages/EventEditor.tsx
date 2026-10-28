import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import type {
  EventPage, Region, DeepeningItem, CaptionedImage,
  InfoGrid, HistorySection, CommanderHighlight, TimelineData, ContentPage,
} from '@/types/contentPage'
import { savePage, publishPage, getPages } from '@/services/pageService'
import { hasPublishedTopicLink } from '@/utils/publishValidation'
import { useAsync } from '@/hooks/useAsync'
import { CommanderWordField } from '@/components/CommanderWord'
import { DeepeningSection } from '@/components/DeepeningSection'
import { CaptionedImageSection } from '@/components/editor/CaptionedImageSection'
import { HeroImageField } from '@/components/editor/HeroImageField'
import { HistorySectionEditor } from '@/components/editor/HistorySectionEditor'
import { CommanderHighlightsEditor, initHighlights } from '@/components/editor/CommanderHighlightsEditor'
import { TimelineSection } from '@/components/editor/TimelineSection'
import { EventPageLinksSection } from '@/components/PageLinksSection'
import { EventInfoGrid } from '@/components/EventInfoGrid'
import { EditorSidebar } from '@/components/EditorSidebar'
import type { SidebarSection } from '@/components/EditorSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog'
import { PageViewer } from '@/components/PageViewer'
import { PageLinkContext, analystHref } from '@/components/viewerLinks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Pencil, Eye, Loader2 } from 'lucide-react'

const regions: Region[] = ['הצפון', 'הדרום', 'מעבר לים הצר', 'ארצות הסערה']

const EMPTY_INFO_GRID: InfoGrid = {
  commanderSummary: '', eventType: '', eventTypeDetail: '',
  sector: '', timeFrom: '', timeTo: '', forces: '', enemy: '',
}
const EMPTY_HISTORY: HistorySection = { teaser: '', fullContent: '' }
const EMPTY_TIMELINE: TimelineData = { enemyEvents: [], friendlyEvents: [] }

type EventSection =
  | 'hero' | 'infoGrid' | 'commanderWord' | 'deepening' | 'gallery'
  | 'historySection' | 'timeline' | 'map' | 'dashboards'
  | 'commanderHighlights' | 'topicLinks'

const SECTIONS: { id: EventSection; label: string; required?: true }[] = [
  { id: 'hero',                label: 'כותרת ומטא-דאטה',         required: true },
  { id: 'infoGrid',            label: 'פרטי האירוע',              required: true },
  { id: 'topicLinks',          label: 'קישור דפים',               required: true },
  { id: 'commanderWord',       label: 'דבר המלך' },
  { id: 'deepening',           label: 'העמקה' },
  { id: 'gallery',             label: 'גלריה' },
  { id: 'historySection',      label: 'סקירת המאסטרים' },
  { id: 'timeline',            label: 'ציר זמן' },
  { id: 'map',                 label: 'מפה' },
  { id: 'dashboards',          label: 'דשבורדים' },
  { id: 'commanderHighlights', label: 'נקודות' },
]

function fingerprintImages(imgs: CaptionedImage[]) {
  return imgs.map(({ id, name, caption }) => ({ id, name, caption }))
}

function makeInitialKey(page: EventPage): string {
  const c = page.content ?? {}
  return JSON.stringify({
    title: page.title,
    linkedPageIds: page.linkedPageIds ?? [],
    hero: {
      subtitle: c.hero?.subtitle ?? '',
      date: c.hero?.date ?? '',
      region: c.hero?.region ?? '',
      heroImage: fingerprintImages(c.hero?.heroImage ? [c.hero.heroImage] : []),
    },
    infoGrid: c.infoGrid ?? EMPTY_INFO_GRID,
    commanderWord: c.commanderWord ?? '',
    deepening: c.deepening ?? [],
    gallery: fingerprintImages(c.gallery ?? []),
    map: fingerprintImages(c.map ?? []),
    dashboards: fingerprintImages(c.dashboards ?? []),
    historySection: c.historySection ?? EMPTY_HISTORY,
    commanderHighlights: c.commanderHighlights ?? initHighlights(),
    timeline: c.timeline ?? EMPTY_TIMELINE,
  })
}

type Props = { page: EventPage; onSaved?: () => void }

export function EventEditor({ page, onSaved }: Props) {
  const navigate = useNavigate()
  const c = page.content

  const [activeSection, setActiveSection] = useState<EventSection>('hero')
  const [showPreview, setShowPreview] = useState(false)

  // Hero fields
  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(c?.hero?.subtitle ?? '')
  const [date, setDate] = useState(c?.hero?.date ?? '')
  const [region, setRegion] = useState<Region | ''>(c?.hero?.region ?? '')
  const [heroImage, setHeroImage] = useState<CaptionedImage | null>(c?.hero?.heroImage ?? null)

  // Required section fields
  const [infoGrid, setInfoGrid] = useState<InfoGrid>(c?.infoGrid ?? EMPTY_INFO_GRID)
  const [linkedPageIds, setLinkedPageIds] = useState<string[]>(page.linkedPageIds ?? [])

  // Resolve linked pages so the "≥1 linked topic" gate is accurate (linkedPageIds is any-type). Uses
  // the SHARED rule from publishValidation rather than a local copy — this gate drives the editor's own
  // publish button, and it previously omitted the status check that the list's gate applies, so the two
  // disagreed for an event whose only linked topic was archived.
  const { data: allPages } = useAsync(useCallback(() => getPages(), []))
  const byId = new Map((allPages ?? []).map((p: ContentPage) => [p.id, p]))
  const hasLinkedTopic = hasPublishedTopicLink(linkedPageIds, byId)

  // Optional section fields
  const [commanderWord, setCommanderWord] = useState(c?.commanderWord ?? '')
  const [deepening, setDeepening] = useState<DeepeningItem[]>(c?.deepening ?? [])
  const [gallery, setGallery] = useState<CaptionedImage[]>(c?.gallery ?? [])
  const [map, setMap] = useState<CaptionedImage[]>(c?.map ?? [])
  const [dashboards, setDashboards] = useState<CaptionedImage[]>(c?.dashboards ?? [])
  const [historySection, setHistorySection] = useState<HistorySection>(
    c?.historySection ?? EMPTY_HISTORY
  )
  const [commanderHighlights, setCommanderHighlights] = useState<CommanderHighlight[]>(
    c?.commanderHighlights ?? initHighlights()
  )
  const [timeline, setTimeline] = useState<TimelineData>(c?.timeline ?? EMPTY_TIMELINE)

  // Action state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving'>('idle')
  const [publishStatus, setPublishStatus] = useState<'idle' | 'saving'>('idle')
  // Surfaced when a save/publish throws (e.g. localStorage QuotaExceededError from too many/too large
  // images) — a silent failure would lose the user's edits with no warning, so it must be visible.
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Unsaved-changes detection ────────────────────────────────────────────────

  function formFingerprint(): string {
    return JSON.stringify({
      title,
      linkedPageIds,
      hero: { subtitle, date, region, heroImage: fingerprintImages(heroImage ? [heroImage] : []) },
      infoGrid,
      commanderWord,
      deepening,
      gallery: fingerprintImages(gallery),
      map: fingerprintImages(map),
      dashboards: fingerprintImages(dashboards),
      historySection,
      commanderHighlights,
      timeline,
    })
  }

  const [savedKey, setSavedKey] = useState(() => makeInitialKey(page))
  const hasUnsaved = savedKey !== formFingerprint()

  const skipGuardRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved && !skipGuardRef.current && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (hasUnsaved) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  // ── Section completeness ─────────────────────────────────────────────────────

  function heroComplete() {
    return !!(title.trim() && subtitle.trim() && date && region)
  }
  function infoGridComplete() {
    const g = infoGrid
    return !!(
      g.commanderSummary.trim() &&
      g.eventType &&
      (g.eventType !== 'אחר' || g.eventTypeDetail.trim()) &&
      g.sector.trim() &&
      g.timeFrom &&
      g.timeTo &&
      g.forces.trim() &&
      g.enemy.trim()
    )
  }

  function sectionComplete(id: EventSection): boolean {
    switch (id) {
      case 'hero': return heroComplete()
      case 'infoGrid': return infoGridComplete()
      case 'commanderWord': return !!commanderWord.trim()
      case 'deepening': return deepening.length > 0
      case 'gallery': return gallery.length > 0
      case 'historySection':
        return !!(historySection.teaser.trim() && historySection.fullContent.trim())
      case 'timeline':
        return timeline.enemyEvents.length + timeline.friendlyEvents.length > 0
      case 'map': return map.length > 0
      case 'dashboards': return dashboards.length > 0
      case 'commanderHighlights':
        return commanderHighlights.some((cat) => cat.points.length > 0)
      case 'topicLinks': return hasLinkedTopic
    }
  }

  const publishReady = heroComplete() && infoGridComplete() && hasLinkedTopic

  const sidebarSections: SidebarSection[] = SECTIONS.map((s) => ({
    ...s,
    complete: sectionComplete(s.id),
  }))

  // Gate for toolbar tooltip
  const gateMissing: string[] = []
  if (!heroComplete()) gateMissing.push('כותרת ומטא-דאטה')
  if (!infoGridComplete()) gateMissing.push('פרטי האירוע')
  if (!hasLinkedTopic) gateMissing.push('קישור דפים')
  const gate = { done: 3 - gateMissing.length, total: 3, missing: gateMissing }

  // ── Build payloads ───────────────────────────────────────────────────────────

  function buildPayload(): EventPage {
    return {
      id: page.id, type: 'event', title,
      status: page.status,
      createdAt: page.createdAt, updatedAt: new Date().toISOString(),
      linkedPageIds,
      content: {
        // All four image fields (hero + gallery/map/dashboards) now persist their src as base64 data
        // URLs, which survive a save + reload (see CaptionedImageSection / HeroImageField). No stripping.
        hero: { subtitle, date, region: region as Region,
          ...(heroImage ? { heroImage } : {}) },
        infoGrid,
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
        gallery,
        map,
        dashboards,
        historySection,
        commanderHighlights,
        timeline,
      },
    }
  }

  function buildLivePage(): EventPage {
    return {
      id: page.id, type: 'event', title,
      status: page.status, createdAt: page.createdAt, updatedAt: page.updatedAt,
      linkedPageIds,
      content: {
        hero: { subtitle, date, region: region as Region, ...(heroImage ? { heroImage } : {}) },
        infoGrid,
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
        gallery,
        map,
        dashboards,
        historySection,
        commanderHighlights,
        timeline,
      },
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    setSaveStatus('saving')
    setSaveError(null)
    try {
      await savePage(buildPayload())
      setSavedKey(formFingerprint())
      onSaved?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת הטיוטה נכשלה')
    } finally {
      setSaveStatus('idle')
    }
  }

  async function handlePublish() {
    if (!publishReady) return
    setPublishStatus('saving')
    setSaveError(null)
    skipGuardRef.current = true
    try {
      await savePage(buildPayload())
      await publishPage(page.id)
      onSaved?.()
      navigate('/')
    } catch (err) {
      skipGuardRef.current = false
      setSaveError(err instanceof Error ? err.message : 'הפרסום נכשל')
      setPublishStatus('idle')
    }
  }

  // ── Preview mode ─────────────────────────────────────────────────────────────

  if (showPreview) {
    return (
      <div dir="rtl" className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm px-4 sm:px-8 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Eye className="size-4" />
            <span className="hidden sm:inline">תצוגה מקדימה — </span>
            {title || 'ללא כותרת'}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(false)} className="gap-1.5">
            <Pencil className="size-4" />חזרה לעריכה
          </Button>
        </div>
        {/* Preview is an ANALYST context: links inside it stay on the analyst route. */}
        <PageLinkContext.Provider value={analystHref}>
          <PageViewer page={buildLivePage()} />
        </PageLinkContext.Provider>
      </div>
    )
  }

  // ── Editor ───────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <EditorToolbar
        pageType="event"
        title={title}
        status={page.status}
        onSaveDraft={handleSaveDraft}
        saveStatus={saveStatus}
        onPublish={handlePublish}
        publishStatus={publishStatus}
        publishReady={publishReady}
        onPreview={() => setShowPreview(true)}
        hasPendingChanges={hasUnsaved}
        gate={gate}
      />

      <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 items-start">
        <EditorSidebar
          pageTypeLabel="דף אירוע"
          sections={sidebarSections}
          active={activeSection}
          onSelect={(id) => setActiveSection(id as EventSection)}
        />

        <div className="flex-1 min-w-0 space-y-6">

          {/* ── Hero ── */}
          {activeSection === 'hero' && (
            <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
              <div className="border-b border-border/60 pb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-foreground">כותרת ומטא-דאטה</h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#21AEFF]/30 text-[#21AEFF] bg-[#F0F8FF]">
                    חובה לפרסום
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  הזן את כל הפרטים (כולם נדרשים לצורך פרסום): כותרת ברורה לאירוע, כותרת משנה, תאריך האירוע ואזור גיאוגרפי רחב.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">כותרת האירוע</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="הכנס כותרת..." className="text-right" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">תת-כותרת</label>
                <Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="הכנס תת-כותרת..." className="text-right resize-none" rows={3} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">מטא-דאטה</p>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">תאריך האירוע</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48 text-right" dir="ltr" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">אזור</label>
                  <Select value={region} onValueChange={(v) => setRegion((v as Region) ?? '')}>
                    <SelectTrigger className="w-56"><span>{region || 'בחר אזור...'}</span></SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => <SelectItem key={r} value={r} label={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <HeroImageField value={heroImage} onChange={setHeroImage} />
              </div>
            </section>
          )}

          {activeSection === 'infoGrid' && (
            <EventInfoGrid value={infoGrid} onChange={setInfoGrid} />
          )}

          {activeSection === 'commanderWord' && (
            <section className="bg-card rounded-xl shadow border border-border p-6">
              <CommanderWordField value={commanderWord} onChange={setCommanderWord} />
            </section>
          )}

          {activeSection === 'deepening' && (
            <DeepeningSection items={deepening} onChange={setDeepening} />
          )}

          {activeSection === 'gallery' && (
            <CaptionedImageSection
              title="גלריה"
              guidance="העלה תמונות רלוונטיות שיוצגו בגלריית העמוד."
              images={gallery}
              onChange={setGallery}
            />
          )}

          {activeSection === 'historySection' && (
            <HistorySectionEditor value={historySection} onChange={setHistorySection} />
          )}

          {activeSection === 'timeline' && (
            <TimelineSection value={timeline} onChange={setTimeline} scale="hours" baseDate={date} />
          )}

          {activeSection === 'map' && (
            <CaptionedImageSection
              title="מפה"
              guidance="העלה תמונת מפה שהוכנה על ידי האנליסט."
              images={map}
              onChange={setMap}
            />
          )}

          {activeSection === 'dashboards' && (
            <CaptionedImageSection
              title="דשבורדים"
              guidance="העלה תמונות של גרפים ודשבורדים שהוכנו על ידי האנליסט."
              images={dashboards}
              onChange={setDashboards}
            />
          )}

          {activeSection === 'commanderHighlights' && (
            <CommanderHighlightsEditor
              value={commanderHighlights}
              onChange={setCommanderHighlights}
            />
          )}

          {activeSection === 'topicLinks' && (
            <EventPageLinksSection currentPageId={page.id} linkedPageIds={linkedPageIds} onChange={setLinkedPageIds} />
          )}

          {/* Floating save indicator */}
          {saveStatus === 'saving' && (
            <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-foreground text-white text-sm px-4 py-2 rounded-xl shadow-xl font-heebo">
              <Loader2 className="size-3.5 animate-spin" />שומר...
            </div>
          )}

          {/* Save/publish failure banner (e.g. storage quota exceeded) — stays until dismissed so the
              user can't miss that their edits were NOT saved. */}
          {saveError && (
            <div className="fixed bottom-6 left-6 z-50 max-w-sm flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-xl font-heebo">
              <span className="flex-1 leading-relaxed">{saveError}</span>
              <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-xs underline shrink-0">סגור</button>
            </div>
          )}
        </div>
      </div>

      <UnsavedChangesDialog
        open={blocker.state === 'blocked'}
        onSave={async () => {
          await handleSaveDraft()
          blocker.proceed?.()
        }}
        onDiscard={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}
