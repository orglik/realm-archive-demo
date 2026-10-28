import type { TimelineEvent } from '@/types/contentPage'

/**
 * The rule deciding whether an influencing factor can be placed on the timeline at all, shared by the
 * VIEWER (which drops the ones that can't be) and the EDITOR (which warns about them).
 *
 * It lives here rather than in either of them because two copies would be free to disagree, and the
 * failure would be silent in the worst direction: the editor telling an analyst their factor is fine
 * while the viewer quietly omits it, or the reverse. Keep the drop and the warning on this one test.
 */

export type TimeSpan = { min: number; max: number }

/**
 * First and last event instant across both axes — the period the axis actually spans. `null` when
 * there are no parseable events, in which case there is no span to be inside or outside of.
 */
export function timelineSpan(events: TimelineEvent[]): TimeSpan | null {
  const ts = events.map(e => new Date(e.timestamp).getTime()).filter(n => !Number.isNaN(n))
  if (ts.length === 0) return null
  return { min: Math.min(...ts), max: Math.max(...ts) }
}

/**
 * True when the factor lies ENTIRELY outside the span — before the first event or after the last.
 *
 * Such a factor has no truthful position: the axis runs first-event-to-last-event, so every instant
 * outside it maps to one of the two ends, and drawing it there would assert the date of whichever
 * event sits at that end. A factor merely OVERLAPPING an end is fine — the viewer clips it to the
 * edge, which reads correctly as "this continues beyond the view".
 *
 * Unparseable dates return false: they are a different problem, already handled where they are read.
 */
export function isOutOfSpan(startTs: string, endTs: string | undefined, span: TimeSpan | null): boolean {
  if (!span || !startTs) return false
  const start = new Date(startTs).getTime()
  if (Number.isNaN(start)) return false
  const end = endTs ? new Date(endTs).getTime() : start
  if (Number.isNaN(end)) return false
  return end < span.min || start > span.max
}
