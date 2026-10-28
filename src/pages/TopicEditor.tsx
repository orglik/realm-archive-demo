import { useState, useRef, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import type {
  TopicPage, Region, DeepeningItem, CaptionedImage, HistorySection, TimelineData,
} from '@/types/contentPage'
import { savePage, publishPage } from '@/services/pageService'
import { DeepeningSection } from '@/components/DeepeningSection'
import { CaptionedImageSection } from '@/components/editor/CaptionedImageSection'
import { HeroImageField } from '@/components/editor/HeroImageField'
import { HistorySectionEditor } from '@/components/editor/HistorySectionEditor'
import { TimelineSection } from '@/components/editor/TimelineSection'
import { TopicPageLinksSection } from '@/components/PageLinksSection'
import { CommanderWordField } from '@/components/CommanderWord'
import { EditorParentBreadcrumb } from '@/components/EditorParentBreadcrumb'
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
import { Plus, Trash2, Pencil, Eye, Loader2 } from 'lucide-react'

const regions: Region[] = ['הצפון', 'הדרום', 'מעבר לים הצר', 'ארצות הסערה']

const EMPTY_HISTORY: HistorySection = { teaser: '', fullContent: '' }
const EMPTY_TIMELINE: TimelineData = { enemyEvents: [], friendlyEvents: [] }

type TopicSection =
  | 'hero' | 'overview' | 'commanderWord' | 'deepening' | 'gallery'
  | 'historySection' | 'timeline' | 'map' | 'dashboards' | 'links'

const SECTIONS: { id: TopicSection; label: string; required?: true }[] = [
  { id: 'hero',          label: 'כותרת ומטא-דאטה', required: true },
  { id: 'overview',      label: 'סקירה כללית',      required: true },
  { id: 'links',         label: 'קישור דפים' },
  { id: 'commanderWord', label: 'דבר המלך' },
  { id: 'deepening',     label: 'העמקה' },
  { id: 'gallery',       label: 'גלריה' },
  { id: 'historySection',label: 'סקירת המאסטרים' },
  { id: 'timeline',      label: 'ציר זמן' },
  { id: 'map',           label: 'מפה' },
  { id: 'dashboards',    label: 'דשבורדים' },
]

function fingerprintImages(imgs: CaptionedImage[]) {
  return imgs.map(({ id, name, caption }) => ({ id, name, caption }))
}

function makeInitialKey(page: TopicPage): string {
  const c = page.content ?? {}
  return JSON.stringify({
    title: page.title,
    linkedPageIds: page.linkedPageIds ?? [],
    childTopicIds: page.childTopicIds ?? [],
    hero: {
      subtitle: c.hero?.subtitle ?? '',
      periodFrom: c.hero?.periodFrom ?? '',
      periodTo: c.hero?.periodTo ?? '',
      region: c.hero?.region ?? '',
      heroImage: fingerprintImages(c.hero?.heroImage ? [c.hero.heroImage] : []),
    },
    overview: {
      summary: c.overview?.summary ?? '',
      background: c.overview?.background ?? '',
      arenaCharacteristics: {
        ourForces: c.overview?.arenaCharacteristics?.ourForces ?? '',
        enemy: c.overview?.arenaCharacteristics?.enemy ?? '',
        additional: c.overview?.arenaCharacteristics?.additional ?? [],
      },
    },
    commanderWord: c.commanderWord ?? '',
    deepening: c.deepening ?? [],
    gallery: fingerprintImages(c.gallery ?? []),
    map: fingerprintImages(c.map ?? []),
    dashboards: fingerprintImages(c.dashboards ?? []),
    historySection: c.historySection ?? EMPTY_HISTORY,
    timeline: c.timeline ?? EMPTY_TIMELINE,
  })
}

type Props = { page: TopicPage; onSaved?: () => void }

export function TopicEditor({ page, onSaved }: Props) {
  const navigate = useNavigate()
  const c = page.content

  const [activeSection, setActiveSection] = useState<TopicSection>('hero')
  const [showPreview, setShowPreview] = useState(false)

  // Hero fields
  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(c?.hero?.subtitle ?? '')
  const [periodFrom, setPeriodFrom] = useState(c?.hero?.periodFrom ?? '')
  const [periodTo, setPeriodTo] = useState(c?.hero?.periodTo ?? '')
  const [region, setRegion] = useState<Region | ''>(c?.hero?.region ?? '')
  const [heroImage, setHeroImage] = useState<CaptionedImage | null>(c?.hero?.heroImage ?? null)

  // Overview fields
  const [summary, setSummary] = useState(c?.overview?.summary ?? '')
  const [background, setBackground] = useState(c?.overview?.background ?? '')
  const [ourForces, setOurForces] = useState(c?.overview?.arenaCharacteristics?.ourForces ?? '')
  const [enemy, setEnemy] = useState(c?.overview?.arenaCharacteristics?.enemy ?? '')
  const [additional, setAdditional] = useState<string[]>(
    c?.overview?.arenaCharacteristics?.additional ?? []
  )

  // Optional section fields
  const [commanderWord, setCommanderWord] = useState(c?.commanderWord ?? '')
  const [deepening, setDeepening] = useState<DeepeningItem[]>(c?.deepening ?? [])
  const [gallery, setGallery] = useState<CaptionedImage[]>(c?.gallery ?? [])
  const [map, setMap] = useState<CaptionedImage[]>(c?.map ?? [])
  const [dashboards, setDashboards] = useState<CaptionedImage[]>(c?.dashboards ?? [])
  const [historySection, setHistorySection] = useState<HistorySection>(
    c?.historySection ?? EMPTY_HISTORY
  )
  const [timeline, setTimeline] = useState<TimelineData>(c?.timeline ?? EMPTY_TIMELINE)
  const [linkedPageIds, setLinkedPageIds] = useState<string[]>(page.linkedPageIds ?? [])
  const [childTopicIds, setChildTopicIds] = useState<string[]>(page.childTopicIds ?? [])

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
      childTopicIds,
      hero: { subtitle, periodFrom, periodTo, region, heroImage: fingerprintImages(heroImage ? [heroImage] : []) },
      overview: { summary, background, arenaCharacteristics: { ourForces, enemy, additional } },
      commanderWord,
      deepening,
      gallery: fingerprintImages(gallery),
      map: fingerprintImages(map),
      dashboards: fingerprintImages(dashboards),
      historySection,
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
    return !!(title.trim() && subtitle.trim() && periodFrom && periodTo && region)
  }
  function overviewComplete() {
    return !!(summary.trim() && background.trim() && ourForces.trim() && enemy.trim())
  }

  function sectionComplete(id: TopicSection): boolean {
    switch (id) {
      case 'hero': return heroComplete()
      case 'overview': return overviewComplete()
      case 'commanderWord': return !!commanderWord.trim()
      case 'deepening': return deepening.length > 0
      case 'gallery': return gallery.length > 0
      case 'historySection':
        return !!(historySection.teaser.trim() && historySection.fullContent.trim())
      case 'timeline':
        return timeline.enemyEvents.length + timeline.friendlyEvents.length > 0
      case 'map': return map.length > 0
      case 'dashboards': return dashboards.length > 0
      case 'links': return linkedPageIds.length > 0 || childTopicIds.length > 0
    }
  }

  const publishReady = heroComplete() && overviewComplete()

  const sidebarSections: SidebarSection[] = SECTIONS.map((s) => ({
    ...s,
    complete: sectionComplete(s.id),
  }))

  // Gate for toolbar tooltip
  const gateMissing: string[] = []
  if (!heroComplete()) gateMissing.push('כותרת ומטא-דאטה')
  if (!overviewComplete()) gateMissing.push('סקירה כללית')
  const gate = { done: 2 - gateMissing.length, total: 2, missing: gateMissing }

  // ── Build payloads ───────────────────────────────────────────────────────────

  function buildPayload(): TopicPage {
    return {
      id: page.id, type: 'topic', title,
      status: page.status,
      createdAt: page.createdAt, updatedAt: new Date().toISOString(),
      linkedPageIds,
      childTopicIds,
      content: {
        // All four image fields (hero + gallery/map/dashboards) now persist their src: uploads are
        // base64 data URLs, which survive being written to storage and reloaded (see
        // CaptionedImageSection / HeroImageField). src is no longer stripped here.
        hero: { subtitle, periodFrom, periodTo, region: region as Region,
          ...(heroImage ? { heroImage } : {}) },
        overview: { summary, background, arenaCharacteristics: { ourForces, enemy, additional } },
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
        gallery,
        map,
        dashboards,
        historySection,
        timeline,
      },
    }
  }

  function buildLivePage(): TopicPage {
    return {
      id: page.id, type: 'topic', title,
      status: page.status, createdAt: page.createdAt, updatedAt: page.updatedAt,
      linkedPageIds,
      childTopicIds,
      content: {
        hero: { subtitle, periodFrom, periodTo, region: region as Region,
          ...(heroImage ? { heroImage } : {}) },
        overview: { summary, background, arenaCharacteristics: { ourForces, enemy, additional } },
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
        gallery,
        map,
        dashboards,
        historySection,
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
        pageType="topic"
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
          pageTypeLabel="דף נושא"
          sections={sidebarSections}
          active={activeSection}
          onSelect={(id) => setActiveSection(id as TopicSection)}
        />

        <div className="flex-1 min-w-0 space-y-6">

          {/* Read-only parent indicator — always visible when editing a child topic (orientation). */}
          <EditorParentBreadcrumb topicId={page.id} />

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
                  הזן את כל הפרטים (כולם נדרשים לצורך פרסום): כותרת ברורה, כותרת משנה, טווח תאריכים ואזור גיאוגרפי רחב
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">כותרת הדף</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="הכנס כותרת..." className="text-right" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">תת-כותרת</label>
                <Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="הכנס תת-כותרת..." className="text-right resize-none" rows={3} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">מטא-דאטה</p>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">תקופה</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">מתאריך</span>
                      <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-40 text-right" dir="ltr" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">עד תאריך</span>
                      <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-40 text-right" dir="ltr" />
                    </div>
                  </div>
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

          {/* ── Overview ── */}
          {activeSection === 'overview' && (
            <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
              <div className="border-b border-border/60 pb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-foreground">סקירה כללית</h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#21AEFF]/30 text-[#21AEFF] bg-[#F0F8FF]">
                    חובה לפרסום
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  כתוב סקירה כללית של הנושא — מה הוא כולל, מדוע הוא רלוונטי, ומה חשוב שהקורא יידע.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">תקציר כללי</label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="הכנס תקציר כללי..."
                  className="text-right resize-none"
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">רקע</label>
                <Textarea
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  placeholder="הכנס רקע..."
                  className="text-right resize-none"
                  rows={4}
                />
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">מאפייני הזירה</p>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">צד א׳</label>
                  <Textarea
                    value={ourForces}
                    onChange={(e) => setOurForces(e.target.value)}
                    placeholder="תאר את צד א׳..."
                    className="text-right resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">צד ב׳</label>
                  <Textarea
                    value={enemy}
                    onChange={(e) => setEnemy(e.target.value)}
                    placeholder="תאר את צד ב׳..."
                    className="text-right resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">מאפיינים נוספים</label>
                  {additional.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Textarea
                        value={item}
                        onChange={(e) =>
                          setAdditional((prev) => prev.map((x, i) => (i === index ? e.target.value : x)))
                        }
                        className="text-right resize-none flex-1"
                        rows={2}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 mt-1"
                        onClick={() => setAdditional((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAdditional((prev) => [...prev, ''])}
                  >
                    <Plus className="size-4" />הוסף מאפיין
                  </Button>
                </div>
              </div>
            </section>
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
            <TimelineSection value={timeline} onChange={setTimeline} scale="months" />
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

          {activeSection === 'links' && (
            <TopicPageLinksSection
              topicId={page.id}
              childTopicIds={childTopicIds} onChildChange={setChildTopicIds}
              linkedPageIds={linkedPageIds} onLinkedChange={setLinkedPageIds}
            />
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
