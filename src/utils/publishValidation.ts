import type { ContentPage, TopicPage, EventPage, ReferencePage } from '@/types/contentPage'

export type ValidationResult = { section: string; fields: string[] }

export type Gate = { done: number; total: number; missing: string[] }

/**
 * "Does this page have at least one link that actually COUNTS?" — the single implementation of the
 * type-and-status test behind every link gate in the app. Status and type are resolved together, in
 * one place, so no caller can satisfy one half and forget the other.
 *
 * The status half is load-bearing everywhere it's used: a gate means "once published, this page is
 * reachable through that link", and a draft or archived page is reachable by no reader.
 *
 * A missing `type` yields false — a picker with no candidate type can have no satisfying link, which
 * matches how LinkPicker's own candidate pool already resolves in that (misconfigured) case.
 */
export function hasPublishedLinkOfType(
  linkedPageIds: string[] | undefined,
  byId: Map<string, ContentPage>,
  type: ContentPage['type'] | undefined,
): boolean {
  if (!type) return false
  return (linkedPageIds ?? []).some((id) => {
    const t = byId.get(id)
    return t?.type === type && t.status === 'published'
  })
}

/**
 * THE "≥1 linked topic" EVENT PUBLISH rule — used by validateEvent below (the list's gate), by
 * EventEditor's own sidebar/toolbar gate, and by LinkPicker's inline gate message. It existed as three
 * independent copies; they drifted (only one checked status), so the list, the editor and the picker
 * could each report a different answer for the same event. Do not re-inline it.
 *
 * A named alias, not a second implementation: it delegates to hasPublishedLinkOfType so the generic
 * test and this specific rule can never disagree. Without the status half, archiving a topic would
 * leave any event linked only to it publishable — landing on the home index anchored to nothing.
 */
export function hasPublishedTopicLink(
  linkedPageIds: string[] | undefined,
  byId: Map<string, ContentPage>,
): boolean {
  return hasPublishedLinkOfType(linkedPageIds, byId, 'topic')
}

// `allPages` is needed to type-check an event's links (the "≥1 linked topic" rule now resolves the
// linked page's type from its id, since linkedPageIds is type-agnostic).
export function computeGate(page: ContentPage, allPages: ContentPage[] = []): Gate {
  const errors = validatePageForPublish(page, allPages)
  const total = page.type === 'topic' ? 2 : page.type === 'event' ? 3 : 2
  return { done: total - errors.length, total, missing: errors.map((e) => e.section) }
}

export function validatePageForPublish(page: ContentPage, allPages: ContentPage[] = []): ValidationResult[] {
  if (page.type === 'topic') return validateTopic(page)
  if (page.type === 'event') return validateEvent(page, allPages)
  return validateReference(page)
}

function validateTopic(page: TopicPage): ValidationResult[] {
  const errors: ValidationResult[] = []

  const heroFields: string[] = []
  if (!page.title?.trim()) heroFields.push('כותרת הדף')
  if (!page.content?.hero?.subtitle?.trim()) heroFields.push('תת-כותרת')
  if (!page.content?.hero?.periodFrom) heroFields.push('תאריך התחלה')
  if (!page.content?.hero?.periodTo) heroFields.push('תאריך סיום')
  if (!page.content?.hero?.region) heroFields.push('אזור')
  if (heroFields.length) errors.push({ section: 'כותרת ומטא-דאטה', fields: heroFields })

  const overviewFields: string[] = []
  if (!page.content?.overview?.summary?.trim()) overviewFields.push('תקציר כללי')
  if (!page.content?.overview?.background?.trim()) overviewFields.push('רקע')
  if (!page.content?.overview?.arenaCharacteristics?.ourForces?.trim()) overviewFields.push('צד א׳')
  if (!page.content?.overview?.arenaCharacteristics?.enemy?.trim()) overviewFields.push('צד ב׳')
  if (overviewFields.length) errors.push({ section: 'סקירה כללית', fields: overviewFields })

  return errors
}

function validateReference(page: ReferencePage): ValidationResult[] {
  const errors: ValidationResult[] = []
  if (!page.title?.trim()) errors.push({ section: 'כותרת', fields: ['כותרת הדף'] })
  // deepening is this type's PRIMARY content and is required (≥1 item) to publish.
  if (!page.content?.deepening?.length)
    errors.push({ section: 'העמקה', fields: ['נדרש פריט העמקה אחד לפחות'] })
  return errors
}

function validateEvent(page: EventPage, allPages: ContentPage[]): ValidationResult[] {
  const errors: ValidationResult[] = []

  const heroFields: string[] = []
  if (!page.title?.trim()) heroFields.push('כותרת האירוע')
  if (!page.content?.hero?.subtitle?.trim()) heroFields.push('תת-כותרת')
  if (!page.content?.hero?.date) heroFields.push('תאריך האירוע')
  if (!page.content?.hero?.region) heroFields.push('אזור')
  if (heroFields.length) errors.push({ section: 'כותרת ומטא-דאטה', fields: heroFields })

  const grid = page.content?.infoGrid
  const infoFields: string[] = []
  if (!grid?.commanderSummary?.trim()) infoFields.push('תקציר')
  if (!grid?.eventType) infoFields.push('סוג אירוע')
  if (grid?.eventType === 'אחר' && !grid?.eventTypeDetail?.trim()) infoFields.push('פירוט סוג אירוע')
  if (!grid?.sector?.trim()) infoFields.push('מיקום')
  if (!grid?.timeFrom) infoFields.push('שעת פתיחה')
  if (!grid?.timeTo) infoFields.push('שעת סגירה')
  if (!grid?.forces?.trim()) infoFields.push('צד א׳')
  if (!grid?.enemy?.trim()) infoFields.push('צד ב׳')
  if (infoFields.length) errors.push({ section: 'פרטי אירוע', fields: infoFields })

  // Requires ≥1 published linked topic — see hasPublishedTopicLink above for the rule and why the
  // status half matters. Same published-only reachability rule referenceAssignedTopic (homeIndex.ts)
  // applies, deliberately NOT eventContextTopic's looser lookup, which only names a context line.
  const byId = new Map(allPages.map((p) => [p.id, p]))
  if (!hasPublishedTopicLink(page.linkedPageIds, byId))
    errors.push({ section: 'קישור דפי נושא', fields: ['נדרש נושא מקושר אחד לפחות'] })

  return errors
}
