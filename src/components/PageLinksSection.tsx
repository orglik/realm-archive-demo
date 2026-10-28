import type { ReactNode } from 'react'
import { ChildTopicsSection } from '@/components/ChildTopicsSection'
import { LinkPicker } from '@/components/editor/LinkPicker'
import type { ContentPage } from '@/types/contentPage'

// Unified "קישור דפים" editor card. The LATERAL picker (linkedPageIds, any page type) is one control
// shared by all three page types. Topics additionally get the SEPARATE hierarchy child-topics picker
// (parent/child edges) — a different mechanism, kept visually distinct so they're never conflated.

function LinksCard({ children }: { children: ReactNode }) {
  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-6">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <h2 className="text-[15px] font-bold text-foreground">קישור דפים</h2>
        <p className="text-[13px] text-muted-foreground">
          קשר דפים אחרים לדף זה — מוצגים דפים שפורסמו בלבד, והקישור נקרא חי.
        </p>
      </div>
      {children}
    </section>
  )
}

function Subsection({ heading, guidance, children }: { heading: string; guidance?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-bold text-foreground">{heading}</h3>
        {guidance && <p className="text-[12px] text-muted-foreground">{guidance}</p>}
      </div>
      {children}
    </div>
  )
}

// The unified lateral-links picker (any page type). `required` powers the event's "≥1 linked topic".
function LateralLinks({
  currentPageId, currentPageType, linkedPageIds, onChange, required, guidance,
}: {
  currentPageId: string
  currentPageType: ContentPage['type']
  linkedPageIds: string[]
  onChange: (ids: string[]) => void
  required?: boolean
  guidance: string
}) {
  return (
    <LinkPicker
      bare
      anyType
      currentPageId={currentPageId}
      currentPageType={currentPageType}
      title="קישור דפים"
      guidance={guidance}
      required={required}
      linkedIds={linkedPageIds}
      onChange={onChange}
    />
  )
}

export function TopicPageLinksSection({
  topicId, childTopicIds, onChildChange, linkedPageIds, onLinkedChange,
}: {
  topicId: string
  childTopicIds: string[]; onChildChange: (ids: string[]) => void
  linkedPageIds: string[]; onLinkedChange: (ids: string[]) => void
}) {
  return (
    <LinksCard>
      {/* Persistent note at the TOP of the whole card — visible without scrolling, covering BOTH
          relationship types once, so an analyst can't conflate hierarchy with lateral reference
          regardless of the sub-section order below. */}
      <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 leading-relaxed">
        לדף נושא יש שני סוגי קישור שונים: <strong>קישור דפי נושא (כפופים)</strong> קובע יחס היררכי אב/בן;
        <strong> קישור רוחבי</strong> הוא הפניה בין דפים קשורים מכל סוג (כולל נושאים) — <strong>אינו</strong> קובע היררכיה.
        שים לב לא לבלבל ביניהם.
      </div>
      <Subsection heading="קישור דפי נושא (כפופים)" guidance="שייך דפי נושא הכפופים לנושא זה בהיררכיה — יחס אב/בן.">
        <ChildTopicsSection bare topicId={topicId} linkedIds={childTopicIds} onChange={onChildChange} />
      </Subsection>
      <Subsection heading="קישור רוחבי" guidance="קשר דפים קשורים מכל סוג (אירוע / נושא / עיון). הפניה רוחבית בלבד — אינה קובעת היררכיה.">
        <LateralLinks
          currentPageId={topicId}
          currentPageType="topic"
          linkedPageIds={linkedPageIds}
          onChange={onLinkedChange}
          guidance="קשר דפים קשורים מכל סוג."
        />
      </Subsection>
    </LinksCard>
  )
}

export function EventPageLinksSection({
  currentPageId, linkedPageIds, onChange,
}: {
  currentPageId: string
  linkedPageIds: string[]; onChange: (ids: string[]) => void
}) {
  return (
    <LinksCard>
      <Subsection heading="קישור דפים" guidance="קשר דף נושא אחד או יותר שאליו שייך אירוע זה — נדרש לפחות אחד לפרסום. ניתן גם לקשר דפים נוספים מכל סוג.">
        <LateralLinks
          currentPageId={currentPageId}
          currentPageType="event"
          linkedPageIds={linkedPageIds}
          onChange={onChange}
          required
          guidance="בחר דף נושא מקושר (נדרש), ובאפשרותך לקשר גם דפים נוספים."
        />
      </Subsection>
    </LinksCard>
  )
}

export function ReferencePageLinksSection({
  currentPageId, linkedPageIds, onChange,
}: {
  currentPageId: string
  linkedPageIds: string[]; onChange: (ids: string[]) => void
}) {
  return (
    <LinksCard>
      <Subsection heading="קישור דפים" guidance="קשר את הדפים שאליהם מפנה דף העיון — מכל סוג. אופציונלי; דף עיון יכול לעמוד בפני עצמו ללא קישורים.">
        <LateralLinks
          currentPageId={currentPageId}
          currentPageType="reference"
          linkedPageIds={linkedPageIds}
          onChange={onChange}
          guidance="קשר דפי מקור מכל סוג (אופציונלי)."
        />
      </Subsection>
    </LinksCard>
  )
}
