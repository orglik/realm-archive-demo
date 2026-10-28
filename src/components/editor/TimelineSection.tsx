import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TimelineData, TimelineEvent, MeetingPoint, InfluencingFactor } from '@/types/contentPage'
import { timelineSpan, isOutOfSpan, type TimeSpan } from '@/utils/timelineFactors'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Plus, Trash2, AlignLeft } from 'lucide-react'

export type TimelineScale = 'months' | 'hours'

const ENEMY_COLOR = '#D6453D'
const FRIENDLY_COLOR = '#21AEFF'
const DAY_MS = 86_400_000

type Axis = 'enemy' | 'friendly'

// ── Timestamp helpers ─────────────────────────────────────────────────────────
// Topic pages store 'YYYY-MM-DD'. Event pages store a full ISO datetime
// ('YYYY-MM-DDTHH:MM') so an action running past midnight sorts correctly — the analyst
// only ever types HH:MM, and the date half is composed from the page's hero date.

function composeIso(baseDate: string, time: string, dayOffset: number): string {
  const d = new Date(`${baseDate}T00:00`)
  d.setDate(d.getDate() + dayOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T${time}`
}

function splitIso(iso: string, baseDate: string): { time: string; dayOffset: number } {
  const [datePart, timePart = '00:00'] = iso.split('T')
  const base = new Date(`${baseDate}T00:00`).getTime()
  const own = new Date(`${datePart}T00:00`).getTime()
  const dayOffset = Number.isNaN(base) || Number.isNaN(own) ? 0 : Math.round((own - base) / DAY_MS)
  return { time: timePart.slice(0, 5), dayOffset }
}

function fmtDayBadge(baseDate: string, dayOffset: number): string {
  const d = new Date(`${baseDate}T00:00`)
  d.setDate(d.getDate() + dayOffset)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Choose the day for a typed time by whichever candidate keeps the timeline's total span smallest,
// measured against the combined (enemy + friendly) committed set — the same set the viewer spans
// and gap-tests. Deliberately independent of entry order: quick-add lets events be typed out of
// sequence, so anchoring to "the previous row" would give different answers for the same data.
// With events at 22:40/23:20, typing 00:35 rolls over (span 1:55 beats 22:45) while typing 21:00
// does not (2:20 beats 22:20, extending the start backwards).
//
// dayOffset is a derived property of "this time vs. the committed set", not a sticky row attribute,
// so it is recomputed on every time change — add AND edit. On edit, `excludeId` drops the row being
// edited from the reference set: it is already committed with its OLD timestamp, and leaving it in
// would bias the span toward that stale value. A tie (equal span) falls through to 0 (no rollover),
// keeping the rule total and consistent with the empty-set case.
function suggestDayOffset(all: TimelineEvent[], baseDate: string, time: string, excludeId?: string): number {
  const stamps = all
    .filter(e => e.id !== excludeId)
    .map(e => new Date(e.timestamp).getTime())
    .filter(n => !Number.isNaN(n))
  if (stamps.length === 0) return 0
  const spanWith = (candidate: number) => {
    const xs = [...stamps, candidate]
    return Math.max(...xs) - Math.min(...xs)
  }
  const t0 = new Date(composeIso(baseDate, time, 0)).getTime()
  const t1 = new Date(composeIso(baseDate, time, 1)).getTime()
  return spanWith(t1) < spanWith(t0) ? 1 : 0
}

function sortByTime(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

function newId(axis: Axis): string {
  return `${axis[0]}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Live preview strip ────────────────────────────────────────────────────────
// Density lanes only — the real rendering is the viewer's job. Enemy above the spine,
// friendly below, positioned by time across the full span.
function PreviewStrip({ enemy, friendly }: { enemy: TimelineEvent[]; friendly: TimelineEvent[] }) {
  const all = [...enemy, ...friendly].map(e => new Date(e.timestamp).getTime()).filter(n => !Number.isNaN(n))
  const min = all.length ? Math.min(...all) : 0
  const max = all.length ? Math.max(...all) : 0
  const span = max - min

  const pct = (iso: string) => {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return 50
    if (span <= 0) return 50
    // RTL: earliest at the right
    return 100 - ((t - min) / span) * 100
  }

  const lane = (events: TimelineEvent[], color: string, top: number) =>
    events.map(e => (
      <div
        key={e.id}
        className="absolute"
        style={{ right: `${pct(e.timestamp)}%`, top, width: 2, height: 13, background: color, opacity: 0.75 }}
      />
    ))

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">תצוגה חיה — מתעדכנת תוך כדי הזנה</p>
      <div className="relative rounded-lg border border-border bg-muted/30 h-[62px] px-3" dir="rtl">
        <span className="absolute right-3 top-1.5 text-[10px] font-medium" style={{ color: ENEMY_COLOR }}>צד ב׳</span>
        <span className="absolute right-3 bottom-1.5 text-[10px] font-medium" style={{ color: FRIENDLY_COLOR }}>צד א׳</span>
        <div className="absolute left-3 right-3 bg-border" style={{ top: 31, height: 1 }} />
        <div className="absolute left-3 right-3 top-0 bottom-0">
          {lane(enemy, ENEMY_COLOR, 18)}
          {lane(friendly, FRIENDLY_COLOR, 32)}
        </div>
        {all.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/70">
            אין עדיין אירועים
          </span>
        )}
      </div>
    </div>
  )
}

// ── Cascade-delete confirmation ───────────────────────────────────────────────
function DeleteEventDialog({ open, eventLabel, meetingCount, onConfirm, onCancel }: {
  open: boolean; eventLabel: string; meetingCount: number
  onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-card rounded-2xl border border-border shadow-xl p-8 w-[26rem] space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground font-heebo">מחיקת אירוע</h2>
          <p className="text-sm text-muted-foreground mt-1 font-heebo leading-relaxed">
            האירוע «{eventLabel || 'ללא תווית'}» משתתף ב־{meetingCount}{' '}
            {meetingCount === 1 ? 'נקודת מפגש' : 'נקודות מפגש'}. מחיקת האירוע תמחק{' '}
            {meetingCount === 1 ? 'גם אותה' : 'גם אותן'}.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onConfirm}
            className="w-full font-heebo text-red-600 border border-red-200 bg-transparent hover:bg-red-50"
          >
            מחק את האירוע ואת נקודות המפגש
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full font-heebo">ביטול</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Axis column ───────────────────────────────────────────────────────────────
type ColumnProps = {
  axis: Axis
  events: TimelineEvent[]
  allEvents: TimelineEvent[]
  meetingPoints: MeetingPoint[]
  scale: TimelineScale
  baseDate: string
  onCommit: (e: TimelineEvent) => void
  onPatch: (id: string, patch: Partial<TimelineEvent>) => void
  onRequestDelete: (e: TimelineEvent) => void
  /** Event ids to highlight — set while a meeting-point row is hovered, to reveal its linked rows. */
  highlightedIds: Set<string>
}

function AxisColumn({
  axis, events, allEvents, meetingPoints, scale, baseDate, onCommit, onPatch, onRequestDelete, highlightedIds,
}: ColumnProps) {
  const isEnemy = axis === 'enemy'
  const color = isEnemy ? ENEMY_COLOR : FRIENDLY_COLOR
  const [draftStamp, setDraftStamp] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [openDesc, setOpenDesc] = useState<Set<string>>(new Set())
  const labelRef = useRef<HTMLInputElement>(null)

  // Transient highlight on the day badge when a time edit re-derives the day (option C). The badge
  // sits right beside the field being edited, so this signals the recompute exactly where the
  // analyst's attention already is — the whole reason a re-derive that overrides a manual choice
  // is acceptable rather than a silent surprise.
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<number | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])
  function flashBadge(id: string) {
    setFlashId(id)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashId(null), 750)
  }

  const hours = scale === 'hours'
  const sorted = sortByTime(events)

  // The rows list scrolls internally past ~6 rows; the header above and quick-add below stay put.
  // A committed event auto-sorts into place, which can land it outside the current scroll view —
  // so after it renders we scroll the container just enough to reveal it.
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollId = useRef<string | null>(null)
  useEffect(() => {
    const id = pendingScrollId.current
    if (!id) return
    pendingScrollId.current = null
    const c = scrollRef.current
    const el = c?.querySelector<HTMLElement>(`[data-eid="${id}"]`)
    if (!c || !el) return
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    if (top < c.scrollTop) c.scrollTop = Math.max(0, top - 8)
    else if (bottom > c.scrollTop + c.clientHeight) c.scrollTop = bottom - c.clientHeight + 8
  }, [events])

  // Timestamps shared with another event on the SAME axis — surfaced so the analyst can see
  // they'll render stacked at one point on the spine rather than side by side.
  const stampCounts = new Map<string, number>()
  for (const e of sorted) stampCounts.set(e.timestamp, (stampCounts.get(e.timestamp) ?? 0) + 1)

  const inMeeting = (id: string) =>
    meetingPoints.some(mp => mp.enemyEventId === id || mp.friendlyEventId === id)

  function commit() {
    const label = draftLabel.trim()
    if (!draftStamp || !label) return
    const id = newId(axis)
    const timestamp = hours
      ? composeIso(baseDate, draftStamp, suggestDayOffset(allEvents, baseDate, draftStamp))
      : draftStamp
    pendingScrollId.current = id   // scroll it into view once it renders in its sorted position
    onCommit({ id, timestamp, label })
    setDraftStamp('')
    setDraftLabel('')
    labelRef.current?.focus()
  }

  function toggleDesc(id: string) {
    setOpenDesc(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-foreground">
          {isEnemy ? 'ציר צד ב׳' : 'ציר צד א׳'}
        </span>
        <span className="text-[11px] text-muted-foreground">{events.length} אירועים</span>
      </div>

      {/* Scroll area: ~6 rows fit (max-h-[22rem] ≈ 6× the ~55px row); a 7th triggers the scroll.
          pe-1 keeps the RTL scrollbar off the row's left-edge controls. Shorter lists don't reach
          the cap, so no scrollbar appears. */}
      <div ref={scrollRef} className="relative space-y-1.5 max-h-[22rem] overflow-y-auto pe-1">
        {sorted.map(e => {
          const stacked = (stampCounts.get(e.timestamp) ?? 0) > 1
          const { time, dayOffset } = hours
            ? splitIso(e.timestamp, baseDate)
            : { time: e.timestamp, dayOffset: 0 }
          const descOpen = openDesc.has(e.id) || !!e.description

          return (
            <div key={e.id} data-eid={e.id}
              className={`rounded-lg border bg-muted/40 px-2.5 py-2 space-y-1.5 transition-shadow ${
                highlightedIds.has(e.id)
                  ? 'border-[#458FFF] ring-2 ring-[#458FFF]/50 bg-[#458FFF]/5'
                  : 'border-border/70'
              }`}>
              <div className="flex items-center gap-2">
                {hours ? (
                  <>
                    <Input
                      type="time"
                      value={time}
                      onChange={ev => {
                        const nt = ev.target.value
                        // Cleared picker (mid-edit): composeIso with an empty time yields a malformed
                        // "YYYY-MM-DDT" stamp that parses to NaN downstream, so skip the patch entirely
                        // and keep the row's last valid timestamp until a real time is typed.
                        if (!nt) return
                        // Re-derive the day for the new time, excluding this row from the reference set.
                        const nextOffset = suggestDayOffset(allEvents, baseDate, nt, e.id)
                        if (nextOffset !== dayOffset) flashBadge(e.id)
                        onPatch(e.id, { timestamp: composeIso(baseDate, nt, nextOffset) })
                      }}
                      className="h-8 w-24 text-sm shrink-0 px-2"
                      dir="ltr"
                    />
                    {/* Resolved date, always visible so the composed datetime is verifiable;
                        click toggles the event onto the next/previous day. */}
                    <button
                      type="button"
                      onClick={() => onPatch(e.id, { timestamp: composeIso(baseDate, time, dayOffset === 0 ? 1 : 0) })}
                      title={dayOffset === 1 ? 'אירוע ביום שלמחרת — לחץ להחזרה' : 'לחץ להעברה ליום שלמחרת'}
                      // scale via inline style: Tailwind's transform utilities aren't generated in
                      // this build, so a class would be dead. transition-all animates it as a bump.
                      style={{ transform: flashId === e.id ? 'scale(1.12)' : undefined }}
                      className={`h-8 px-2 rounded-md border text-[11px] font-medium shrink-0 cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-[#21AEFF]/50 ${
                        dayOffset === 1
                          ? 'border-[#21AEFF] bg-[#F0F8FF] text-[#21AEFF]'
                          : 'border-border bg-transparent text-muted-foreground hover:border-[#21AEFF]/40'
                      } ${flashId === e.id ? 'ring-2 ring-[#21AEFF] ring-offset-1' : ''}`}
                    >
                      {fmtDayBadge(baseDate, dayOffset)}
                      {dayOffset === 1 && <span className="mr-1">+1</span>}
                    </button>
                  </>
                ) : (
                  <Input
                    type="date"
                    value={e.timestamp}
                    onChange={ev => onPatch(e.id, { timestamp: ev.target.value })}
                    className="h-8 w-[9.5rem] text-sm shrink-0"
                    dir="ltr"
                  />
                )}

                <Input
                  value={e.label}
                  onChange={ev => onPatch(e.id, { label: ev.target.value })}
                  placeholder="תווית קצרה..."
                  className="h-8 text-sm text-right flex-1 min-w-0"
                />

                {stacked && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground shrink-0"
                    title="אירועים נוספים באותה חותמת זמן — יוצגו זה מעל זה על אותה נקודה בציר"
                  >
                    ×{stampCounts.get(e.timestamp)}
                  </span>
                )}
                {inMeeting(e.id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[#458FFF]/40 text-[#458FFF] shrink-0">
                    מפגש
                  </span>
                )}

                <Button
                  variant="ghost" size="sm"
                  className={`h-7 px-2 shrink-0 gap-1 text-[11px] ${descOpen ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => toggleDesc(e.id)}
                  title="הוספת/עריכת תיאור לאירוע"
                >
                  <AlignLeft className="size-3.5" />
                  <span className="hidden sm:inline">תיאור</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => onRequestDelete(e)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {descOpen && (
                <Input
                  value={e.description ?? ''}
                  onChange={ev => onPatch(e.id, { description: ev.target.value })}
                  placeholder="תיאור (אופציונלי)"
                  className="h-8 text-sm text-right"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Quick-add — visible «הוסף» button plus Enter (which also keeps focus for fast entry) */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2">
        <Input
          type={hours ? 'time' : 'date'}
          value={draftStamp}
          onChange={e => setDraftStamp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          className={`h-8 text-sm shrink-0 px-2 ${hours ? 'w-24' : 'w-[9.5rem]'}`}
          dir="ltr"
        />
        <Input
          ref={labelRef}
          value={draftLabel}
          onChange={e => setDraftLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder="תווית קצרה..."
          className="h-8 text-sm text-right flex-1 min-w-0"
        />
        <Button
          variant="outline" size="sm"
          className="h-8 gap-1 shrink-0 border-[#21AEFF]/40 text-[#21AEFF] hover:bg-[#F0F8FF] disabled:opacity-40"
          disabled={!draftStamp || !draftLabel.trim()}
          onClick={commit}
          title="הוסף אירוע (או Enter)"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">הוסף</span>
        </Button>
      </div>
    </div>
  )
}

// ── Meeting points ────────────────────────────────────────────────────────────
function eventOptLabel(e: TimelineEvent, scale: TimelineScale, baseDate: string): string {
  const label = e.label.trim() || 'ללא תווית'
  if (scale === 'months') {
    const [, m, d] = e.timestamp.split('T')[0].split('-')
    return `${d}.${m} · ${label}`
  }
  const { time, dayOffset } = splitIso(e.timestamp, baseDate)
  return `${time}${dayOffset === 1 ? ' +1' : ''} · ${label}`
}

// A בו-זמני is meant to link two events at the same scale point; if their timestamps differ the
// viewer still draws it, but slanted. Reactive to any re-pick on either side (derived each render).
function tsDiffer(a?: TimelineEvent, b?: TimelineEvent): boolean {
  return !!a && !!b && new Date(a.timestamp).getTime() !== new Date(b.timestamp).getTime()
}

const MISMATCH_NOTE = 'האירועים אינם באותה חותמת זמן — בתצוגה הקו יופיע אלכסוני.'

const MEETING_KINDS = ['תגובה', 'בו-זמני'] as const

// Two-state segmented control. Generic over its options so the influencing-factor card can reuse it
// for נקודה/טווח without a second copy of the styling.
function KindToggle<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (k: T) => void
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-border overflow-hidden">
      {options.map(k => (
        <button
          key={k} type="button" onClick={() => onChange(k)}
          className={`h-8 px-2.5 text-[12px] font-medium transition-colors ${
            value === k ? 'bg-[#F0F8FF] text-[#21AEFF]' : 'bg-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

// Axis-constrained picker: enemy picker offers only enemy events (and vice versa), so authored data
// can never trip the viewer's axis-mismatch warning. Options come from the live prop each render, so
// an event added to an axis appears immediately even while a row is open. Value is the event id, so
// same-timestamp stacked events are told apart by their labels and the connector targets the exact one.
function EventPicker({ axis, events, valueId, onChange, scale, baseDate }: {
  axis: Axis; events: TimelineEvent[]; valueId: string
  onChange: (id: string) => void; scale: TimelineScale; baseDate: string
}) {
  const sel = events.find(e => e.id === valueId)
  const dot = axis === 'enemy' ? ENEMY_COLOR : FRIENDLY_COLOR
  const placeholder = axis === 'enemy' ? 'בחר אירוע צד ב׳…' : 'בחר אירוע צד א׳…'
  return (
    <Select value={valueId} onValueChange={v => v && onChange(v)}>
      <SelectTrigger className="h-8 flex-1 min-w-[9rem] text-sm">
        <span className="flex items-center gap-1.5 truncate">
          <span className="inline-block size-2 rounded-full shrink-0" style={{ background: dot }} />
          <span className={`truncate ${sel ? '' : 'text-muted-foreground'}`}>
            {sel ? eventOptLabel(sel, scale, baseDate) : placeholder}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {/* Chronological, matching the axis columns — the raw prop is in insertion order. */}
        {sortByTime(events).map(e => {
          const t = eventOptLabel(e, scale, baseDate)
          return <SelectItem key={e.id} value={e.id} label={t}>{t}</SelectItem>
        })}
      </SelectContent>
    </Select>
  )
}

type MeetingPointsCardProps = {
  enemy: TimelineEvent[]
  friendly: TimelineEvent[]
  meetingPoints: MeetingPoint[]
  scale: TimelineScale
  baseDate: string
  onChange: (mps: MeetingPoint[]) => void
  onHoverPair: (ids: string[] | null) => void
}

function MeetingPointsCard({
  enemy, friendly, meetingPoints, scale, baseDate, onChange, onHoverPair,
}: MeetingPointsCardProps) {
  // Draft row — not committed to `meetingPoints` until BOTH events are chosen (no auto-populate).
  const [dKind, setDKind] = useState<MeetingPoint['kind']>('תגובה')
  const [dEnemy, setDEnemy] = useState('')
  const [dFriendly, setDFriendly] = useState('')
  const [dLabel, setDLabel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollId = useRef<string | null>(null)

  const evById = useMemo(
    () => new Map([...enemy, ...friendly].map(e => [e.id, e] as const)),
    [enemy, friendly],
  )
  const canAdd = enemy.length > 0 && friendly.length > 0

  // Display order: by enemy-event time (then friendly), matching the axis columns' chronology.
  const tsOf = (id: string) => { const e = evById.get(id); return e ? new Date(e.timestamp).getTime() : 0 }
  const sorted = [...meetingPoints].sort(
    (a, b) => tsOf(a.enemyEventId) - tsOf(b.enemyEventId) || tsOf(a.friendlyEventId) - tsOf(b.friendlyEventId),
  )

  useEffect(() => {
    const id = pendingScrollId.current
    if (!id) return
    pendingScrollId.current = null
    const c = scrollRef.current
    const el = c?.querySelector<HTMLElement>(`[data-mpid="${id}"]`)
    if (!c || !el) return
    const top = el.offsetTop, bottom = top + el.offsetHeight
    if (top < c.scrollTop) c.scrollTop = Math.max(0, top - 8)
    else if (bottom > c.scrollTop + c.clientHeight) c.scrollTop = bottom - c.clientHeight + 8
  }, [meetingPoints])

  function commitDraft() {
    if (!dEnemy || !dFriendly) return
    const id = `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    pendingScrollId.current = id
    onChange([
      ...meetingPoints,
      { id, kind: dKind, enemyEventId: dEnemy, friendlyEventId: dFriendly, ...(dLabel.trim() ? { label: dLabel.trim() } : {}) },
    ])
    setDKind('תגובה'); setDEnemy(''); setDFriendly(''); setDLabel('')
    onHoverPair(null)
  }
  const patchMp = (id: string, patch: Partial<MeetingPoint>) =>
    onChange(meetingPoints.map(mp => (mp.id === id ? { ...mp, ...patch } : mp)))
  const removeMp = (id: string) => { onHoverPair(null); onChange(meetingPoints.filter(mp => mp.id !== id)) }

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground">נקודות מפגש</h3>
        <p className="text-[11px] text-muted-foreground">
          אופציונלי · אפשר כמה · תגובה = מי הגיב למי (עם דלתא) · בו-זמני = אירועים באותו רגע, בהצהרת האנליסט
        </p>
      </div>

      {sorted.length === 0 && (
        <p className="text-[12px] text-muted-foreground">טרם נוצרו נקודות מפגש</p>
      )}

      {sorted.length > 0 && (
        <div ref={scrollRef} className="relative space-y-2 max-h-[22rem] overflow-y-auto pe-1">
          {sorted.map(mp => {
            const mismatch = mp.kind === 'בו-זמני' && tsDiffer(evById.get(mp.enemyEventId), evById.get(mp.friendlyEventId))
            return (
              <div
                key={mp.id} data-mpid={mp.id}
                onMouseEnter={() => onHoverPair([mp.enemyEventId, mp.friendlyEventId])}
                onMouseLeave={() => onHoverPair(null)}
                className="rounded-lg border border-border/70 bg-card p-2 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <KindToggle options={MEETING_KINDS} value={mp.kind} onChange={k => patchMp(mp.id, { kind: k })} />
                  <EventPicker axis="enemy" events={enemy} valueId={mp.enemyEventId} scale={scale} baseDate={baseDate}
                    onChange={id => patchMp(mp.id, { enemyEventId: id })} />
                  <EventPicker axis="friendly" events={friendly} valueId={mp.friendlyEventId} scale={scale} baseDate={baseDate}
                    onChange={id => patchMp(mp.id, { friendlyEventId: id })} />
                  <Input value={mp.label ?? ''} onChange={e => patchMp(mp.id, { label: e.target.value || undefined })}
                    placeholder="תווית" title="תווית (אופציונלי)" className="h-8 text-sm text-right w-24 shrink-0" />
                  <Button variant="ghost" size="sm"
                    className="h-8 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => removeMp(mp.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {mismatch && <p className="text-[11px] text-amber-600 px-0.5">{MISMATCH_NOTE}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Draft, pinned below the list. Commit disabled until both events are chosen. */}
      {canAdd ? (
        <div
          onMouseEnter={() => onHoverPair([dEnemy, dFriendly].filter(Boolean))}
          onMouseLeave={() => onHoverPair(null)}
          className="rounded-lg border border-dashed border-border p-2 space-y-1.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <KindToggle options={MEETING_KINDS} value={dKind} onChange={setDKind} />
            <EventPicker axis="enemy" events={enemy} valueId={dEnemy} scale={scale} baseDate={baseDate} onChange={setDEnemy} />
            <EventPicker axis="friendly" events={friendly} valueId={dFriendly} scale={scale} baseDate={baseDate} onChange={setDFriendly} />
            <Input value={dLabel} onChange={e => setDLabel(e.target.value)}
              placeholder="תווית" title="תווית (אופציונלי)" className="h-8 text-sm text-right w-24 shrink-0" />
            <Button variant="outline" size="sm"
              className="h-8 gap-1 shrink-0 border-[#21AEFF]/40 text-[#21AEFF] hover:bg-[#F0F8FF] disabled:opacity-40"
              disabled={!dEnemy || !dFriendly} onClick={commitDraft}>
              <Plus className="size-4" /> הוספת נקודת מפגש
            </Button>
          </div>
          {dKind === 'בו-זמני' && tsDiffer(evById.get(dEnemy), evById.get(dFriendly)) && (
            <p className="text-[11px] text-amber-600 px-0.5">{MISMATCH_NOTE}</p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">כדי ליצור נקודת מפגש נדרש אירוע אחד לפחות בכל ציר.</p>
      )}
    </section>
  )
}

// ── Influencing factors ───────────────────────────────────────────────────────
// A factor is context, not an event: no axis, no dot, no meeting points, nothing references it. So
// this card is deliberately the simplest thing in the section — no cascade delete, no cross-checks.
const FACTOR_MODES = ['נקודה', 'טווח'] as const
type FactorMode = (typeof FACTOR_MODES)[number]

const FACTOR_ORDER_NOTE = 'תאריך הסיום מוקדם מתאריך ההתחלה — הגורם לא יוצג בציר עד לתיקון.'

// Covered-period helpers. A factor dated entirely outside the events' own span is dropped by the
// viewer (see toRawFactors): the axis runs from the first event to the last, so there is nowhere to
// put it — drawing it at an edge would assert the date of whichever event sits there. Warn rather
// than block, matching FACTOR_ORDER_NOTE: the analyst may be mid-edit, or about to add the events
// that will bring it into range.
function fmtCovered(ms: number, scale: TimelineScale): string {
  const d = new Date(ms)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  if (scale === 'months') return `${dd}.${mm}.${d.getFullYear()}`
  return `${dd}.${mm} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function OutOfRangeNote({ span, scale }: { span: TimeSpan; scale: TimelineScale }) {
  return (
    <p className="text-[11px] text-amber-600 px-0.5">
      התאריך מחוץ לטווח האירועים בציר (
      <span dir="ltr">{fmtCovered(span.min, scale)}–{fmtCovered(span.max, scale)}</span>
      ) — הגורם לא יוצג בתצוגה.
    </p>
  )
}

// Topic pages take a date; event pages take date+time in ONE control rather than the axis rows'
// time-field-plus-day-badge. That pattern exists to serve suggestDayOffset, which factors are
// deliberately excluded from (a factor must not shift where an event's day is inferred), so its
// time-only field would leave the day with nothing to set it.
const factorInputType = (scale: TimelineScale) => (scale === 'months' ? 'date' : 'datetime-local')
const factorInputWidth = (scale: TimelineScale) => (scale === 'months' ? 'w-[9.5rem]' : 'w-[13rem]')

function isInverted(startTs: string, endTs?: string): boolean {
  if (!startTs || !endTs) return false
  const a = new Date(startTs).getTime()
  const b = new Date(endTs).getTime()
  return !Number.isNaN(a) && !Number.isNaN(b) && b < a
}

function InfluencingFactorsCard({ factors, events, scale, onChange }: {
  factors: InfluencingFactor[]
  /** Both axes' events — only to derive the covered period for the out-of-range warning. */
  events: TimelineEvent[]
  scale: TimelineScale
  onChange: (fs: InfluencingFactor[]) => void
}) {
  const [dMode, setDMode] = useState<FactorMode>('נקודה')
  const [dStart, setDStart] = useState('')
  const [dEnd, setDEnd] = useState('')
  const [dLabel, setDLabel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollId = useRef<string | null>(null)

  const inputType = factorInputType(scale)
  const inputW = factorInputWidth(scale)
  const span = useMemo(() => timelineSpan(events), [events])

  // Chronological, matching the axis columns. Undated rows can't exist (start is required to commit).
  const sorted = [...factors].sort(
    (a, b) => new Date(a.startTs).getTime() - new Date(b.startTs).getTime()
  )

  useEffect(() => {
    const id = pendingScrollId.current
    if (!id) return
    pendingScrollId.current = null
    const c = scrollRef.current
    const el = c?.querySelector<HTMLElement>(`[data-fid="${id}"]`)
    if (!c || !el) return
    const top = el.offsetTop, bottom = top + el.offsetHeight
    if (top < c.scrollTop) c.scrollTop = Math.max(0, top - 8)
    else if (bottom > c.scrollTop + c.clientHeight) c.scrollTop = bottom - c.clientHeight + 8
  }, [factors])

  function commitDraft() {
    const label = dLabel.trim()
    if (!dStart || !label) return
    const id = `if-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    pendingScrollId.current = id
    onChange([
      ...factors,
      { id, label, startTs: dStart, ...(dMode === 'טווח' && dEnd ? { endTs: dEnd } : {}) },
    ])
    setDMode('נקודה'); setDStart(''); setDEnd(''); setDLabel('')
  }

  const patchFactor = (id: string, patch: Partial<InfluencingFactor>) =>
    onChange(factors.map(f => (f.id === id ? { ...f, ...patch } : f)))
  const removeFactor = (id: string) => onChange(factors.filter(f => f.id !== id))

  // Switching a committed row to נקודה drops endTs — presence of endTs IS the mode, so there is no
  // hidden value to restore, and leaving a stale one would keep rendering a band.
  const setMode = (f: InfluencingFactor, mode: FactorMode) =>
    patchFactor(f.id, { endTs: mode === 'נקודה' ? undefined : (f.endTs ?? f.startTs) })

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground">גורמים משפיעים</h3>
        <p className="text-[11px] text-muted-foreground">
          אופציונלי · הקשר שהשפיע על התקופה — לא אירוע · נקודה = תאריך יחיד · טווח = תקופה
        </p>
      </div>

      {sorted.length === 0 && (
        <p className="text-[12px] text-muted-foreground">טרם נוצרו גורמים משפיעים</p>
      )}

      {sorted.length > 0 && (
        <div ref={scrollRef} className="relative space-y-2 max-h-[22rem] overflow-y-auto pe-1">
          {sorted.map(f => {
            const mode: FactorMode = f.endTs ? 'טווח' : 'נקודה'
            const inverted = isInverted(f.startTs, f.endTs)
            return (
              <div key={f.id} data-fid={f.id} className="rounded-lg border border-border/70 bg-card p-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <KindToggle options={FACTOR_MODES} value={mode} onChange={m => setMode(f, m)} />
                  <Input
                    type={inputType} value={f.startTs}
                    onChange={e => patchFactor(f.id, { startTs: e.target.value })}
                    title="תאריך התחלה"
                    className={`h-8 text-sm shrink-0 ${inputW}`} dir="ltr"
                  />
                  {mode === 'טווח' && (
                    <>
                      <span className="text-[11px] text-muted-foreground shrink-0">עד</span>
                      <Input
                        type={inputType} value={f.endTs ?? ''}
                        onChange={e => patchFactor(f.id, { endTs: e.target.value || undefined })}
                        title="תאריך סיום"
                        className={`h-8 text-sm shrink-0 ${inputW}`} dir="ltr"
                      />
                    </>
                  )}
                  <Input
                    value={f.label}
                    onChange={e => patchFactor(f.id, { label: e.target.value })}
                    placeholder="תווית קצרה..."
                    className="h-8 text-sm text-right flex-1 min-w-[7rem]"
                  />
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => removeFactor(f.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {inverted && <p className="text-[11px] text-amber-600 px-0.5">{FACTOR_ORDER_NOTE}</p>}
                {/* An inverted range is already not rendered, so the range note subsumes this one —
                    showing both would state the same consequence twice. */}
                {!inverted && span && isOutOfSpan(f.startTs, f.endTs, span) && (
                  <OutOfRangeNote span={span} scale={scale} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Draft, pinned below the list — same shape as the meeting-point draft row. */}
      <div className="rounded-lg border border-dashed border-border p-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <KindToggle
            options={FACTOR_MODES} value={dMode}
            onChange={m => { setDMode(m); if (m === 'נקודה') setDEnd('') }}
          />
          <Input
            type={inputType} value={dStart} onChange={e => setDStart(e.target.value)}
            title="תאריך התחלה" className={`h-8 text-sm shrink-0 ${inputW}`} dir="ltr"
          />
          {dMode === 'טווח' && (
            <>
              <span className="text-[11px] text-muted-foreground shrink-0">עד</span>
              <Input
                type={inputType} value={dEnd} onChange={e => setDEnd(e.target.value)}
                title="תאריך סיום" className={`h-8 text-sm shrink-0 ${inputW}`} dir="ltr"
              />
            </>
          )}
          <Input
            value={dLabel} onChange={e => setDLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft() } }}
            placeholder="תווית קצרה..."
            className="h-8 text-sm text-right flex-1 min-w-[7rem]"
          />
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1 shrink-0 border-[#21AEFF]/40 text-[#21AEFF] hover:bg-[#F0F8FF] disabled:opacity-40"
            disabled={!dStart || !dLabel.trim()}
            onClick={commitDraft}
          >
            <Plus className="size-4" /> הוספת גורם משפיע
          </Button>
        </div>
        {isInverted(dStart, dEnd) && <p className="text-[11px] text-amber-600 px-0.5">{FACTOR_ORDER_NOTE}</p>}
        {!isInverted(dStart, dEnd) && span && isOutOfSpan(dStart, dMode === 'טווח' ? dEnd : undefined, span) && (
          <OutOfRangeNote span={span} scale={scale} />
        )}
      </div>
    </section>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
type Props = {
  value: TimelineData
  onChange: (value: TimelineData) => void
  scale: TimelineScale
  /** hero.date — event pages compose it with the typed HH:MM. Unused on topic pages. */
  baseDate?: string
}

export function TimelineSection({ value, onChange, scale, baseDate = '' }: Props) {
  const [pendingDelete, setPendingDelete] = useState<TimelineEvent | null>(null)
  // Set while a meeting-point row is hovered — its two linked axis rows get highlighted.
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())

  const enemy = value.enemyEvents ?? []
  const friendly = value.friendlyEvents ?? []
  const meetingPoints = value.meetingPoints ?? []
  const influencingFactors = value.influencingFactors ?? []
  const all = [...enemy, ...friendly]

  const needsBaseDate = scale === 'hours' && !baseDate

  function setAxis(axis: Axis, events: TimelineEvent[]) {
    onChange(axis === 'enemy'
      ? { ...value, enemyEvents: events }
      : { ...value, friendlyEvents: events })
  }

  const setMeetingPoints = (mps: MeetingPoint[]) => onChange({ ...value, meetingPoints: mps })
  const setFactors = (fs: InfluencingFactor[]) => onChange({ ...value, influencingFactors: fs })

  function patch(axis: Axis, id: string, p: Partial<TimelineEvent>) {
    const list = axis === 'enemy' ? enemy : friendly
    setAxis(axis, list.map(e => (e.id === id ? { ...e, ...p } : e)))
  }

  const meetingsFor = (id: string) =>
    meetingPoints.filter(mp => mp.enemyEventId === id || mp.friendlyEventId === id)

  function requestDelete(e: TimelineEvent) {
    if (meetingsFor(e.id).length > 0) { setPendingDelete(e); return }
    performDelete(e)
  }

  // Deleting an event that a meeting point references removes that meeting point too, so the
  // saved data can never contain a dangling reference. The viewer's skip-on-missing-id is a
  // defensive fallback for external data — the authoring UI must not rely on it.
  function performDelete(e: TimelineEvent) {
    const axis: Axis = enemy.some(x => x.id === e.id) ? 'enemy' : 'friendly'
    const list = axis === 'enemy' ? enemy : friendly
    onChange({
      ...value,
      [axis === 'enemy' ? 'enemyEvents' : 'friendlyEvents']: list.filter(x => x.id !== e.id),
      meetingPoints: meetingPoints.filter(
        mp => mp.enemyEventId !== e.id && mp.friendlyEventId !== e.id
      ),
    })
    setPendingDelete(null)
  }

  return (
    <section className="bg-card rounded-xl shadow border border-border p-6 space-y-5">
      <div className="border-b border-border/60 pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-foreground">ציר זמן</h2>
          <span className="text-[11px] text-muted-foreground">
            סעיף אופציונלי · יוצג בעמוד כשקיים אירוע אחד לפחות
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          הוסף אירועים לשני הצירים. הרשימה ממוינת אוטומטית לפי תאריך — אין צורך לסדר ידנית.
        </p>
      </div>

      {needsBaseDate ? (
        <p className="text-[13px] text-muted-foreground">
          יש להזין תחילה את תאריך האירוע בסעיף «כותרת ומטא-דאטה» — שעות ציר הזמן מחושבות ביחס אליו.
        </p>
      ) : (
        <>
          <PreviewStrip enemy={enemy} friendly={friendly} />

          {/* Axes stacked vertically — enemy above friendly, mirroring the viewer's above/below-spine
              arrangement, and giving each row the full width so long labels never clip. */}
          <div className="flex flex-col gap-6">
            <AxisColumn
              axis="enemy" events={enemy} allEvents={all} meetingPoints={meetingPoints}
              scale={scale} baseDate={baseDate} highlightedIds={highlightedIds}
              onCommit={e => setAxis('enemy', [...enemy, e])}
              onPatch={(id, p) => patch('enemy', id, p)}
              onRequestDelete={requestDelete}
            />
            <AxisColumn
              axis="friendly" events={friendly} allEvents={all} meetingPoints={meetingPoints}
              scale={scale} baseDate={baseDate} highlightedIds={highlightedIds}
              onCommit={e => setAxis('friendly', [...friendly, e])}
              onPatch={(id, p) => patch('friendly', id, p)}
              onRequestDelete={requestDelete}
            />
          </div>

          {/* The header already states the list auto-sorts, and the «הוסף» button + badge tooltip are
              self-explanatory, so the only non-obvious behaviour worth a footer is the day toggle. */}
          {scale === 'hours' && (
            <p className="text-[11px] text-muted-foreground">
              טיפ: לחיצה על תגית התאריך מעבירה אירוע ליום שלמחרת (למשל פעולה שחצתה חצות).
            </p>
          )}

          <MeetingPointsCard
            enemy={enemy} friendly={friendly} meetingPoints={meetingPoints}
            scale={scale} baseDate={baseDate}
            onChange={setMeetingPoints}
            onHoverPair={ids => setHighlightedIds(new Set(ids ?? []))}
          />

          <InfluencingFactorsCard factors={influencingFactors} events={all} scale={scale} onChange={setFactors} />
        </>
      )}

      <DeleteEventDialog
        open={!!pendingDelete}
        eventLabel={pendingDelete?.label ?? ''}
        meetingCount={pendingDelete ? meetingsFor(pendingDelete.id).length : 0}
        onConfirm={() => pendingDelete && performDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
