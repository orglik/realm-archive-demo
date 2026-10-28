import { useState, useRef, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import type { ReferencePage, DeepeningItem, CaptionedImage } from '@/types/contentPage'
import { savePage, publishPage } from '@/services/pageService'
import { DeepeningSection } from '@/components/DeepeningSection'
import { HeroImageField } from '@/components/editor/HeroImageField'
import { ReferencePageLinksSection } from '@/components/PageLinksSection'
import { CommanderWordField } from '@/components/CommanderWord'
import { EditorSidebar } from '@/components/EditorSidebar'
import type { SidebarSection } from '@/components/EditorSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog'
import { PageViewer } from '@/components/PageViewer'
import { PageLinkContext, analystHref } from '@/components/viewerLinks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Pencil, Eye } from 'lucide-react'

// דף עיון editor. Minimal by design: no period/region/timeline/gallery. deepening is the primary
// content and the only publish requirement beyond a title.
type ReferenceSection = 'hero' | 'synthesis' | 'commanderWord' | 'deepening' | 'links'

const SECTIONS: { id: ReferenceSection; label: string; required?: true }[] = [
  { id: 'hero',          label: 'כותרת', required: true },
  { id: 'deepening',     label: 'העמקה', required: true },
  { id: 'synthesis',     label: 'רקע' },
  { id: 'commanderWord', label: 'דבר המלך' },
  { id: 'links',         label: 'קישור דפים' },
]

function makeInitialKey(page: ReferencePage): string {
  const c = page.content ?? { deepening: [] }
  return JSON.stringify({
    title: page.title,
    linkedPageIds: page.linkedPageIds ?? [],
    subtitle: c.hero?.subtitle ?? '',
    heroImage: c.hero?.heroImage?.id ?? '',
    synthesis: c.overview?.synthesis ?? '',
    commanderWord: c.commanderWord ?? '',
    deepening: c.deepening ?? [],
  })
}

type Props = { page: ReferencePage; onSaved?: () => void }

export function ReferenceEditor({ page, onSaved }: Props) {
  const navigate = useNavigate()
  const c = page.content

  const [activeSection, setActiveSection] = useState<ReferenceSection>('hero')
  const [showPreview, setShowPreview] = useState(false)

  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(c?.hero?.subtitle ?? '')
  const [heroImage, setHeroImage] = useState<CaptionedImage | null>(c?.hero?.heroImage ?? null)
  const [synthesis, setSynthesis] = useState(c?.overview?.synthesis ?? '')
  const [commanderWord, setCommanderWord] = useState(c?.commanderWord ?? '')
  const [deepening, setDeepening] = useState<DeepeningItem[]>(c?.deepening ?? [])
  const [linkedPageIds, setLinkedPageIds] = useState<string[]>(page.linkedPageIds ?? [])

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving'>('idle')
  const [publishStatus, setPublishStatus] = useState<'idle' | 'saving'>('idle')
  // Surfaced when a save/publish throws (e.g. localStorage QuotaExceededError) — a silent failure
  // would lose the user's edits with no warning, so it must be visible.
  const [saveError, setSaveError] = useState<string | null>(null)

  function formFingerprint(): string {
    return JSON.stringify({ title, linkedPageIds, subtitle, heroImage: heroImage?.id ?? '', synthesis, commanderWord, deepening })
  }

  const [savedKey, setSavedKey] = useState(() => makeInitialKey(page))
  const hasUnsaved = savedKey !== formFingerprint()

  const skipGuardRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved && !skipGuardRef.current && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) { if (hasUnsaved) e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  // ── Completeness / gate ──
  function sectionComplete(id: ReferenceSection): boolean {
    switch (id) {
      case 'hero': return !!title.trim()
      case 'deepening': return deepening.length > 0
      case 'synthesis': return !!synthesis.trim()
      case 'commanderWord': return !!commanderWord.trim()
      case 'links': return linkedPageIds.length > 0
    }
  }

  const publishReady = !!title.trim() && deepening.length > 0
  const sidebarSections: SidebarSection[] = SECTIONS.map((s) => ({ ...s, complete: sectionComplete(s.id) }))

  const gateMissing: string[] = []
  if (!title.trim()) gateMissing.push('כותרת')
  if (deepening.length === 0) gateMissing.push('העמקה')
  const gate = { done: 2 - gateMissing.length, total: 2, missing: gateMissing }

  // ── Payloads ──
  function buildPayload(): ReferencePage {
    return {
      id: page.id, type: 'reference', title,
      status: page.status,
      createdAt: page.createdAt, updatedAt: new Date().toISOString(),
      linkedPageIds,
      content: {
        ...((subtitle.trim() || heroImage) ? { hero: { subtitle, ...(heroImage ? { heroImage } : {}) } } : {}),
        ...(synthesis.trim() ? { overview: { synthesis } } : {}),
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
      },
    }
  }

  function buildLivePage(): ReferencePage {
    return {
      id: page.id, type: 'reference', title,
      status: page.status, createdAt: page.createdAt, updatedAt: page.updatedAt,
      linkedPageIds,
      content: {
        ...((subtitle.trim() || heroImage) ? { hero: { subtitle, ...(heroImage ? { heroImage } : {}) } } : {}),
        ...(synthesis.trim() ? { overview: { synthesis } } : {}),
        ...(commanderWord.trim() ? { commanderWord } : {}),
        deepening,
      },
    }
  }

  // ── Actions ──
  async function handleSaveDraft() {
    setSaveStatus('saving')
    setSaveError(null)
    try {
      await savePage(buildPayload())
      setSavedKey(formFingerprint())
      onSaved?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שמירת הטיוטה נכשלה')
    } finally { setSaveStatus('idle') }
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

  // ── Preview ──
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

  // ── Editor ──
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <EditorToolbar
        pageType="reference"
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
          pageTypeLabel="דף עיון"
          sections={sidebarSections}
          active={activeSection}
          onSelect={(id) => setActiveSection(id as ReferenceSection)}
        />

        <div className="flex-1 min-w-0 space-y-6">
          {activeSection === 'hero' && (
            <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
              <div className="border-b border-border/60 pb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-foreground">כותרת</h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#21AEFF]/30 text-[#21AEFF] bg-[#F0F8FF]">
                    חובה לפרסום
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  דף עיון הוא סקירת מקורות וסינתזה — אין לו תקופה או אזור. הזן כותרת ברורה, תת-כותרת ותמונת שער.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">כותרת הדף</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="הכנס כותרת..." className="text-right" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">תת-כותרת (אופציונלי)</label>
                <Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="הכנס תת-כותרת..." className="text-right resize-none" rows={2} />
              </div>

              <HeroImageField value={heroImage} onChange={setHeroImage} />
            </section>
          )}

          {activeSection === 'deepening' && (
            <DeepeningSection items={deepening} onChange={setDeepening} />
          )}

          {activeSection === 'synthesis' && (
            <section className="bg-card rounded-xl shadow border border-border p-6 space-y-4">
              <div className="border-b border-border/60 pb-3 space-y-1">
                <h2 className="text-[15px] font-bold text-foreground">רקע</h2>
                <p className="text-[13px] text-muted-foreground">
                  הנרטיב שלך הקושר את החומר המקושר — מגמות, קשרים ותובנות חוצות-מקורות.
                </p>
              </div>
              <Textarea value={synthesis} onChange={(e) => setSynthesis(e.target.value)} placeholder="כתוב את הרקע..." className="text-right resize-none" rows={8} />
            </section>
          )}

          {activeSection === 'commanderWord' && (
            <section className="bg-card rounded-xl shadow border border-border p-6">
              <CommanderWordField value={commanderWord} onChange={setCommanderWord} />
            </section>
          )}

          {activeSection === 'links' && (
            <ReferencePageLinksSection currentPageId={page.id} linkedPageIds={linkedPageIds} onChange={setLinkedPageIds} />
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
        onSave={async () => { await handleSaveDraft(); blocker.proceed?.() }}
        onDiscard={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}
