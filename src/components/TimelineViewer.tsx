import { useState, useRef, useEffect, useMemo } from 'react'
import type { TimelineData, TimelineEvent, MeetingPoint } from '@/types/contentPage'
import { timelineSpan, isOutOfSpan, type TimeSpan } from '@/utils/timelineFactors'

export type TimelineScale = 'months' | 'hours'

// ── Design tokens ─────────────────────────────────────────────────────────────
const ENEMY_COLOR = '#D6453D'
const FRIENDLY_COLOR = '#21AEFF'
const SPINE_COLOR = '#C8D8E0'
const CONNECTOR_RESPONSE_COLOR = '#458FFF'
const CONNECTOR_CLASH_COLOR = '#879BA3'

// ── Layout constants ──────────────────────────────────────────────────────────
// Gaps ≥ this fraction of the span collapse into a labeled break. KNOWN TRADEOFF: the span is
// scoped to the window an event landed in, not to the whole timeline — so the same real-world
// gap can collapse in one window and stay linear in another purely because of neighbouring
// event density. This is inherent to laying each window out independently. partitionWindows()
// caps both axes per window, which keeps window spans comparable and makes the divergence rare,
// but it is not eliminated. Scope the threshold globally only if that rarity stops holding.
const GAP_THRESHOLD = 0.30
const GAP_BREAK_PX = 72
const EDGE_PAD = 72       // clearance kept at every window edge so labels/chips never touch the side panels
/**
 * Below this container width the canvas STOPS compressing. Instead it is laid out at exactly this
 * width — the width the layout produces at a 1280px desktop viewport — and the container scrolls
 * horizontally. Compressing a 1006px canvas into a 261px phone screen keeps every dot but squeezes
 * the 88px label boxes on top of each other, so the timeline becomes unreadable rather than merely
 * small. The comparison is `<`, so a container that is exactly this wide takes the original path
 * and desktop geometry is untouched.
 */
const MIN_CANVAS_W = 1006
const LEFT_GUTTER = 132   // reserved column for the "more events" panel (windowed only)
const RIGHT_GUTTER = 88   // reserved column for the end cap / "previous events" panel
// Spine offset and canvas height are DERIVED per timeline (layout.spineY / layout.canvasH) so a
// deep same-instant stack can grow the canvas. These are the floors — a timeline needing ≤ 2
// lanes per bank lands exactly on them, which is why existing pages are pixel-identical.
const BASE_SPINE = 128
const BASE_CANVAS = 288
const SHORT_STEM = 32
// Lane n sits SHORT_STEM + n·LANE_STEP from the spine. 32 → 78 reproduces the original
// two-lane geometry exactly; 46 is also ≥ a two-line label block, so lanes never collide.
const LANE_STEP = 46
const LABEL_BLOCK_H = 38  // vertical room a date+label block needs beyond its stem tip
// Space kept above the spine when a bank is empty — enough to clear the spine's own stroke and the
// white gap-break marks drawn across it, and nothing more.
const EMPTY_BANK_TOP_PAD = 16
// How close an event may sit to a scale tick before the tick label is dropped. Half a label box
// (LABEL_BOX_W is 88) is the point at which the stem starts cutting through the tick text.
const TICK_EVENT_CLEARANCE = 22
// Breathing room between the scroll canvas and its container edges in narrow mode, so the first
// and last labels are not flush against the clip edge at either scroll extreme.
const NARROW_EDGE_GUTTER = 16
const DOT_R = 5
// LABEL_BOX_W is now the FLOOR of a label's box, not a fixed assumption. Short labels keep it exactly
// (so every existing page is pixel-identical); a label whose real text is wider grows its box up to
// MAX_LABEL_W, and the lane-collision test uses that real width. See effLabelWidth / measureLabelWidth.
const LABEL_BOX_W = 88
// Ceiling on a label box. Beyond this the box stops widening and the text wraps to (up to) two lines;
// LANE_STEP (46) was already sized for a two-line block, so wrapping stays within one lane vertically.
const MAX_LABEL_W = 176
// A label whose single-line natural width exceeds this can't sit comfortably on two lines at the base
// size, so it drops one bounded font step (12.5px → 11px, the `small` branch below). Not unbounded
// shrinking — exactly one step, and only for labels past the two-line ceiling.
const LABEL_WRAP2_W = MAX_LABEL_W * 2
const LABEL_FONT_PX = 12.5
// The exact font used for the label line, so canvas measureText matches the rendered <p> (weight 600,
// Heebo). Kept in sync with the label <p> className below.
const LABEL_FONT = `600 ${LABEL_FONT_PX}px Heebo, system-ui, sans-serif`

// Real rendered width of a label's text, measured once via a shared canvas and cached by string.
// Falls back to the floor when no DOM/canvas is available (keeps behaviour neutral). The cache is
// cleared once web fonts finish loading (see the component effect) so early measurements with a
// fallback metric can't stick.
let _measureCtx: CanvasRenderingContext2D | null = null
const _measureCache = new Map<string, number>()
function clearLabelMeasureCache() { _measureCache.clear() }
// Cache is keyed by font AND text — the factor strip measures a different face from event labels,
// and a shared text-only key would hand one the other's width.
function measureText(text: string, font: string, fallback: number): number {
  const key = `${font}|${text}`
  const cached = _measureCache.get(key)
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') return fallback
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d')
  if (!_measureCtx) return fallback
  _measureCtx.font = font
  const w = _measureCtx.measureText(text).width
  _measureCache.set(key, w)
  return w
}
function measureLabelWidth(text: string): number {
  return measureText(text, LABEL_FONT, LABEL_BOX_W)
}
// Effective box width fed to BOTH the collision test and the rendered box. Clamped so a label that
// already fit the old fixed box (≤ LABEL_BOX_W) is unchanged, and a very long one is capped at MAX.
function effLabelWidth(text: string): number {
  const natural = measureLabelWidth(text)
  if (natural <= LABEL_BOX_W) return LABEL_BOX_W
  return Math.min(natural, MAX_LABEL_W)
}
// Readability floor. With two alternating lanes, same-lane neighbours are two events apart,
// so ≥ LABEL_BOX_W/2 between adjacent same-axis events guarantees labels never overlap.
const MIN_LABEL_SPACING = 46
const MIN_TS_GAP = 10     // distinct timestamps stay visually distinct on the spine
const WINDOW_TARGET = 10
// Density is width-aware: the per-axis window cap shrinks in proportion to how wide the labels
// actually are, so a page of long sentences splits into more windows than a page of 2-word labels.
// cap = clamp(round(WINDOW_TARGET · LABEL_BOX_W / medianLabelWidth), WINDOW_CAP_FLOOR, WINDOW_TARGET).
// Short-label pages (median ≈ 88) → cap stays 10 → windowing identical to before. Lower this floor
// for a denser split, raise it for a roomier one — it's the single density tuning knob.
const WINDOW_CAP_FLOOR = 4
// Extra breathing room between a window-edge label and the side panel, on top of half the label box.
const EDGE_LABEL_GAP = 10
const MINIMAP_H = 40

// ── Hebrew month names ────────────────────────────────────────────────────────
const HE_MONTHS: Record<string, string> = {
  '01': 'ינואר', '02': 'פברואר', '03': 'מרץ',    '04': 'אפריל',
  '05': 'מאי',   '06': 'יוני',   '07': 'יולי',   '08': 'אוגוסט',
  '09': 'ספטמבר','10': 'אוקטובר','11': 'נובמבר', '12': 'דצמבר',
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────
// Both scales are absolute instants in ms. Event pages carry a full ISO datetime
// ('2023-10-07T23:40:00'), so an incident running past midnight sorts and measures correctly.
function parseTs(timestamp: string, _scale: TimelineScale): number {
  return new Date(timestamp).getTime()
}

// Topic-page timestamps are 'YYYY-MM-DD'. The split on 'T' tolerates a full ISO datetime being
// passed by a future call site, so this can't silently emit garbage the way the old
// minutes-since-midnight parsing did — nothing at the type level distinguishes the two forms.
function fmtDate(isoDate: string): string {
  const [, m, d] = isoDate.split('T')[0].split('-')
  return `${d}.${m}`
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function heMonth(ms: number): string {
  return HE_MONTHS[String(new Date(ms).getMonth() + 1).padStart(2, '0')]
}

function heMonthYear(ms: number): string {
  const d = new Date(ms)
  return `${HE_MONTHS[String(d.getMonth() + 1).padStart(2, '0')]} ${d.getFullYear()}`
}

function gapBreakLabel(startMs: number, endMs: number, scale: TimelineScale): { text: string; range: string } {
  if (scale === 'months') {
    const days = Math.round((endMs - startMs) / 86_400_000)
    const from = fmtDate(new Date(startMs).toISOString().split('T')[0])
    const to   = fmtDate(new Date(endMs).toISOString().split('T')[0])
    return { text: `${days} ימים ללא אירועים`, range: `${from}–${to}` }
  }
  const hours = (endMs - startMs) / 3_600_000
  return { text: `${hours.toFixed(1)} שעות ללא אירועים`, range: `${fmtTime(startMs)}–${fmtTime(endMs)}` }
}

// ── Layout types ──────────────────────────────────────────────────────────────
interface PositionedEvent {
  event: TimelineEvent
  axis: 'enemy' | 'friendly'
  xLeft: number
  lane: number          // 0-based; stem length grows with the lane (see stemFor)
  labelWidth: number    // real measured box width (clamped LABEL_BOX_W..MAX_LABEL_W); drives lanes + render
  color: string
  deltaLabel?: string   // "+3 ימים" / "+25 דק׳" on תגובה responding events
  labelLift?: number    // enemy-only: extra stem so the label clears a chip stack rising beneath it
}

// Distance from the spine to a lane's stem tip.
function stemFor(lane: number): number {
  return SHORT_STEM + lane * LANE_STEP
}

// width is carried rather than assumed to be GAP_BREAK_PX: positions run through the
// squeeze-scaled toX(), so in the overload case the drawn break must scale with them.
interface GapBreak    { xLeft: number; width: number; text: string; range: string }
interface ScaleTick   { xLeft: number; label: string }
// chipLane staggers overlapping meeting chips upward (0 = on the spine) — same idea as event-label
// lanes. It applies to both kinds, since the chip is positioned identically regardless of kind.
interface MeetingConnector { mp: MeetingPoint; enemyX: number; friendlyX: number; chipLabel: string; chipLane: number }

// A meeting chip is ~this wide; two chips whose midpoints are closer than this would overlap.
const CHIP_COLLIDE_W = 112
const CHIP_LANE_STEP = 24

// ── Influencing factors (גורמים משפיעים) ──────────────────────────────────────
// Values below come from the approved design export, not from taste:
//   (design notes, not included in this public showcase)
// The tint is ACHROMATIC on purpose — neutralised from the clash grey #879BA3 — so it can never be
// read as a fifth semantic hue alongside enemy/friendly/response/clash.
const FACTOR_TINT         = 'rgba(135,155,163,0.09)'  // date-range band fill
const FACTOR_LINE_COLOR   = '#B9C7CE'                 // point-in-time hairline
const FACTOR_LINE_OPACITY = 0.55
const FACTOR_RULE_COLOR   = '#E6EFF3'                 // hairline at the label strip's top edge
const FACTOR_CAPTION_COLOR = '#A9BBC4'
const FACTOR_CHIP_BORDER  = '#C8D8E0'
const FACTOR_CHIP_TEXT    = '#5C7280'                 // neutral — never the response blue
// FLOOR of a chip's box, not a fixed width — same relationship LABEL_BOX_W has to an event label, so
// a chip whose text fits is pixel-identical to before this grew.
const FACTOR_CHIP_W       = 88
// Ceiling, shared with event labels so the two never disagree about how wide is too wide. A chip is a
// pill and stays `whitespace-nowrap`, so unlike an event label it cannot wrap to a second line —
// past this it ellipsises, which is the last resort rather than the only behaviour.
const FACTOR_CHIP_MAX_W   = MAX_LABEL_W
// px-2 (8px each side) + 1px border each side. Chrome around the text inside the box.
const FACTOR_CHIP_PAD     = 18
// Matches the chip's rendered className: text-[10px] font-medium (500) font-heebo.
const FACTOR_CHIP_FONT    = '500 10px Heebo, system-ui, sans-serif'
// Vertical cost of the strip: rule + gap + one chip row. Each extra chip lane adds CHIP_LANE_STEP.
const FACTOR_STRIP_H      = 32
const FACTOR_CHIP_TOP     = 8   // chip lane 0, measured down from the strip rule
// Breathing room kept between a chip and the window edge (and between a chip and the strip caption).
// Matches the caption's own 8px inset from the edge.
const FACTOR_EDGE_GAP     = 8
const FACTOR_STRIP_LABEL  = 'גורמים משפיעים'
// Kept in sync with the caption's rendered className below (text-[10px], font-heebo, no weight class
// → 400). Measured rather than hardcoded so changing the caption text can't silently break the clamp.
const FACTOR_CAPTION_FONT = '400 10px Heebo, system-ui, sans-serif'
const FACTOR_CAPTION_FALLBACK_W = 70
// Real rendered width of a chip, clamped to [floor, ceiling]. Mirrors effLabelWidth for event labels.
function factorChipWidth(label: string): number {
  const natural = measureText(label, FACTOR_CHIP_FONT, FACTOR_CHIP_W - FACTOR_CHIP_PAD) + FACTOR_CHIP_PAD
  return Math.max(FACTOR_CHIP_W, Math.min(natural, FACTOR_CHIP_MAX_W))
}
// Breathing room between a lifted enemy label's baseline and the top of the chip stack beneath it.
const CHIP_LABEL_GAP = 6

// One rendered SLICE of an influencing factor. A range crossing a window boundary produces one mark
// per window (clipped to that window's edge), so `id` is factor-id@window, not the factor's own id.
interface FactorMark {
  id: string
  label: string
  /** Left edge in canvas coords. RTL: later time is further left. */
  xLeft: number
  /** 0 for a point in time (rendered as a 1px hairline); > 0 for a range band. */
  width: number
  /**
   * Left edge of the 88px label chip, already clamped to its window. NOT simply the band centre
   * minus half a chip — see the clamp in layoutRange. Computed at layout time so the lane sweep
   * below sees final positions; clamping at render time could push two chips onto each other after
   * the sweep had already judged them far enough apart.
   */
  chipX: number
  /** Measured chip box width, clamped to [FACTOR_CHIP_W, FACTOR_CHIP_MAX_W]. */
  chipW: number
  chipLane: number
}

interface Layout {
  canvasWidth: number
  canvasH: number
  spineY: number
  windowCount: number
  events: PositionedEvent[]
  gapBreaks: GapBreak[]
  scaleTicks: ScaleTick[]
  meetingConnectors: MeetingConnector[]
  factorMarks: FactorMark[]
  /** Y of the factor strip's top rule, or 0 when the timeline has no factors to label. */
  factorStripY: number
  /**
   * False when the page's צד ב׳ bank holds NO events at all — e.g. an event page whose own
   * infoGrid says there was no opposing side. Derived from `data`, never from the current
   * window, so a window that happens to contain no צד ב׳ event does not flicker the bank off.
   * Both the canvas geometry and the legend read this one value.
   */
  hasEnemyBank: boolean
  // Analyst-data-integrity problems found while laying out (contradictory pairs, meeting points that
  // reference a missing or mis-sided event). buildLayout is a pure function, so it only DETECTS them;
  // the component logs them once per data change (see effect below), which keeps the log out of the
  // per-render hot path without a module-global dedup Set that would silence a real problem for the
  // rest of the session after its first render. All three are surfaced in every build, not only dev:
  // they are the same category of bad-data signal and an asymmetry between them only confuses.
  dataWarnings: { message: string; detail: Record<string, unknown> }[]
}

// ── Core layout algorithm ─────────────────────────────────────────────────────
type RawEvent = TimelineEvent & { axis: 'enemy' | 'friendly'; ts: number }
// A factor with its endpoints parsed. A point in time is normalised to endTs === startTs, so every
// downstream test is a range test and there is no second code path to keep in step.
type RawFactor = { id: string; label: string; startTs: number; endTs: number; isPoint: boolean }

export interface WindowPartition { windowOfId: Map<string, number>; windowCount: number }

function toRawEvents(data: TimelineData, scale: TimelineScale): RawEvent[] {
  return [
    ...data.enemyEvents.map(e => ({ ...e, axis: 'enemy' as const, ts: parseTs(e.timestamp, scale) })),
    ...data.friendlyEvents.map(e => ({ ...e, axis: 'friendly' as const, ts: parseTs(e.timestamp, scale) })),
  ]
}

// Parse factors and normalise a point in time to a zero-length range, so every downstream test is a
// range test. Unparseable or inverted entries are dropped rather than drawn somewhere arbitrary — the
// editor warns on an inverted range but does not block it, so bad data can reach here.
// `span` is the FIRST and LAST event on the whole timeline (not per window). A factor lying entirely
// outside it is dropped, for the same reason an inverted range is: the axis cannot place it. Clamping
// it to an edge instead would draw it ON the first or last event's position, asserting a date it does
// not have — a factor dated in October would appear to sit on 1 September.
//
// Overlapping factors are kept and clipped; so are factors in the SEAM between two windows, which are
// inside the overall span even though no single window covers them. The editor warns on the dropped
// case using isOutOfSpan — the SAME test applied here — so the analyst is told rather than silently
// losing the row (see InfluencingFactorsCard).
function toRawFactors(data: TimelineData, span: TimeSpan | null): RawFactor[] {
  return (data.influencingFactors ?? []).flatMap(f => {
    const startTs = new Date(f.startTs).getTime()
    if (Number.isNaN(startTs)) return []
    const isPoint = !f.endTs
    const endTs = isPoint ? startTs : new Date(f.endTs!).getTime()
    if (Number.isNaN(endTs) || endTs < startTs) return []
    if (isOutOfSpan(f.startTs, f.endTs, span)) return []
    return [{ id: f.id, label: f.label, startTs, endTs, isPoint }]
  })
}

// Split the timeline into windows of contiguous time with EVEN weight, capping EACH AXIS at
// WINDOW_TARGET.
//
// Two properties matter and they're independent:
//   • the cap — ranking the combined timestamp set (the original approach) balanced windows only
//     by distinct-timestamp count, so an axis that clustered while the other spread could put far
//     more than WINDOW_TARGET events of one axis in a window. That is exactly the density the
//     per-window spacing floor is sized against, and the main way `squeeze` became reachable.
//   • even weight — greedily filling each window to the cap satisfies the cap but drains the
//     tail: a 40-event page came out 18/18/4. Assigning each timestamp group to the window
//     holding its proportional slice of the total gives ~13/13/14 instead.
//
// So: pick the smallest window count whose proportional split keeps both axes inside the cap.
// Events sharing a timestamp always stay together so a בו-זמני pair keeps one scale point.
function partitionWindows(allRaw: RawEvent[], meetingPoints: MeetingPoint[]): WindowPartition {
  const windowOfId = new Map<string, number>()
  if (allRaw.length === 0) return { windowOfId, windowCount: 1 }

  const byTs = new Map<number, RawEvent[]>()
  for (const e of allRaw) {
    if (!byTs.has(e.ts)) byTs.set(e.ts, [])
    byTs.get(e.ts)!.push(e)
  }
  const groups = [...byTs.keys()].sort((a, b) => a - b).map(ts => byTs.get(ts)!)
  const total = allRaw.length

  // Width-aware per-axis cap: the wider an axis's labels, the fewer of them fit comfortably in one
  // window, so cap scales down from WINDOW_TARGET by the median label width. Short labels (≈88px)
  // leave the cap at WINDOW_TARGET, so short-label pages window exactly as before.
  const capForAxis = (axis: 'enemy' | 'friendly') => {
    const widths = allRaw.filter(e => e.axis === axis).map(e => effLabelWidth(e.label)).sort((a, b) => a - b)
    if (widths.length === 0) return WINDOW_TARGET
    const median = widths[Math.floor(widths.length / 2)]
    const cap = Math.round(WINDOW_TARGET * LABEL_BOX_W / Math.max(median, LABEL_BOX_W))
    return Math.max(WINDOW_CAP_FLOOR, Math.min(WINDOW_TARGET, cap))
  }
  const caps = { enemy: capForAxis('enemy'), friendly: capForAxis('friendly') }

  const assign = (wc: number) => {
    const of = new Map<string, number>()
    const counts = Array.from({ length: wc }, () => ({ enemy: 0, friendly: 0 }))
    let consumed = 0
    // -1, not 0: the ceiling below is lastW + 1, so this forces the FIRST group into window 0.
    // Seeded at 0 it only guaranteed "no more than one past the previous group", which let a
    // large earliest group (proportional position ≥ 1) land in window 1 and leave window 0
    // empty — a reserved full-width slab rendering nothing under a "תחילת האירועים" header.
    let lastW = -1
    for (const g of groups) {
      // Place the group by where its midpoint falls in the run of events, so windows carry
      // equal counts rather than equal time.
      let w = Math.min(wc - 1, Math.floor(((consumed + g.length / 2) / total) * wc))
      // Monotonic in time, and never skip a window — a group wider than an even slice would
      // otherwise leave an empty slab reserved in the canvas with nothing to show in it.
      if (w < lastW) w = lastW
      if (w > lastW + 1) w = lastW + 1
      for (const e of g) {
        of.set(e.id, w)
        counts[w][e.axis]++
      }
      consumed += g.length
      lastW = w
    }
    const used = lastW + 1
    const fits = counts.slice(0, used).every(c => c.enemy <= caps.enemy && c.friendly <= caps.friendly)
    return { of, fits, used }
  }

  // Terminates at worst when every timestamp group has its own window. A single timestamp
  // carrying more than WINDOW_TARGET events on one axis still can't be split — groups are
  // indivisible — so that one case is accepted rather than looped over forever.
  let attempt = assign(1)
  for (let wc = 2; !attempt.fits && wc <= groups.length; wc++) attempt = assign(wc)
  for (const [id, w] of attempt.of) windowOfId.set(id, w)

  // Keep meeting-linked events in the same window so their connector/chip never straddles a
  // boundary. Keyed by event ID, not timestamp: an unrelated event that merely shares a
  // timestamp with one side of the pair must not get dragged along with it.
  const beforeCohesion = import.meta.env.DEV ? new Map(windowOfId) : null
  for (const mp of meetingPoints) {
    const wE = windowOfId.get(mp.enemyEventId)
    const wF = windowOfId.get(mp.friendlyEventId)
    if (wE === undefined || wF === undefined || wE === wF) continue
    const target = Math.min(wE, wF)
    windowOfId.set(mp.enemyEventId, target)
    windowOfId.set(mp.friendlyEventId, target)
  }

  // Cohesion runs after the fit check, so pulling a pair together can push a window one over the
  // per-axis cap. Bounded by the number of cross-window meeting points and unobserved so far —
  // but it silently degrades spacing when it happens, so make it audible rather than invisible.
  //
  // DELIBERATELY dev-only, unlike the three buildLayout data-integrity warnings which fire in every
  // build. Those flag INVALID AUTHORED DATA the analyst can correct (a contradiction, a dangling
  // reference, a mis-sided link) — worth catching wherever a bad payload renders. This is a different
  // category: an INTERNAL layout diagnostic. The data is valid; the windowing heuristic just degraded
  // spacing gracefully, and the signal is for a developer tuning WINDOW_TARGET, not for the analyst.
  // Promoting it would also mean building the before/after tally maps in production (pure overhead on
  // every partition) and threading it out to the deduped effect — partitionWindows is a separate memo
  // from buildLayout, so a bare console.warn here would re-introduce the per-render spam we removed.
  if (beforeCohesion) {
    const tally = (src: Map<string, number>) => {
      const m = new Map<number, { enemy: number; friendly: number }>()
      for (const e of allRaw) {
        const w = src.get(e.id)!
        if (!m.has(w)) m.set(w, { enemy: 0, friendly: 0 })
        m.get(w)![e.axis]++
      }
      return m
    }
    const before = tally(beforeCohesion)
    const after = tally(windowOfId)
    for (const [w, c] of after) {
      const b = before.get(w) ?? { enemy: 0, friendly: 0 }
      for (const ax of ['enemy', 'friendly'] as const) {
        // Only when cohesion itself pushed it over — an already-over window (an indivisible
        // timestamp group larger than the cap) is a different, documented case.
        if (c[ax] > caps[ax] && c[ax] > b[ax]) {
          console.warn(
            `[Timeline] איחוד נקודות מפגש הגדיל את חלון ${w + 1} מעבר למכסת הציר`,
            { axis: ax, before: b[ax], after: c[ax], cap: caps[ax] },
          )
        }
      }
    }
  }

  return { windowOfId, windowCount: attempt.used }
}

// Lay one window's events into the canvas range [xLo, xHi] (RTL: earliest at xHi/right),
// keeping `edgePad` clear at both ends so a centered label never crosses the edge into the side
// panels. edgePad is passed in per window (widened when that window holds a wide label) rather than a
// fixed constant, because labels now vary in width. Positions are returned in global canvas coords.
//
// `factors` are the influencing factors that overlap THIS window's time bounds (the caller decides
// which — see buildLayout). They are positioned here rather than by the caller because the only two
// functions that can map a time onto the compressed axis, toX() and uAtTime(), are local to it.
function layoutRange(
  evs: RawEvent[], scale: TimelineScale, xLo: number, xHi: number, edgePad: number,
  factors: RawFactor[] = [],
): {
  events: PositionedEvent[]; gapBreaks: GapBreak[]; scaleTicks: ScaleTick[]; factorMarks: FactorMark[]
} {
  const events: PositionedEvent[] = []
  const gapBreaks: GapBreak[] = []
  const scaleTicks: ScaleTick[] = []
  const factorMarks: FactorMark[] = []
  if (evs.length === 0) return { events, gapBreaks, scaleTicks, factorMarks }

  const sortedUniq = [...new Set(evs.map(e => e.ts))].sort((a, b) => a - b)
  const minTs = sortedUniq[0]
  const maxTs = sortedUniq[sortedUniq.length - 1]
  const totalSpan = maxTs - minTs

  // Detect gap segments within this window (gaps ≥ threshold of the window's own span collapse)
  type RawSeg = { type: 'active' | 'gap'; startTs: number; endTs: number }
  const rawSegs: RawSeg[] = []
  let activeStart = minTs
  for (let i = 1; i < sortedUniq.length; i++) {
    const gap = sortedUniq[i] - sortedUniq[i - 1]
    if (totalSpan > 0 && gap / totalSpan >= GAP_THRESHOLD) {
      rawSegs.push({ type: 'active', startTs: activeStart, endTs: sortedUniq[i - 1] })
      rawSegs.push({ type: 'gap',    startTs: sortedUniq[i - 1], endTs: sortedUniq[i] })
      activeStart = sortedUniq[i]
    }
  }
  rawSegs.push({ type: 'active', startTs: activeStart, endTs: maxTs })

  // Which axes have an event at each distinct timestamp
  const axesByTs = new Map<number, Set<'enemy' | 'friendly'>>()
  for (const e of evs) {
    if (!axesByTs.has(e.ts)) axesByTs.set(e.ts, new Set())
    axesByTs.get(e.ts)!.add(e.axis)
  }

  const width = xHi - xLo
  const gapCount = rawSegs.filter(s => s.type === 'gap').length
  const totalActiveDur = rawSegs.filter(s => s.type === 'active').reduce((sum, s) => sum + (s.endTs - s.startTs), 0)
  const contentWidth = Math.max(width - edgePad * 2 - gapCount * GAP_BREAK_PX, 120)
  const naturalK = totalActiveDur > 0 ? contentWidth / totalActiveDur : 0
  const limit = edgePad + contentWidth + gapCount * GAP_BREAK_PX

  type SegSpan = { startU: number; endU: number; seg: RawSeg }
  type Placement = { posByTs: Map<number, number>; gapUs: number[]; segSpans: SegSpan[]; endU: number }

  // Place each distinct timestamp at its time-proportional offset (scale k), then push it forward
  // if that would put it closer than the readability floor. Tight clusters therefore stop
  // compressing at MIN_LABEL_SPACING instead of collapsing onto each other — this deliberately
  // trades strict time-linearity inside a segment for legibility.
  const place = (k: number): Placement => {
    const posByTs = new Map<number, number>()
    const gapUs: number[] = []
    const segSpans: SegSpan[] = []
    const lastU: Record<'enemy' | 'friendly', number> = { enemy: -Infinity, friendly: -Infinity }
    let prevU = -Infinity
    let u = edgePad

    for (const seg of rawSegs) {
      if (seg.type === 'gap') {
        gapUs.push(u)
        u += GAP_BREAK_PX
      } else {
        const startU = u
        for (const ts of sortedUniq) {
          if (ts < seg.startTs || ts > seg.endTs) continue
          let want = startU + (ts - seg.startTs) * k
          if (prevU > -Infinity) want = Math.max(want, prevU + MIN_TS_GAP)
          const axes = axesByTs.get(ts)!
          for (const ax of axes) want = Math.max(want, lastU[ax] + MIN_LABEL_SPACING)
          posByTs.set(ts, want)
          for (const ax of axes) lastU[ax] = want
          prevU = want
          if (want > u) u = want
        }
        const proportionalEnd = startU + (seg.endTs - seg.startTs) * k
        if (proportionalEnd > u) u = proportionalEnd
        segSpans.push({ startU, endU: u, seg })
      }
    }
    return { posByTs, gapUs, segSpans, endU: u }
  }

  // Largest scale that still fits the window. Uniform data never binds, so it keeps the
  // natural (fully time-proportional) layout untouched; only clusters trigger the search.
  let best = place(naturalK)
  if (best.endU > limit) {
    const atFloor = place(0)
    if (atFloor.endU > limit) {
      best = atFloor          // more events than the window can seat even at the floor
    } else {
      best = atFloor
      let lo = 0
      let hi = naturalK
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        const p = place(mid)
        if (p.endU <= limit) { lo = mid; best = p } else { hi = mid }
      }
    }
  }

  // Only reachable when even the spacing floor overflows: compress uniformly rather than
  // spill past the window edge (overlap returns, which means the window is over capacity).
  const squeeze = best.endU > limit && best.endU > edgePad
    ? (limit - edgePad) / (best.endU - edgePad)
    : 1
  const toX = (u: number) => xHi - (edgePad + (u - edgePad) * squeeze)

  // Map an arbitrary time onto the (now non-linear) axis by interpolating between placed
  // timestamps, so scale ticks stay consistent with where their events actually sit.
  const uAtTime = (t: number, sp: SegSpan): number => {
    const anchors = sortedUniq.filter(ts => ts >= sp.seg.startTs && ts <= sp.seg.endTs)
    if (anchors.length === 0) {
      const dur = sp.seg.endTs - sp.seg.startTs
      return dur > 0 ? sp.startU + ((t - sp.seg.startTs) / dur) * (sp.endU - sp.startU) : sp.startU
    }
    if (t <= anchors[0]) {
      const span = anchors[0] - sp.seg.startTs
      const hiU = best.posByTs.get(anchors[0])!
      return span > 0 ? sp.startU + ((t - sp.seg.startTs) / span) * (hiU - sp.startU) : hiU
    }
    const last = anchors[anchors.length - 1]
    if (t >= last) {
      const span = sp.seg.endTs - last
      const loU = best.posByTs.get(last)!
      return span > 0 ? loU + ((t - last) / span) * (sp.endU - loU) : loU
    }
    for (let i = 0; i < anchors.length - 1; i++) {
      if (t >= anchors[i] && t <= anchors[i + 1]) {
        const loU = best.posByTs.get(anchors[i])!
        const hiU = best.posByTs.get(anchors[i + 1])!
        const span = anchors[i + 1] - anchors[i]
        return span > 0 ? loU + ((t - anchors[i]) / span) * (hiU - loU) : loU
      }
    }
    return sp.startU
  }

  for (const e of evs) {
    events.push({
      event: { id: e.id, timestamp: e.timestamp, label: e.label, description: e.description },
      axis: e.axis,
      xLeft: toX(best.posByTs.get(e.ts)!),
      lane: 0,
      labelWidth: effLabelWidth(e.label),
      color: e.axis === 'enemy' ? ENEMY_COLOR : FRIENDLY_COLOR,
    })
  }

  const gapSegs = rawSegs.filter(s => s.type === 'gap')
  best.gapUs.forEach((gu, i) => {
    const left = toX(gu + GAP_BREAK_PX)
    gapBreaks.push({
      xLeft: left,
      width: toX(gu) - left,
      ...gapBreakLabel(gapSegs[i].startTs, gapSegs[i].endTs, scale),
    })
  })

  // ── Influencing factors ─────────────────────────────────────────────────────
  // A factor is context, not volume: it must survive gap collapse rather than be elided by it. That
  // falls out for free here, because collapse does not DELETE time — it re-maps it onto a shorter
  // stretch of the axis — and the map is exactly what uAtTime() computes. The one thing missing is
  // that `best.segSpans` holds only ACTIVE segments, so a date landing inside a collapsed gap has no
  // span to interpolate within. The gap spans are recoverable (best.gapUs[i] pairs with gapSegs[i],
  // each exactly GAP_BREAK_PX wide), so we merge them in and interpolate linearly across the
  // collapsed zone: a factor inside a gap lands proportionally inside that gap's compressed width.
  if (factors.length > 0) {
    const allSpans: SegSpan[] = [
      ...best.segSpans,
      ...best.gapUs.map((gu, i) => ({ startU: gu, endU: gu + GAP_BREAK_PX, seg: gapSegs[i] })),
    ].sort((a, b) => a.startU - b.startU)

    const uAtAnyTime = (t: number): number => {
      for (const sp of allSpans) {
        const isGap = sp.seg.type === 'gap'
        // A gap claims only its INTERIOR; an active segment claims its endpoints too. Adjacent
        // segments share a boundary timestamp exactly (segments are cut AT event timestamps), so an
        // inclusive test on both would match two spans and let sort order decide the answer. Giving
        // the boundary to the active segment makes every t match exactly one span, so the result no
        // longer depends on allSpans' order — nor on GAP_BREAK_PX staying above MIN_LABEL_SPACING,
        // which is what previously kept the two spans agreeing. Shrink the gap zone below the label
        // spacing floor without this and a boundary-dated factor silently detaches from the event
        // sitting at that same instant, by (MIN_LABEL_SPACING - GAP_BREAK_PX) px.
        // Safe because every gap is flanked by active segments, so a boundary is never orphaned.
        if (isGap ? (t <= sp.seg.startTs || t >= sp.seg.endTs) : (t < sp.seg.startTs || t > sp.seg.endTs)) continue
        if (!isGap) return uAtTime(t, sp)
        const dur = sp.seg.endTs - sp.seg.startTs
        return dur > 0 ? sp.startU + ((t - sp.seg.startTs) / dur) * (sp.endU - sp.startU) : sp.startU
      }
      // Only reachable for a time outside [minTs, maxTs]; the caller clamps those to a window edge.
      return t < minTs ? allSpans[0].startU : allSpans[allSpans.length - 1].endU
    }

    for (const f of factors) {
      // Does this factor actually overlap the window's own time span? The clip-to-edge rule below is
      // written for a factor that STRADDLES a window boundary, and it is wrong for one that lies
      // wholly outside the events — which is reachable, because a window claims out to the seam
      // midpoints (and the outermost windows to infinity) so a factor dated before the first event
      // or after the last still lands here.
      //
      // Applied to a non-overlapping factor the straddle rule misbehaves twice over. A range gets
      // one end pinned to the viewport edge and the other to the content edge, manufacturing
      // `edgePad` px of apparent extent — a 5-day range drawn as a 72px slab. And a POINT, whose
      // startTs and endTs are the same instant, sends those two identical timestamps down different
      // branches, landing the hairline at neither (at the raw viewport edge, x=0, where two
      // different out-of-range points also coincide exactly and merge with any band beside them).
      //
      // The axis simply has no room beyond its first and last event: every instant outside maps to
      // the same edge. So collapse a non-overlapping factor to a single mark there and be honest
      // about it, rather than inventing extent the scale cannot express. uAtAnyTime already returns
      // precisely that content edge for an out-of-range time, and returns it for BOTH endpoints.
      const overlaps = f.endTs >= minTs && f.startTs <= maxTs
      let bandLeft: number
      let bandWidth: number
      if (!overlaps) {
        bandLeft  = toX(uAtAnyTime(f.startTs))
        bandWidth = f.isPoint ? 0 : 1
      } else {
        // Clip per window. A factor reaching past this window's own span runs to the VIEWPORT edge
        // rather than stopping at edgePad, so a range crossing a window boundary reads as continuous
        // across the two views. No continuation marker — the band touching the edge is the signal.
        const xRight = f.startTs < minTs ? xHi : toX(uAtAnyTime(f.startTs))
        const xLeft  = f.endTs   > maxTs ? xLo : toX(uAtAnyTime(f.endTs))
        bandLeft  = Math.min(xLeft, xRight)
        bandWidth = f.isPoint ? 0 : Math.max(1, Math.abs(xRight - xLeft))
      }

      // Chip edge clamp. Centring the chip on the band is not enough on its own: a band clipped to a
      // window edge is only `edgePad` wide, and on a short-label page edgePad is the EDGE_PAD floor
      // of 72 — narrower than the 88px chip — so the centred chip hangs ~8px past the edge and the
      // viewport's overflow:hidden shears it. Event labels never hit this because layoutRange widens
      // edgePad to half the widest label; but that reservation is derived from EVENTS only, and it
      // cannot cover factors anyway, whose band is deliberately pushed TO the edge when clipped. So
      // factors get an explicit clamp, which is the same guarantee event labels already enjoy.
      //
      // The right bound also clears the strip caption, which shares the chip row at the window's
      // right edge. Reserved in every window because the caption rides whichever window is on screen.
      const captionW = measureText(FACTOR_STRIP_LABEL, FACTOR_CAPTION_FONT, FACTOR_CAPTION_FALLBACK_W)
      const chipW  = factorChipWidth(f.label)
      const chipLo = xLo + FACTOR_EDGE_GAP
      const chipHi = xHi - FACTOR_EDGE_GAP - captionW - FACTOR_EDGE_GAP - chipW
      // max(lo, …) last so an impossibly narrow window degrades to "flush left" rather than inverting.
      const chipX = Math.max(chipLo, Math.min(bandLeft + bandWidth / 2 - chipW / 2, chipHi))

      factorMarks.push({
        id: f.id,
        label: f.label,
        xLeft: bandLeft,
        // A point stays 0-wide (drawn as a hairline). A range that compresses to sub-pixel width
        // still gets 1px so it cannot vanish — the whole point of the exemption.
        width: bandWidth,
        chipX,
        chipW,
        chipLane: 0,   // assigned by a global sweep in buildLayout, once all windows are laid out
      })
    }
  }

  for (const sp of best.segSpans) {
    const dur = sp.seg.endTs - sp.seg.startTs
    if (dur <= 0) continue
    if (scale === 'months') {
      const segEnd = new Date(sp.seg.endTs)
      const cur = new Date(sp.seg.startTs)
      cur.setDate(1); cur.setMonth(cur.getMonth() + 1)
      while (cur <= segEnd) {
        scaleTicks.push({ xLeft: toX(uAtTime(cur.getTime(), sp)), label: heMonthYear(cur.getTime()) })
        cur.setMonth(cur.getMonth() + 1)
      }
    } else {
      const step = 3_600_000
      let cur = Math.ceil(sp.seg.startTs / step) * step
      while (cur <= sp.seg.endTs) {
        scaleTicks.push({ xLeft: toX(uAtTime(cur, sp)), label: fmtTime(cur) })
        cur += step
      }
    }
  }

  return { events, gapBreaks, scaleTicks, factorMarks }
}

function buildLayout(
  data: TimelineData, scale: TimelineScale, viewportW: number, partition: WindowPartition,
): Layout {
  const allRaw = toRawEvents(data, scale)

  if (allRaw.length === 0) {
    // No events → no axis, so there is nothing for a factor to be context FOR, and nothing to
    // position it against. Matches the editor's own rule that the section only appears once at
    // least one event exists.
    return {
      canvasWidth: viewportW, canvasH: BASE_CANVAS, spineY: BASE_SPINE, windowCount: 1,
      events: [], gapBreaks: [], scaleTicks: [], meetingConnectors: [],
      factorMarks: [], factorStripY: 0, dataWarnings: [],
      hasEnemyBank: data.enemyEvents.length > 0,
    }
  }

  // Window assignment is computed by partitionWindows() and passed in, so the caller can size
  // its gutters from the same windowCount the layout will use (window 0 = earliest → rightmost).
  const { windowOfId, windowCount } = partition
  const canvasWidth = windowCount * viewportW

  const evsByWindow: RawEvent[][] = []
  for (let w = 0; w < windowCount; w++) evsByWindow.push(allRaw.filter(e => windowOfId.get(e.id) === w))

  // Which window does a factor belong to? Events answer this by id (windowOfId); factors have no id
  // in that map, so the answer has to come from time. Each window's OWN span is [minTs, maxTs] of its
  // events — but consecutive windows are separated by a seam of time no window covers, and a factor
  // landing in a seam would then render nowhere. So each window claims out to the midpoint of the
  // seam on either side, and the outermost windows claim to infinity. The claims tile the whole axis,
  // which is what makes "a factor is never silently dropped" true by construction rather than by luck.
  // (Factors outside the timeline's OVERALL span are a different matter — toRawFactors drops those,
  // because no window can place them and the editor warns about them instead.)
  const winSpans = evsByWindow.map(evs => {
    if (evs.length === 0) return null
    const tss = evs.map(e => e.ts)
    return { minTs: Math.min(...tss), maxTs: Math.max(...tss) }
  })
  const rawFactors = toRawFactors(data, timelineSpan([...data.enemyEvents, ...data.friendlyEvents]))
  const factorsForWindow = (w: number): RawFactor[] => {
    const own = winSpans[w]
    if (!own || rawFactors.length === 0) return []
    let claimLo = -Infinity
    for (let p = w - 1; p >= 0; p--) {
      if (winSpans[p]) { claimLo = (winSpans[p]!.maxTs + own.minTs) / 2; break }
    }
    let claimHi = Infinity
    for (let n = w + 1; n < windowCount; n++) {
      if (winSpans[n]) { claimHi = (own.maxTs + winSpans[n]!.minTs) / 2; break }
    }
    return rawFactors.filter(f => f.endTs >= claimLo && f.startTs <= claimHi)
  }

  const events: PositionedEvent[] = []
  const gapBreaks: GapBreak[] = []
  const scaleTicks: ScaleTick[] = []
  const factorMarks: FactorMark[] = []
  for (let w = 0; w < windowCount; w++) {
    const winEvs = evsByWindow[w]
    if (winEvs.length === 0) continue
    // Window w occupies canvas [canvasWidth-(w+1)·viewportW, canvasWidth-w·viewportW]; w=0 is rightmost.
    const xHi = canvasWidth - w * viewportW
    const xLo = canvasWidth - (w + 1) * viewportW
    // Edge clearance grows with this window's widest label so an edge label never spills into the
    // side panels; a short-label window keeps the original EDGE_PAD (its labels don't reach further).
    const winMaxLabelW = winEvs.reduce((m, e) => Math.max(m, effLabelWidth(e.label)), LABEL_BOX_W)
    const edgePad = Math.max(EDGE_PAD, winMaxLabelW / 2 + EDGE_LABEL_GAP)
    const r = layoutRange(winEvs, scale, xLo, xHi, edgePad, factorsForWindow(w))
    events.push(...r.events)
    gapBreaks.push(...r.gapBreaks)
    scaleTicks.push(...r.scaleTicks)
    // One mark per (factor, window) slice — a range crossing a boundary is drawn in both.
    for (const fm of r.factorMarks) factorMarks.push({ ...fm, id: `${fm.id}@${w}` })
  }

  // Chip lanes — same greedy rule the event labels and meeting chips use: take the lowest lane whose
  // last occupant is far enough away. Factor chips stack DOWNWARD from the strip; upward would
  // collide with the friendly bank's labels. Three things make this differ from the event-label sweep:
  //
  //  • It runs on the CLAMPED chip position, not the band centre. Two bands far enough apart to look
  //    safe can both be clamped toward the same edge; judging them by their bands would then stack
  //    them on one lane on top of each other.
  //  • Chips vary in width, so the test is a real box overlap against the nearest occupant rather
  //    than one fixed centre-to-centre distance.
  //  • Swept right to left (chronological in RTL), so a lane's last occupant is always the chip
  //    immediately to the right — which is what makes a single `laneLastLeft` per lane sufficient.
  {
    const laneLastLeft: number[] = []
    for (const fm of [...factorMarks].sort((a, b) => (b.chipX + b.chipW) - (a.chipX + a.chipW))) {
      let lane = 0
      while (lane < laneLastLeft.length && fm.chipX + fm.chipW + FACTOR_EDGE_GAP > laneLastLeft[lane]) lane++
      fm.chipLane = lane
      laneLastLeft[lane] = fm.chipX
    }
  }

  // Lane assignment per axis: take the lowest lane whose last occupant is ≥ LABEL_BOX_W away.
  //
  // This subsumes two cases in one rule. Distinct-but-near timestamps alternate exactly as the
  // old pairwise flip did (uniform spacing below the box width still yields 0,1,0,1…). And events
  // sharing ONE timestamp — which by construction receive an identical xLeft, distance 0 — cascade
  // to 0,1,2,…N-1, so N same-axis events at the same instant radiate as N stems from a single
  // spine point instead of stacking on top of each other. Same-instant-is-one-point is preserved
  // (x is untouched); only y differs. בו-זמני is unaffected: that pairs across axes, this is
  // within one. Checking actual lane occupancy rather than just the previous event also closes
  // the old 3-in-a-row hole, where lane 0 could be reused while still inside a label width.
  //
  // ACCEPTED LIMITATION — lane depth is unbounded. N same-axis events on one timestamp produce N
  // lanes, and since spineY/canvasH are derived from the deepest lane, the section grows in
  // proportion: the synthetic 12-deep fixture (page 14) renders a 668px-tall canvas. This is
  // deliberate, not an oversight. No realistic dataset reaches it — a topic page logging a handful
  // of events on one date stays a few lanes deep — and every alternative costs more than it saves
  // at that size. If real data ever does reach it, the fix is a capped visible height with
  // internal scroll on the timeline section, NOT a collapse capsule or click-to-expand: the
  // design README rules both of those out, and they would also break the "every event renders
  // with a visible label" guarantee the spacing floor exists to uphold.
  //
  // Lane depth is no longer the ONLY driver of canvas height: an enemy column can additionally be
  // lifted (labelLift, assigned further below) to clear a meeting-chip stack rising beneath it, and
  // that lift also feeds spineY via `deepestEnemyReach`. So the enemy bank's height is stemFor(lane)
  // + labelLift, whichever column reaches highest — same unbounded-by-design stance, two inputs now.
  // Same first-free-lane scan as before; only the collision WIDTH changed from a fixed LABEL_BOX_W to
  // each label's real box width. Two centred boxes overlap when their centres are closer than the mean
  // of their half-widths summed — i.e. (wLast + wCur) / 2. When every label is ≤ LABEL_BOX_W this mean
  // is exactly LABEL_BOX_W, reproducing the old test bit-for-bit; wider real labels push to a new lane.
  for (const axis of ['enemy', 'friendly'] as const) {
    const ax = events.filter(e => e.axis === axis).sort((a, b) => b.xLeft - a.xLeft)
    const laneLastX: number[] = []
    const laneLastW: number[] = []
    for (const e of ax) {
      let lane = 0
      while (laneLastX[lane] !== undefined &&
             Math.abs(laneLastX[lane] - e.xLeft) < (laneLastW[lane] + e.labelWidth) / 2) lane++
      e.lane = lane
      laneLastX[lane] = e.xLeft
      laneLastW[lane] = e.labelWidth
    }
  }

  // Meeting connectors + delta annotation on responding events
  const evMap = new Map(events.map(e => [e.event.id, e]))
  const meetingConnectors: MeetingConnector[] = []

  // ACCEPTED DESIGN — same-timestamp cross-axis coincidence is left to read as-is. Two unrelated
  // events on opposite axes that share a timestamp land at the same x purely from layout math, which
  // can look like a declared בו-זמני clash even when no meeting point was declared. We deliberately do
  // NOT nudge them apart: same time genuinely IS the same x, and a declared relationship never relies
  // on x-alignment alone to announce itself — it always carries an explicit chip + connector line
  // (built just below), which are the sole authoritative signal for "declared." Bare alignment with
  // no chip therefore reads as coincidence, and staggering x would sacrifice temporal truth to solve
  // a problem the chip already solves. FUTURE CANDIDATE (deferred, not built): port the editor's
  // hover-highlight into the viewer so hovering an event lights up only its declared meeting-point
  // partner — letting a reader confirm "is this a real clash?" on demand without altering the layout.

  // Collected data-integrity problems, logged once per data change by the component (see effect).
  const dataWarnings: { message: string; detail: Record<string, unknown> }[] = []

  // The same event pair declared as BOTH תגובה and בו-זמני is an analytical contradiction, not
  // cosmetic redundancy.
  const kindsByPair = new Map<string, Set<string>>()
  for (const mp of (data.meetingPoints ?? [])) {
    const key = `${mp.enemyEventId}|${mp.friendlyEventId}`
    if (!kindsByPair.has(key)) kindsByPair.set(key, new Set())
    kindsByPair.get(key)!.add(mp.kind)
  }
  for (const [key, kinds] of kindsByPair) {
    if (kinds.size > 1) {
      const [enemyEventId, friendlyEventId] = key.split('|')
      dataWarnings.push({
        message: '[Timeline] נקודות מפגש סותרות: אותו זוג אירועים מוגדר גם כתגובה וגם כבו-זמני',
        detail: { enemyEventId, friendlyEventId },
      })
    }
  }

  // The inline date-label delta is only meaningful when a friendly event responds to exactly one
  // enemy event. With reuse allowed, a friendly event can be the target of several תגובה links — a
  // single inline "+N" would be ambiguous ("which response?"), so it's applied only when the count
  // is 1; the per-connector chips still carry every delta unambiguously.
  const deltaByFriendly = new Map<string, { text: string; count: number }>()

  for (const mp of (data.meetingPoints ?? [])) {
    const eEv = evMap.get(mp.enemyEventId)
    const fEv = evMap.get(mp.friendlyEventId)

    // An analyst-declared meeting point that references a missing or mis-sided event is a data
    // error, not a rendering case. Skipping is still the right render behaviour, but it must be
    // audible — a silently vanished declaration is indistinguishable from one never made.
    if (!eEv || !fEv) {
      dataWarnings.push({
        message: `[Timeline] נקודת מפגש "${mp.id}" מדלגת: מזהה אירוע לא נמצא`,
        detail: { enemyEventId: mp.enemyEventId, friendlyEventId: mp.friendlyEventId, foundEnemy: !!eEv, foundFriendly: !!fEv },
      })
      continue
    }
    if (eEv.axis !== 'enemy' || fEv.axis !== 'friendly') {
      dataWarnings.push({
        message: `[Timeline] נקודת מפגש "${mp.id}" מדלגת: הצירים אינם תואמים`,
        detail: { enemyEventId: mp.enemyEventId, actualAxis: eEv.axis, friendlyEventId: mp.friendlyEventId, actualFriendlyAxis: fEv.axis },
      })
      continue
    }

    const delta = Math.abs(parseTs(fEv.event.timestamp, scale) - parseTs(eEv.event.timestamp, scale))
    const deltaText = scale === 'months'
      ? `+${Math.round(delta / 86_400_000)} ימים`
      : `+${Math.round(delta / 60_000)} דק׳`
    const chipLabel = mp.kind === 'תגובה' ? `תגובה · ${deltaText}` : 'בו-זמני'
    meetingConnectors.push({ mp, enemyX: eEv.xLeft, friendlyX: fEv.xLeft, chipLabel, chipLane: 0 })

    // Tally per friendly event; assigned below only when it responded to exactly one enemy event.
    if (mp.kind === 'תגובה') {
      const prev = deltaByFriendly.get(fEv.event.id)
      deltaByFriendly.set(fEv.event.id, { text: deltaText, count: (prev?.count ?? 0) + 1 })
    }
  }
  for (const [fid, { text, count }] of deltaByFriendly) {
    if (count === 1) {
      const fe = evMap.get(fid)
      if (fe) fe.deltaLabel = text
    }
  }

  // Chip collision avoidance: two meeting points whose midpoints sit within a chip-width would
  // overlap (e.g. one friendly event responded to by two enemies at nearly the same x). Assign each
  // chip the lowest lane whose last occupant is far enough away — the same rule as event labels —
  // and the renderer stacks higher lanes upward off the spine.
  const chipMid = (mc: MeetingConnector) => (mc.enemyX + mc.friendlyX) / 2
  const chipLaneLastX: number[] = []
  for (const mc of [...meetingConnectors].sort((a, b) => chipMid(b) - chipMid(a))) {
    const mid = chipMid(mc)
    let lane = 0
    while (chipLaneLastX[lane] !== undefined && Math.abs(chipLaneLastX[lane] - mid) < CHIP_COLLIDE_W) lane++
    mc.chipLane = lane
    chipLaneLastX[lane] = mid
  }

  // Chip stacks rise off the spine INTO the enemy-label band above it (both grow upward from the
  // spine), and the two systems size independently — so a stack ≥ 2 deep would climb over the
  // innermost enemy labels, whose opaque chips then hide the label entirely. Coordinate them: for
  // each enemy column (events sharing an x), find the tallest chip stack whose box overlaps it and
  // lift the WHOLE column by one uniform amount so its lane-0 label clears the stack top. Uniform
  // per column is essential — lifting lower lanes more than higher ones would collapse them together.
  // Chips never rise on the friendly side, so friendly labels are untouched. A column with no
  // overlapping stack (every existing page) keeps labelLift 0, so its geometry is unchanged.
  const enemyByX = new Map<number, PositionedEvent[]>()
  for (const e of events) {
    if (e.axis !== 'enemy') continue
    if (!enemyByX.has(e.xLeft)) enemyByX.set(e.xLeft, [])
    enemyByX.get(e.xLeft)!.push(e)
  }
  for (const [x, col] of enemyByX) {
    let topLane = -1
    for (const mc of meetingConnectors) {
      // A chip and a label are each ~LABEL_BOX_W wide; centres within one box-width overlap.
      if (Math.abs(chipMid(mc) - x) < LABEL_BOX_W) topLane = Math.max(topLane, mc.chipLane)
    }
    if (topLane < 0) continue
    // The topmost overlapping chip's TOP edge sits (10 + topLane·CHIP_LANE_STEP) above the spine; the
    // lane-0 label's stem must reach that far plus a gap. Higher lanes share the same lift and stay
    // spaced by LANE_STEP, so intra-column separation is preserved.
    const lift = Math.max(0, 10 + topLane * CHIP_LANE_STEP + CHIP_LABEL_GAP - SHORT_STEM)
    for (const e of col) e.labelLift = lift
  }

  // Grow the canvas only as far as the deepest stack needs. A timeline using ≤ 2 lanes per bank
  // (and no chip stack lifting a column) lands on BASE_SPINE / BASE_CANVAS exactly, so nothing that
  // fit before shifts by a pixel.
  const enemyReach = (e: PositionedEvent) => stemFor(e.lane) + (e.labelLift ?? 0)
  const deepestEnemyReach = events.reduce((m, e) => (e.axis === 'enemy' && enemyReach(e) > m ? enemyReach(e) : m), 0)
  const deepestFriendlyLane = events.reduce((m, e) => (e.axis === 'friendly' && e.lane > m ? e.lane : m), 0)
  // A page can legitimately have NO צד ב׳ at all (its infoGrid says so). Reserving the usual bank
  // above the spine would then show an empty labelled lane, which reads as missing data rather than
  // "there was no second side" — so the space above the spine collapses to a small pad and the
  // legend entry is dropped (see the legend's `hasEnemyBank` guard). Nothing renders above the
  // spine in that case: no dots, no stems, and no meeting points either, since a meeting point
  // needs one event from each bank. The BASE_CANVAS floor goes with it, or the bank would just
  // become empty space at the bottom instead of the top.
  //
  // Only the צד ב׳ side is collapsed. The mirror case (an empty צד א׳ bank) keeps its original
  // geometry because no page in the dataset produces one, so that path is unverified.
  const hasEnemyBank = data.enemyEvents.length > 0
  const spineY = hasEnemyBank
    ? Math.max(BASE_SPINE, deepestEnemyReach + LABEL_BLOCK_H + 4)
    : EMPTY_BANK_TOP_PAD
  const bankH = Math.max(
    hasEnemyBank ? BASE_CANVAS : 0,
    spineY + stemFor(deepestFriendlyLane) + 10 + LABEL_BLOCK_H + 8,
  )

  // The factor strip is ADDED height below the friendly bank, not space borrowed from it. There is
  // none to borrow: spineY and bankH are already derived tight against the deepest lane. A timeline
  // with no factors keeps exactly the height it had before this feature existed.
  const deepestFactorLane = factorMarks.reduce((m, f) => Math.max(m, f.chipLane), 0)
  const factorStripY = factorMarks.length > 0 ? bankH : 0
  const canvasH = factorMarks.length > 0
    ? bankH + FACTOR_STRIP_H + deepestFactorLane * CHIP_LANE_STEP
    : bankH

  return {
    canvasWidth, canvasH, spineY, windowCount, events, gapBreaks, scaleTicks, meetingConnectors,
    factorMarks, factorStripY, dataWarnings, hasEnemyBank,
  }
}

// ── TimelineHeader ────────────────────────────────────────────────────────────
function TimelineHeader({ layout, windowIndex, scale, pageType, allVisible = false }: {
  layout: Layout; windowIndex: number; scale: TimelineScale; pageType: string
  /** Narrow/scrolling mode: every event is reachable, so the header describes the whole span
   *  rather than one window — otherwise it would claim "showing Jan–Apr" while the reader can
   *  scroll to December. */
  allVisible?: boolean
}) {
  const { canvasWidth, windowCount, events } = layout
  const windowW    = canvasWidth / windowCount
  const scrollLeft = canvasWidth - (windowIndex + 1) * windowW
  const vis = allVisible
    ? events
    : events.filter(e => e.xLeft >= scrollLeft && e.xLeft < scrollLeft + windowW)
  const tsArr = vis.map(e => parseTs(e.event.timestamp, scale)).sort((a, b) => a - b)

  let rangeLabel = ''
  if (tsArr.length >= 1 && scale === 'months') {
    const first = heMonth(tsArr[0])
    const last  = heMonth(tsArr[tsArr.length - 1])
    const yr    = new Date(tsArr[tsArr.length - 1]).getFullYear()
    rangeLabel = first === last ? `${first} ${yr}` : `${first}–${last} ${yr}`
  } else if (tsArr.length >= 1 && scale === 'hours') {
    rangeLabel = `${fmtTime(tsArr[0])}–${fmtTime(tsArr[tsArr.length - 1])}`
  }

  const positionLabel = allVisible
    ? 'ניתן לגלול לצדדים'
    : (windowIndex === 0 ? 'תחילת האירועים' : `המשך — חלון ${windowIndex + 1}`)

  return (
    // [&>span]:whitespace-nowrap keeps each piece of the header atomic: the row may wrap
    // between pieces, but "4 אירועים" no longer breaks across two lines in a 45px sliver.
    <div className="text-[11px] text-muted-foreground font-heebo select-none flex flex-wrap items-baseline [&>span]:whitespace-nowrap" dir="rtl">
      <span className="font-semibold text-foreground/80">{pageType}</span>
      {rangeLabel && (
        <>
          <span className="mx-1 text-muted-foreground/40">·</span>
          <span>מציג: {rangeLabel}</span>
          <span className="mx-1 text-muted-foreground/40">—</span>
          <span>{positionLabel}</span>
          <span className="mx-1 text-muted-foreground/40">·</span>
          <span>
            {windowCount > 1 && !allVisible
              ? `${vis.length} מתוך ${events.length} אירועים`
              : `${events.length} אירועים`}
          </span>
        </>
      )}
    </div>
  )
}

// ── TimelineMinimap ───────────────────────────────────────────────────────────
// KNOWN v1 GAP — influencing factors are deliberately NOT drawn here. This is a second, independent
// render path (its own 40px geometry, its own spineY, its own scale) and showing factors in it was
// scoped out of the first pass rather than overlooked. It matters more than it sounds: the minimap is
// how an analyst finds which window to jump to, so a factor is currently discoverable only by paging
// through the windows. Worth revisiting if factors get used heavily on multi-window pages.
function TimelineMinimap({ layout, windowIndex, containerWidth, onWindowChange }: {
  layout: Layout; windowIndex: number; containerWidth: number; onWindowChange: (i: number) => void
}) {
  const { canvasWidth, windowCount, events } = layout
  if (windowCount <= 1) return null

  const mw = containerWidth
  const sc = mw / canvasWidth
  const windowW    = canvasWidth / windowCount
  const scrollLeft = canvasWidth - (windowIndex + 1) * windowW
  const hlX = scrollLeft * sc
  const hlW = windowW * sc
  const spineY = MINIMAP_H / 2

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    // Rightmost portion = window 0 (earliest). wi increases as x decreases.
    const wi = Math.max(0, Math.min(windowCount - 1, Math.floor(windowCount * (1 - x / mw))))
    onWindowChange(wi)
  }

  return (
    <div
      className="relative mb-3 rounded border border-[#C8D8E0] bg-[#F7FBFD] overflow-hidden select-none cursor-pointer"
      style={{ height: MINIMAP_H, width: mw }}
      dir="ltr"
      onClick={handleClick}
    >
      {/* spine */}
      <div className="absolute bg-[#C8D8E0]" style={{ left: 0, right: 0, top: spineY - 0.5, height: 1 }} />
      {/* density ticks — thin vertical marks, colored by axis */}
      {events.map(e => {
        const x = e.xLeft * sc
        const top  = e.axis === 'enemy' ? spineY - 13 : spineY + 1
        return (
          <div key={e.event.id} className="absolute"
            style={{ left: x, top, width: 1.5, height: 12, background: e.color, opacity: 0.7 }} />
        )
      })}
      {/* highlighted window rectangle */}
      <div className="absolute top-0 bottom-0 bg-[#21AEFF]/15 border-x border-[#21AEFF]/50"
        style={{ left: hlX, width: Math.max(hlW, 4) }} />
    </div>
  )
}

// ── TimelineCanvas ────────────────────────────────────────────────────────────
// viewLeft/viewRight are the current window's bounds in canvas coordinates. HTML text
// labels render only when their anchor x is within them, so a wide (88px) centered label
// box belonging to an adjacent window can't bleed a clipped fragment past the viewport edge.
// The SVG layer (spine/dots/stems) still spans the whole canvas — thin marks don't bleed.
function TimelineCanvas({ layout, scale, viewLeft, viewRight }: {
  layout: Layout; scale: TimelineScale; viewLeft: number; viewRight: number
}) {
  const { canvasWidth, canvasH, spineY, events, gapBreaks, scaleTicks, meetingConnectors } = layout
  const { factorMarks, factorStripY } = layout
  const enemyEvents    = events.filter(e => e.axis === 'enemy')
  const friendlyEvents = events.filter(e => e.axis === 'friendly')
  const evMap = new Map(events.map(e => [e.event.id, e]))

  const inView = (x: number) => x >= viewLeft && x < viewRight

  // A declared meeting point announces itself with chip AND connector TOGETHER — see the ACCEPTED
  // DESIGN note in buildLayout: the pair is the only authoritative "declared" signal, and bare
  // x-alignment with no chip is meant to read as coincidence. The chip is an 88px CENTRED HTML box,
  // so it is gated by inView() to stop a clipped fragment bleeding past the window edge into the
  // side panels. The connector, a thin SVG mark, was NOT gated — so a connector could appear with
  // its chip missing, i.e. exactly the "looks declared but isn't" state the design rules out.
  //
  // Both now use the chip's rule. That keeps the edge-clipping protection byte-for-byte (it hides
  // more, never less — the alternative, always drawing the chip, would reintroduce the clipping).
  // Nothing fully visible is lost: the window is a contiguous interval, so if both endpoints are
  // inside it the midpoint is too; a midpoint outside implies an endpoint outside already.
  const visibleConnectors = meetingConnectors.filter(mc => inView((mc.enemyX + mc.friendlyX) / 2))

  function stemTip(e: PositionedEvent) {
    const stem = stemFor(e.lane) + (e.axis === 'enemy' ? (e.labelLift ?? 0) : 0)
    return e.axis === 'enemy' ? spineY - stem : spineY + stem
  }

  return (
    <div className="relative" style={{ height: canvasH, width: canvasWidth }} dir="ltr">
      {/* ── SVG layer ── */}
      <svg className="absolute inset-0 pointer-events-none" width={canvasWidth} height={canvasH}>
        {/* Influencing factors — background layer, FIRST so every spine, stem, dot and connector
            paints over it. Full canvas height: this is the one mark that must not be occluded, and
            an element that spans the whole plot cannot be hidden behind a bank. */}
        {factorMarks.map(f => (
          f.width > 0
            ? <rect key={f.id} x={f.xLeft} y={0} width={f.width} height={canvasH} fill={FACTOR_TINT} />
            : <rect key={f.id} x={f.xLeft} y={0} width={1} height={canvasH}
                fill={FACTOR_LINE_COLOR} opacity={FACTOR_LINE_OPACITY} />
        ))}

        {/* Spine */}
        <line x1={0} y1={spineY} x2={canvasWidth} y2={spineY} stroke={SPINE_COLOR} strokeWidth={1} />

        {/* White rectangles interrupt the spine inside gap zones */}
        {gapBreaks.map(gb => (
          <rect key={gb.range} x={gb.xLeft} y={spineY - 1} width={gb.width} height={3} fill="white" />
        ))}

        {/* Event stems */}
        {enemyEvents.map(e => (
          <line key={e.event.id} x1={e.xLeft} y1={spineY - DOT_R} x2={e.xLeft}
            y2={spineY - stemFor(e.lane) - (e.labelLift ?? 0)}
            stroke={ENEMY_COLOR} strokeWidth={1} />
        ))}
        {friendlyEvents.map(e => (
          <line key={e.event.id} x1={e.xLeft} y1={spineY + DOT_R} x2={e.xLeft}
            y2={spineY + stemFor(e.lane)}
            stroke={FRIENDLY_COLOR} strokeWidth={1} />
        ))}

        {/* Meeting point connectors — same visibility rule as their chips (see visibleConnectors) */}
        {visibleConnectors.map(mc => {
          const eEv = evMap.get(mc.mp.enemyEventId)!
          const fEv = evMap.get(mc.mp.friendlyEventId)!
          const isClash = mc.mp.kind === 'בו-זמני'
          return (
            <line key={mc.mp.id}
              x1={mc.enemyX}    y1={stemTip(eEv)}
              x2={mc.friendlyX} y2={stemTip(fEv)}
              stroke={isClash ? CONNECTOR_CLASH_COLOR : CONNECTOR_RESPONSE_COLOR}
              strokeWidth={1.5}
              strokeDasharray={isClash ? undefined : '4 3'}
            />
          )
        })}

        {/* Scale ticks below spine */}
        {scaleTicks.map(tick => (
          <line key={`${tick.label}@${Math.round(tick.xLeft)}`}
            x1={tick.xLeft} y1={spineY + 1} x2={tick.xLeft} y2={spineY + 10}
            stroke={SPINE_COLOR} strokeWidth={1} />
        ))}

        {/* Event dots — rendered last so they sit on top */}
        {events.map(e => (
          <circle key={e.event.id} cx={e.xLeft} cy={spineY} r={DOT_R} fill={e.color} />
        ))}
      </svg>

      {/* ── HTML overlay ── */}

      {/* Enemy event labels (above spine) — labelLift clears a chip stack rising beneath the column */}
      {enemyEvents.map(e => {
        if (!inView(e.xLeft)) return null
        const ts = scale === 'months' ? fmtDate(e.event.timestamp) : fmtTime(parseTs(e.event.timestamp, scale))
        const stemLen = stemFor(e.lane) + (e.labelLift ?? 0)
        // Bounded font step: only the longest labels (beyond a two-line box) drop to the smaller size.
        const small = measureLabelWidth(e.event.label) > LABEL_WRAP2_W
        return (
          <div key={e.event.id} className="absolute text-center pointer-events-none select-none"
            style={{ left: e.xLeft - e.labelWidth / 2, top: spineY - stemLen - 38, width: e.labelWidth }}>
            <p className="text-[11px] font-bold leading-none mb-0.5 font-heebo" style={{ color: ENEMY_COLOR }}>{ts}</p>
            <p className={`${small ? 'text-[11px]' : 'text-[12.5px]'} font-semibold leading-tight text-foreground font-heebo`}>{e.event.label}</p>
          </div>
        )
      })}

      {/* Friendly event labels (below spine) — delta inline in date when תגובה response */}
      {friendlyEvents.map(e => {
        if (!inView(e.xLeft)) return null
        const ts = scale === 'months' ? fmtDate(e.event.timestamp) : fmtTime(parseTs(e.event.timestamp, scale))
        const dateStr = e.deltaLabel ? `${ts} · ${e.deltaLabel}` : ts
        const stemLen = stemFor(e.lane)
        const small = measureLabelWidth(e.event.label) > LABEL_WRAP2_W
        return (
          <div key={e.event.id} className="absolute text-center pointer-events-none select-none"
            style={{ left: e.xLeft - e.labelWidth / 2, top: spineY + stemLen + 10, width: e.labelWidth }}>
            <p className="text-[11px] font-bold leading-snug mb-0.5 font-heebo" style={{ color: FRIENDLY_COLOR }}>{dateStr}</p>
            <p className={`${small ? 'text-[11px]' : 'text-[12.5px]'} font-semibold leading-tight text-foreground font-heebo`}>{e.event.label}</p>
          </div>
        )
      })}

      {/* Gap breaks — ⌇⌇ glyph on the spine; two-line dashed pill (text / date range) just below it,
          narrow enough to stay within the break zone. Staggers above only when two gaps are close. */}
      {(() => {
        let prevCenter = Infinity
        let prevBelow  = false
        return gapBreaks.map(gb => {
          const centerX = gb.xLeft + gb.width / 2
          const near    = prevCenter - centerX < 120
          // The "above the spine" slot sits at spineY - 42. When a bank is empty the spine is
          // collapsed to EMPTY_BANK_TOP_PAD (16), so that slot is off the top of the canvas and
          // the label is clipped. Below the clearance the label always goes BELOW the spine.
          const roomAbove = spineY >= 52
          const below   = !roomAbove ? true : (near ? !prevBelow : true)
          prevCenter = centerX
          prevBelow  = below
          if (!inView(centerX)) return null
          return (
            <div key={gb.range} className="pointer-events-none select-none">
              <span className="absolute text-muted-foreground/60 text-sm leading-none tracking-tighter"
                style={{ left: centerX, top: spineY - 8, transform: 'translateX(-50%)' }}>
                ⌇⌇
              </span>
              <span className="absolute flex flex-col items-center text-[10px] text-muted-foreground border border-dashed border-muted-foreground/30 rounded-xl bg-white px-2.5 py-0.5 font-heebo leading-none text-center"
                dir="rtl"
                style={{ left: centerX, top: below ? spineY + 13 : spineY - 42, transform: 'translateX(-50%)' }}>
                <span className="whitespace-nowrap">{gb.text}</span>
                <span dir="ltr" className="whitespace-nowrap">{gb.range}</span>
              </span>
            </div>
          )
        })
      })()}

      {/* Meeting point spine chips — chipLane stacks overlapping chips upward off the spine */}
      {visibleConnectors.map(mc => {
        const midX    = (mc.enemyX + mc.friendlyX) / 2
        const isClash = mc.mp.kind === 'בו-זמני'
        return (
          <div key={mc.mp.id} className="absolute pointer-events-none select-none"
            style={{ left: midX - 44, top: spineY - 10 - mc.chipLane * CHIP_LANE_STEP, width: 88 }}>
            <div className="flex justify-center">
              <span className="text-[10px] font-medium border rounded-full px-2 py-0.5 bg-white font-heebo whitespace-nowrap"
                style={{
                  borderColor: isClash ? CONNECTOR_CLASH_COLOR : CONNECTOR_RESPONSE_COLOR,
                  color:       isClash ? CONNECTOR_CLASH_COLOR : CONNECTOR_RESPONSE_COLOR,
                }}>
                {mc.chipLabel}
              </span>
            </div>
          </div>
        )
      })}

      {/* Scale tick labels — nowrap + centered so long month names never wrap into event labels.
          A tick whose x nearly coincides with an event is SKIPPED: the event stem is drawn through
          that band and struck the grey tick text out, and the event label already carries the same
          time. Dropping the tick loses nothing and is the only one of the pair that is redundant. */}
      {scaleTicks.map(tick => (
        inView(tick.xLeft) && !events.some(e => Math.abs(e.xLeft - tick.xLeft) < TICK_EVENT_CLEARANCE) ? (
          <div key={`${tick.label}@${Math.round(tick.xLeft)}`}
            className="absolute text-[10px] text-muted-foreground/70 font-heebo pointer-events-none select-none whitespace-nowrap"
            style={{ left: tick.xLeft, top: spineY + 14, transform: 'translateX(-50%)' }}>
            {tick.label}
          </div>
        ) : null
      ))}

      {/* Influencing-factor label strip — its own row below the friendly bank, so a factor's label
          never competes for the ruler's already-full band around the spine. Always visible: there is
          no hover or click anywhere on this canvas to reveal it with. */}
      {factorStripY > 0 && (
        <>
          <div className="absolute pointer-events-none"
            style={{ left: 0, width: canvasWidth, top: factorStripY, height: 1, background: FACTOR_RULE_COLOR }} />
          {/* Caption rides the window's right edge, not the canvas's — the canvas is windowCount
              viewports wide and translates, so a canvas-anchored caption would show in window 0 only. */}
          <div dir="rtl"
            className="absolute text-[10px] font-heebo pointer-events-none select-none whitespace-nowrap"
            style={{
              left: viewRight - FACTOR_EDGE_GAP, top: factorStripY + 11,
              transform: 'translateX(-100%)', color: FACTOR_CAPTION_COLOR,
            }}>
            {FACTOR_STRIP_LABEL}
          </div>
          {factorMarks.map(f => {
            // Visibility is decided by the BAND, placement by the clamped chip — a band sitting in
            // this window must show its label even when the clamp has shifted the chip inward.
            if (!inView(f.xLeft + f.width / 2)) return null
            return (
              <div key={f.id} className="absolute pointer-events-none select-none"
                style={{
                  left: f.chipX, width: f.chipW,
                  top: factorStripY + FACTOR_CHIP_TOP + f.chipLane * CHIP_LANE_STEP,
                }}>
                <div className="flex justify-center">
                  {/* Same classes as the meeting chip. The inline half is what the design export
                      pins down: an explicit box that ellipsises, plus `flex: none` — without it the
                      chip is a flex item whose min-content width is 0 once overflow is hidden, and
                      flex-shrink collapses it to a bare "…". Meeting chips escape this only because
                      they have no overflow:hidden.
                      The box is f.chipW, not a constant: it grows with the measured label between
                      FACTOR_CHIP_W and FACTOR_CHIP_MAX_W, so ellipsis is the last resort rather than
                      the normal case for any label past 88px. */}
                  <span dir="rtl"
                    className="text-[10px] font-medium border rounded-full px-2 py-0.5 bg-white font-heebo whitespace-nowrap"
                    style={{
                      width: f.chipW, flex: 'none', boxSizing: 'border-box',
                      overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
                      borderColor: FACTOR_CHIP_BORDER, color: FACTOR_CHIP_TEXT,
                    }}>
                    {f.label}
                  </span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Side panel ────────────────────────────────────────────────────────────────
function SidePanel({ children, onClick, width = 64, height, variant = 'active' }: {
  children: React.ReactNode; onClick?: () => void; width?: number; height?: number; variant?: 'active' | 'muted'
}) {
  const Tag = onClick ? 'button' : 'div'
  const cls = variant === 'active'
    ? 'border-[#21AEFF] bg-[#F0F8FF] ' + (onClick ? 'hover:bg-[#DCF5FF]' : '')
    : 'border-dashed border-[#C8D8E0] bg-white/80'
  return (
    <Tag
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center font-heebo transition-colors ${cls} ${onClick ? 'cursor-pointer' : ''}`}
      style={{ width, height }}
      dir="rtl"
    >
      {children}
    </Tag>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────
export function TimelineViewer({ data, scale, pageType = 'דף נושא' }: {
  data: TimelineData; scale: TimelineScale; pageType?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [windowIndex, setWindowIndex] = useState(0)
  // Label widths are measured with canvas measureText. Before the Heebo web font loads, measurements
  // use a fallback metric; once fonts are ready we drop the cache and re-lay-out so widths are exact.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts) return
    let cancelled = false
    fonts.ready.then(() => { if (!cancelled) { clearLabelMeasureCache(); setFontsReady(true) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    // Width only — the viewed window is preserved across resizes and clamped at render instead,
    // so resizing (or a devtools/orientation change) no longer throws the reader back to window 1.
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Window assignment depends only on the events, not on width, so it can be computed before the
  // gutters are sized — and the gutters are then sized from the same windowCount the layout uses.
  // fontsReady is a dep because the density cap measures label widths (re-measure once fonts load).
  const partition = useMemo(
    () => partitionWindows(toRawEvents(data, scale), data.meetingPoints ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scale, fontsReady],
  )

  // Gutters are reserved BESIDE the canvas so nav panels never cover events.
  // Single-window timelines get no gutters at all (README: fits in one window → just the timeline).
  // Narrow containers keep the DESKTOP layout and scroll it, instead of compressing it (see
  // MIN_CANVAS_W). The decision is width-only, so it cannot feed back into the layout it controls.
  // In that mode the window side-panels are replaced by native scrolling — every event stays
  // reachable, and the whole canvas is "in view", so no chip or connector is gated out.
  // Math.ceil is load-bearing: containerWidth comes from ResizeObserver's contentRect, which is
  // fractional (~1005.3 at a 1280px desktop where clientWidth is exactly 1006). A bare `<` — and
  // even Math.round — therefore flipped desktop into scroll mode and changed the header text.
  // Reading it as "if the container, rounded UP to a whole pixel, can hold the desktop canvas,
  // take the desktop path" keeps 1280 on the original path exactly.
  const isNarrow = Math.ceil(containerWidth) < MIN_CANVAS_W
  const isWindowed = partition.windowCount > 1 && !isNarrow
  const viewportW = isNarrow
    ? MIN_CANVAS_W
    : (isWindowed ? containerWidth - LEFT_GUTTER - RIGHT_GUTTER : containerWidth)

  const layout = useMemo(
    () => buildLayout(data, scale, viewportW, partition),
    // fontsReady is a deliberate dep: it forces a re-layout after web fonts load so label widths are
    // re-measured with the real Heebo metrics (the cache was cleared in the effect above).
    [data, scale, viewportW, partition, fontsReady],
  )

  // Log analyst-data-integrity problems (contradictory pairs, meeting points referencing a missing or
  // mis-sided event). Done in an effect, not in the render/layout path: it fires once whenever the SET
  // of problems changes rather than on every re-render, and it carries no cross-render/cross-page
  // state — so it reliably logs in any build (dev AND production) and never silences a real problem
  // after its first appearance the way a module-global dedup Set did. The signature is content-based,
  // so re-ordering is a no-op and each distinct problem is logged.
  const { dataWarnings } = layout
  const warningKey = dataWarnings.map(w => w.message + JSON.stringify(w.detail)).sort().join('||')
  useEffect(() => {
    for (const w of dataWarnings) console.warn(w.message, w.detail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warningKey])

  const { canvasWidth, canvasH, windowCount } = layout
  // Clamp rather than reset: if the data shrinks the window count under the viewed index we fall
  // back to the last window instead of jumping to the first.
  const viewIndex  = Math.min(windowIndex, windowCount - 1)
  const windowW    = canvasWidth / windowCount
  const scrollLeft = canvasWidth - (viewIndex + 1) * windowW
  const hasMore    = viewIndex < windowCount - 1
  const hasPrev    = viewIndex > 0

  const hiddenLeft = layout.events.filter(e => e.xLeft < scrollLeft)
  const moreCount  = hiddenLeft.length

  const moreRange = (() => {
    if (!hiddenLeft.length) return ''
    const tss = hiddenLeft.map(e => parseTs(e.event.timestamp, scale)).sort((a, b) => a - b)
    if (scale === 'months') {
      const first = heMonth(tss[0])
      const last  = heMonth(tss[tss.length - 1])
      return first === last ? first : `${first}–${last}`
    }
    return `${fmtTime(tss[0])}–${fmtTime(tss[tss.length - 1])}`
  })()

  const earliestLabel = (() => {
    if (!layout.events.length) return ''
    const t0 = layout.events.map(e => parseTs(e.event.timestamp, scale)).sort((a, b) => a - b)[0]
    if (scale === 'months') return `${heMonth(t0)} ${new Date(t0).getFullYear()}`
    return fmtTime(t0)
  })()

  return (
    <div ref={containerRef} className="w-full">
      {/* Top row: legend (physically left) + header breadcrumb (physically right) — dir=ltr pins sides in the RTL page */}
      <div className="flex items-center justify-between mb-2" dir="ltr">
        {/* flex-wrap + whitespace-nowrap on each entry: the row may wrap between entries, but an
            entry never wraps inside itself. Squeezed into a 23px column, "ציר צד א׳" had been
            breaking into three lines, one word each. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-heebo" dir="rtl">
          {/* Dropped entirely when the page has no צד ב׳ events — same rule that collapses the
              bank in buildLayout, read from the same `hasEnemyBank` value. */}
          {layout.hasEnemyBank && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block size-2.5 rounded-full" style={{ background: ENEMY_COLOR }} />
              <span className="text-xs font-medium text-muted-foreground">ציר צד ב׳</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block size-2.5 rounded-full" style={{ background: FRIENDLY_COLOR }} />
            <span className="text-xs font-medium text-muted-foreground">ציר צד א׳</span>
          </div>
          {/* Third legend entry only when the page actually has factors — a square, not a dot, because
              a factor is a background region rather than a point on an axis. From the design export. */}
          {layout.factorMarks.length > 0 && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block size-2.5"
                style={{ border: `1px solid ${FACTOR_CHIP_BORDER}`, background: '#F0F2F3' }} />
              <span className="text-xs font-medium text-muted-foreground">גורם משפיע</span>
            </div>
          )}
        </div>
        <TimelineHeader layout={layout} windowIndex={viewIndex} scale={scale} pageType={pageType} allVisible={isNarrow} />
      </div>

      {/* The minimap drives windowIndex, which scrolling replaces — so it is dropped in narrow mode
          rather than left as a control that does nothing. */}
      {!isNarrow && (
        <TimelineMinimap layout={layout} windowIndex={viewIndex} containerWidth={containerWidth} onWindowChange={setWindowIndex} />
      )}

      {/* Timeline row: [left gutter | canvas viewport | right gutter] — panels sit BESIDE the canvas, never over it */}
      <div className="flex items-stretch" style={{ width: containerWidth, height: canvasH }} dir="ltr">
        {isWindowed && (
          <div className="flex items-center justify-center shrink-0" style={{ width: LEFT_GUTTER }}>
            {hasMore && (
              <SidePanel width={LEFT_GUTTER - 12} height={canvasH - 56} variant="active"
                onClick={() => setWindowIndex(Math.min(windowCount - 1, viewIndex + 1))}>
                <span className="text-primary text-sm">←</span>
                <span className="text-[10px] font-semibold text-primary leading-snug mt-1.5 whitespace-nowrap">{moreCount} אירועים נוספים</span>
                {moreRange && (
                  <span className="text-[10px] font-medium text-primary/70 leading-tight mt-0.5 whitespace-nowrap">{moreRange}</span>
                )}
              </SidePanel>
            )}
          </div>
        )}

        {isNarrow ? (
          /* Narrow: an INTENDED horizontal scroll container. The canvas keeps its desktop width, so
             the whole canvas counts as in view and every label, chip and connector renders; the
             reader scrolls to reach them instead of stepping windows. */
          <div
            className="relative overflow-x-auto overflow-y-hidden"
            style={{ width: containerWidth, height: canvasH, WebkitOverflowScrolling: 'touch' }}
            role="region"
            aria-label="ציר זמן — ניתן לגלול לצדדים"
            tabIndex={0}
          >
            {/* The canvas keeps its own coordinate space; the padding is applied to a wrapper so a
                label centred near x=0 or x=canvasWidth is not flush against the container edge at
                either scroll extreme. Padding the canvas itself would shift every x. */}
            <div style={{ position: 'relative', width: canvasWidth + NARROW_EDGE_GUTTER * 2, height: canvasH }}>
              <div style={{ position: 'absolute', insetInlineStart: NARROW_EDGE_GUTTER, top: 0, width: canvasWidth, height: canvasH }}>
                <TimelineCanvas layout={layout} scale={scale} viewLeft={0} viewRight={canvasWidth} />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden shrink-0" style={{ width: viewportW, height: canvasH }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: `translateX(${-scrollLeft}px)` }}>
              <TimelineCanvas layout={layout} scale={scale} viewLeft={scrollLeft} viewRight={scrollLeft + viewportW} />
            </div>
          </div>
        )}

        {isWindowed && (
          <div className="flex items-center justify-center shrink-0" style={{ width: RIGHT_GUTTER }}>
            {!hasPrev ? (
              /* End cap — muted, earliest events marker */
              <SidePanel width={RIGHT_GUTTER - 8} height={canvasH - 56} variant="muted">
                <span className="text-[10px] font-medium text-muted-foreground/80 leading-tight whitespace-nowrap">תחילת האירועים</span>
                {earliestLabel && (
                  <span className="text-[10px] font-medium text-muted-foreground/60 leading-tight mt-0.5 whitespace-nowrap">{earliestLabel}</span>
                )}
                <span className="text-muted-foreground/50 text-sm mt-1">→</span>
              </SidePanel>
            ) : (
              /* Back to earlier window */
              <SidePanel width={RIGHT_GUTTER - 8} height={canvasH - 56} variant="muted" onClick={() => setWindowIndex(Math.max(0, viewIndex - 1))}>
                <span className="text-muted-foreground text-sm">→</span>
                <span className="text-[10px] font-medium text-muted-foreground leading-tight mt-1">אירועים קודמים</span>
              </SidePanel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
