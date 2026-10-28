import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { ContentPage, TopicPage, EventPage, ReferencePage } from '@/types/contentPage'
import { formatDate, formatRelativeTime } from '@/utils/dateUtils'
import { hasUnpublishedChanges } from '@/utils/pageUtils'
import { computeGate } from '@/utils/publishValidation'
import type { Gate } from '@/utils/publishValidation'
import { useAsync } from '@/hooks/useAsync'
import { MAX_TOPIC_DEPTH } from '@/utils/topicHierarchy'
import {
  getPages, publishPage, unpublishPage, archivePage, unarchivePage, deletePage, restorePage, blockReason,
} from '@/services/pageService'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronsUpDown, MoreHorizontal, Plus, Loader2, Search, Archive,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortCol = 'title' | 'type' | 'status' | 'updatedAt'
type SortDir = 'asc' | 'desc'

interface MenuItem {
  label: string
  onClick?: () => void
  disabled?: boolean
  reason?: string
  destructive?: boolean
  separator?: boolean
}

// ── Utility functions ─────────────────────────────────────────────────────────
// (Block-reason logic now lives once in pageService.blockReason — imported above — so the list-page
// label and the delete/unpublish gate can never drift. It covers published descendants transitively.)

// A row in the hierarchy-ordered list.
//  depth       — 0 = top-level; each child is one deeper.
//  guides      — one flag per tree column (length = depth). guides[i] = "the node in column i has a
//                later sibling", so the connector renderer continues a vertical rail (│) there and knows
//                whether this row's own elbow is a ├ (has next sibling) or └ (last child).
//  hasChildren — this topic has nested rows (child topics and/or linked events) → gets a collapse toggle.
//  key         — unique per tree occurrence (ancestry path, e.g. "17/20"). No longer strictly required
//                for uniqueness (each event now has exactly one occurrence — see primaryTopicOf below —
//                so page.id alone would no longer collide), kept anyway since it's still correct and
//                harmless, and matches the topic-chain keys.
type HierarchyRow = {
  page: ContentPage; depth: number; guides: boolean[]; hasChildren: boolean; key: string
  // The topic this EVENT row is nested under (its primary/deepest linked topic — see primaryTopicOf
  // below). undefined for non-event rows, and for an event with no primary topic in the current view
  // (standalone-root fallback). Threaded through from orderByHierarchy's own primaryTopicOf map — not
  // recomputed — so the "מקושר אל:" caption can exclude the one relationship nesting already shows,
  // without a second, independent "which topic is primary" calculation ever existing.
  primaryTopicId?: string
}

// Depth of a topic within the CURRENT view's own byId (parent-walk, capped/guarded — same shape as
// pageHierarchy.ts's topicDepth, deliberately NOT imported from there: that version excludes archived
// topics from candidacy, correct for the reader-facing breadcrumb/ribbon which must show "no trace" of
// archived (decision 4). Here the opposite is correct — archived topics remain valid nesting parents in
// the management list, which shows them inline (decision 5) — so this local version counts any status.
function localTopicDepth(id: string, byId: Map<string, ContentPage>): number {
  let depth = 0
  const seen = new Set<string>([id])
  let cur = byId.get(id)
  let parent = cur && cur.type === 'topic' ? cur.parentTopicId : undefined
  while (parent && depth < MAX_TOPIC_DEPTH && !seen.has(parent)) {
    const p = byId.get(parent)
    if (!p || p.type !== 'topic') break
    seen.add(parent)
    depth++
    parent = p.parentTopicId
  }
  return depth
}

// Reorder sorted rows into a tree. A topic's children are its child topics AND its linked events, all
// nested beneath it. UNIFORM RULE: anything shown nested is not also shown as a standalone row.
//
// A multi-topic event (e.g. one relevant to both a campaign and its own child operation — a real,
// intentional scenario, see mockLinks.ts) nests under exactly ONE topic: its most specific (deepest)
// linked topic, not every topic it links. This matches primaryParentId's "deepest wins" precedent in
// pageHierarchy.ts (the reader-facing breadcrumb/ribbon anchor) — one consistent rule for "which topic
// does a multi-linked event anchor to" across the codebase, not a second independent rule for list-
// nesting. (Bug fixed: an event linking both a parent topic and that parent's own child used to render
// TWICE — once under each — because there was no such rule; primaryTopicOf below is precomputed once
// per event, shared by childrenOf and the standalone-root check, so the two can never disagree.)
// Topics are single-parent, emitted once. A topic/event whose parent(s) are all filtered out of the
// current view falls back to a standalone root so nothing is ever lost — which is why the same item can
// read as "nested" with no filter but "standalone" under a filter.
function orderByHierarchy(rows: ContentPage[]): HierarchyRow[] {
  const byId = new Map(rows.map((p) => [p.id, p]))
  const topicEmitted = new Set<string>()   // topics are single-parent → emit once

  const primaryTopicOf = new Map<string, string | undefined>()
  for (const p of rows) {
    if (p.type !== 'event') continue
    const linkedTopicIds = (p.linkedPageIds ?? []).filter((id) => byId.get(id)?.type === 'topic')
    if (linkedTopicIds.length === 0) { primaryTopicOf.set(p.id, undefined); continue }
    let best = linkedTopicIds[0]
    let bestDepth = localTopicDepth(best, byId)
    for (const id of linkedTopicIds.slice(1)) {
      const d = localTopicDepth(id, byId)
      if (d > bestDepth) { best = id; bestDepth = d }
    }
    primaryTopicOf.set(p.id, best)
  }

  const out: HierarchyRow[] = []

  const childrenOf = (p: ContentPage): ContentPage[] => {
    if (p.type !== 'topic') return []
    const childTopics = (p.childTopicIds ?? [])
      .map((cid) => byId.get(cid))
      .filter((c): c is ContentPage => !!c && !topicEmitted.has(c.id))
    // Events nest under their precomputed primary topic ONLY — never every topic they link. Reference
    // pages are NOT in the hierarchy — they never nest (only 'event' rows qualify here).
    const linkedEvents = rows.filter((e) => e.type === 'event' && primaryTopicOf.get(e.id) === p.id)
    return [...childTopics, ...linkedEvents]   // sub-topics first, then this topic's own events
  }

  const emit = (p: ContentPage, depth: number, guides: boolean[], keyPath: string) => {
    const kids = childrenOf(p)
    out.push({ page: p, depth, guides, hasChildren: kids.length > 0, key: keyPath, primaryTopicId: primaryTopicOf.get(p.id) })
    kids.forEach((child, i) => {
      if (child.type === 'topic') topicEmitted.add(child.id)
      emit(child, depth + 1, [...guides, i < kids.length - 1], `${keyPath}/${child.id}`)
    })
  }

  for (const p of rows) {
    if (p.type === 'topic') {
      if (topicEmitted.has(p.id)) continue
      if (p.parentTopicId && byId.has(p.parentTopicId)) continue    // nested under its parent instead
      topicEmitted.add(p.id)
      emit(p, 0, [], p.id)
    } else if (p.type === 'event') {
      // Standalone root only when there's no primary topic in the current view at all (no linked topic,
      // or every linked topic is filtered out) — otherwise it nests under that primary topic, above.
      if (primaryTopicOf.get(p.id) === undefined) emit(p, 0, [], p.id)
    } else {
      // reference: never nested — always a standalone root.
      emit(p, 0, [], p.id)
    }
  }
  // Orphaned topics (parent filtered out of view) — emit as roots so nothing is lost.
  for (const p of rows) if (p.type === 'topic' && !topicEmitted.has(p.id)) { topicEmitted.add(p.id); emit(p, 0, [], p.id) }
  return out
}

// Apply expand/collapse: hide every row that sits below a collapsed parent. Single pass over the
// pre-order list — when a collapsed parent is seen, skip deeper rows until we return to its depth.
function applyCollapse(ordered: HierarchyRow[], collapsed: Set<string>): HierarchyRow[] {
  const out: HierarchyRow[] = []
  let hideBelow = Infinity
  for (const row of ordered) {
    if (row.depth > hideBelow) continue
    hideBelow = Infinity
    out.push(row)
    if (row.hasChildren && collapsed.has(row.page.id)) hideBelow = row.depth
  }
  return out
}

// Paginate WITHOUT splitting a top-level group across pages. A group is a depth-0 row plus all of its
// nested rows (children/events) — collapsing/expanding a parent moves that whole block together, so it
// must stay on one page. Whole groups are greedily packed up to PAGE_SIZE; a group larger than a page
// keeps its integrity and gets a page of its own (that page may exceed PAGE_SIZE — intended).
function paginateByGroups(rows: HierarchyRow[], size: number): HierarchyRow[][] {
  const groups: HierarchyRow[][] = []
  for (const row of rows) {
    if (row.depth === 0 || groups.length === 0) groups.push([row])
    else groups[groups.length - 1].push(row)
  }
  const pages: HierarchyRow[][] = []
  let cur: HierarchyRow[] = []
  for (const g of groups) {
    if (cur.length > 0 && cur.length + g.length > size) { pages.push(cur); cur = [] }
    cur.push(...g)
  }
  if (cur.length > 0) pages.push(cur)
  return pages.length > 0 ? pages : [[]]
}

// RTL tree connectors for one indented row: a vertical rail (│) at each ancestor column that continues,
// and an elbow (├─ / └─) at the row's own column. insetInlineStart keeps it on the reading-start side.
const TREE_COL = 26
function TreeGuides({ guides }: { guides: boolean[] }) {
  if (guides.length === 0) return null
  const line = 'bg-[#C8D8E0]'
  return (
    <div className="flex shrink-0 self-stretch" aria-hidden>
      {guides.map((cont, i) => {
        const isSelf = i === guides.length - 1
        return (
          <span key={i} className="relative block" style={{ width: TREE_COL }}>
            {isSelf ? (
              <>
                <span className={`absolute top-0 bottom-1/2 w-px ${line}`} style={{ insetInlineStart: 11 }} />
                <span className={`absolute top-1/2 h-px ${line}`} style={{ insetInlineStart: 11, insetInlineEnd: 5 }} />
                {cont && <span className={`absolute top-1/2 bottom-0 w-px ${line}`} style={{ insetInlineStart: 11 }} />}
              </>
            ) : (
              cont && <span className={`absolute inset-y-0 w-px ${line}`} style={{ insetInlineStart: 11 }} />
            )}
          </span>
        )
      })}
    </div>
  )
}

// A "label: a, b, c" caption listing linked pages on a row. Draft-linked pages are marked "(טיוטה)"
// because the read-only VIEWER is published-only — so this explains why a listed link won't appear on
// the live page (the management list intentionally shows the full picture, drafts included).
function LinkedRowCaption(
  { label, pages, onNav }: { label: string; pages: ContentPage[]; onNav: (id: string) => void },
) {
  if (pages.length === 0) return null
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground font-heebo flex flex-wrap items-center gap-x-1">
      <span>{label}</span>
      {pages.map((p, i) => (
        <span key={p.id}>
          <a
            href={`/page/${p.id}/view`}
            onClick={(e) => { e.preventDefault(); onNav(p.id) }}
            className="hover:text-primary transition-colors"
          >
            {p.title}
          </a>
          {p.status === 'draft' && <span className="text-muted-foreground/60"> (טיוטה)</span>}
          {p.status === 'archived' && <span className="text-muted-foreground/60"> (בארכיון)</span>}
          {i < pages.length - 1 ? ',' : ''}
        </span>
      ))}
    </p>
  )
}

// ── ActionMenu ────────────────────────────────────────────────────────────────

function ActionMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function openMenu() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const menu = open && pos ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="min-w-[15rem] bg-card border border-border rounded-xl shadow-xl py-1.5 text-right"
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && <div className="border-t border-border my-1" />}
          {item.disabled ? (
            <div className="px-4 py-2.5 cursor-not-allowed select-none">
              <p className="text-sm text-foreground/40">{item.label}</p>
              {item.reason && (
                <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{item.reason}</p>
              )}
            </div>
          ) : (
            <button
              className={`w-full text-right px-4 py-2.5 text-sm transition-colors ${
                item.destructive ? 'text-red-600 hover:bg-red-50' : 'text-foreground hover:bg-muted/50'
              }`}
              onClick={() => { setOpen(false); item.onClick?.() }}
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openMenu}
        className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu}
    </>
  )
}

// ── GateCounter ───────────────────────────────────────────────────────────────

function GateCounter({ gate }: { gate: Gate }) {
  const complete = gate.done >= gate.total
  const [open, setOpen] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const visible = !complete && (hovering || open) && gate.missing.length > 0

  function calcPos() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left })
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (complete) {
    return (
      <span className="text-[11px] font-medium text-green-600">
        {gate.done}/{gate.total} חובה ✓
      </span>
    )
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="text-[11px] font-medium text-muted-foreground underline decoration-dotted underline-offset-2 cursor-pointer select-none"
        onMouseEnter={() => { setHovering(true); calcPos() }}
        onMouseLeave={() => setHovering(false)}
        onClick={() => { setOpen((o) => !o); calcPos() }}
      >
        {gate.done}/{gate.total} חובה
      </span>
      {visible && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-foreground text-white text-[11px] rounded-lg px-3 py-2.5
            min-w-[11rem] max-w-xs text-right leading-relaxed shadow-xl pointer-events-none"
        >
          חסרים: {gate.missing.join(', ')}
        </div>,
        document.body
      )}
    </>
  )
}

// ── StatusCell ────────────────────────────────────────────────────────────────

function StatusCell({ page, hasChanges, gate }: {
  page: ContentPage; hasChanges: boolean; gate: Gate
}) {
  return (
    <div className="flex flex-col gap-1.5 items-start">
      {page.status === 'published' ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#F0F8FF] text-[#21AEFF] border border-[#21AEFF]/20">
          <span className="size-1.5 rounded-full bg-[#21AEFF] shrink-0" />
          פורסם
        </span>
      ) : page.status === 'archived' ? (
        // Icon instead of a dot (unlike the two pills above/below) — a gray dot on a gray pill would
        // read too close to "טיוטה" at a glance; decision 5 wants archived flagged as noticeably as
        // possible, so it gets a distinct visual marker, not just a third color.
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
          <Archive className="size-3" />
          בארכיון
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-transparent text-muted-foreground border border-border">
          <span className="size-1.5 rounded-full border border-current shrink-0 opacity-60" />
          טיוטה
        </span>
      )}

      {(page.status === 'published' || page.status === 'archived') && hasChanges && (
        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border border-dashed border-primary/40 text-primary/70 bg-primary/5">
          יש שינויים שלא פורסמו
        </span>
      )}

      {page.status === 'draft' && <GateCounter gate={gate} />}
    </div>
  )
}

// ── PublishButton ─────────────────────────────────────────────────────────────

function PublishButton({ gate, loading, onClick }: {
  gate: Gate; loading: boolean; onClick: () => void
}) {
  if (loading) {
    return (
      <Button size="sm" disabled className="h-7 text-xs px-3 font-heebo">
        <Loader2 className="size-3 animate-spin" />
      </Button>
    )
  }

  const ready = gate.done >= gate.total

  // Counter owns the explanation when gated — button stays visibly disabled, no tooltip here
  return (
    <Button size="sm" disabled={!ready} className="h-7 text-xs px-3 font-heebo" onClick={onClick}>
      פרסום
    </Button>
  )
}

// ── SortHeader ────────────────────────────────────────────────────────────────

function SortHeader({ col, label, sort, onSort }: {
  col: SortCol; label: string
  sort: { col: SortCol; dir: SortDir }
  onSort: (col: SortCol) => void
}) {
  const active = sort.col === col
  return (
    <button
      className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => onSort(col)}
    >
      {label}
      {active
        ? sort.dir === 'desc'
          ? <ChevronDown className="size-3" />
          : <ChevronUp className="size-3" />
        : <ChevronsUpDown className="size-3 opacity-40" />
      }
    </button>
  )
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

function DeleteDialog({ page, onConfirm, onClose }: {
  page: ContentPage | null; onConfirm: () => void; onClose: () => void
}) {
  return (
    <AlertDialog open={page !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>מחיקת הדף</AlertDialogTitle>
          <AlertDialogDescription>
            פעולה זו תמחק לצמיתות את הדף "{page?.title || 'ללא שם'}". לא ניתן לשחזר אותו לאחר מכן.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
          <AlertDialogCancel onClick={onClose}>ביטול</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
            מחיקה
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RestoreDialog({ page, onConfirm, onClose }: {
  page: ContentPage | null; onConfirm: () => void; onClose: () => void
}) {
  const publishedAt = page?.lastPublishedAt ? formatDate(page.lastPublishedAt) : '—'
  return (
    <AlertDialog open={page !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>שחזור לגרסה שפורסמה</AlertDialogTitle>
          <AlertDialogDescription>
            פעולה זו תחזיר את הדף לגרסה שפורסמה ב-{publishedAt} ותמחק את כל השינויים הנוכחיים שלא פורסמו. לא ניתן לבטל פעולה זו.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
          <AlertDialogCancel onClick={onClose}>ביטול</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
            שחזור
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function TypePickerDialog({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (type: 'topic' | 'event' | 'reference') => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border shadow-xl p-6 sm:p-8 w-full max-w-[20rem] space-y-6"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold text-foreground">יצירת עמוד חדש</h2>
          <p className="text-sm text-muted-foreground mt-1">בחר את סוג העמוד שברצונך ליצור</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onCreate('topic')}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-muted/40 hover:border-primary hover:bg-primary/5 transition-all p-5 text-center"
          >
            <span className="text-2xl">📄</span>
            <span className="text-sm font-semibold text-foreground">דף נושא</span>
            <span className="text-xs text-muted-foreground">נושא אסטרטגי, זירה, ארגון</span>
          </button>
          <button
            onClick={() => onCreate('event')}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-muted/40 hover:border-primary hover:bg-primary/5 transition-all p-5 text-center"
          >
            <span className="text-2xl">⚡</span>
            <span className="text-sm font-semibold text-foreground">דף אירוע</span>
            <span className="text-xs text-muted-foreground">אירוע ביטחוני ספציפי</span>
          </button>
          <button
            onClick={() => onCreate('reference')}
            className="col-span-2 flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-muted/40 hover:border-primary hover:bg-primary/5 transition-all p-5 text-center"
          >
            <span className="text-2xl">📚</span>
            <span className="text-sm font-semibold text-foreground">דף עיון</span>
            <span className="text-xs text-muted-foreground">סקירת מקורות וסינתזה חוצת-נושאים</span>
          </button>
        </div>
        <Button variant="ghost" size="sm" className="w-full font-heebo" onClick={onClose}>ביטול</Button>
      </div>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function Pagination({ pages, current, onChange }: {
  pages: number; current: number; onChange: (p: number) => void
}) {
  if (pages <= 1) return null

  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - current) <= 1) {
      nums.push(i)
    } else if (nums[nums.length - 1] !== '…') {
      nums.push('…')
    }
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <button
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
      >←</button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={i} className="px-1.5 py-1 text-xs text-muted-foreground">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onChange(n as number)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              n === current
                ? 'bg-foreground text-white font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        disabled={current >= pages}
        onClick={() => onChange(current + 1)}
        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
      >→</button>
    </div>
  )
}

// ── Main ContentTable ─────────────────────────────────────────────────────────

// Explicit LIFECYCLE order for the status column, not the alphabetical order of the enum's strings.
// With two values, localeCompare happened to give draft→published; adding 'archived' silently broke
// that (it sorts first alphabetically, ahead of draft). This map states the intended order — the
// sequence a page actually moves through — so a future status can't reorder the column by accident.
const STATUS_ORDER: Record<ContentPage['status'], number> = { draft: 0, published: 1, archived: 2 }

const TYPE_LABEL: Record<string, string> = { topic: 'נושא', event: 'אירוע', reference: 'עיון' }
const SORT_LABEL: Record<string, string> = { updatedAt: 'עודכן', title: 'כותרת', type: 'סוג', status: 'סטטוס' }

export function ContentTable() {
  const navigate = useNavigate()

  const fetchPages = useCallback(() => getPages(), [])
  const { status, data: pages, error, reload } = useAsync(fetchPages)
  const allPages = pages ?? []

  // Filters
  const [search, setSearch] = useState('')
  // A fourth exclusive value alongside draft/published, matching the existing pill pattern exactly —
  // "הכול" includes archived (all statuses), "פורסמו" still means literally status === 'published'.
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'topic' | 'event' | 'reference'>('all')

  // Sort
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'updatedAt', dir: 'desc' })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Mutations
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContentPage | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<ContentPage | null>(null)
  const [showTypeDialog, setShowTypeDialog] = useState(false)
  // Collapsed parent ids. Default expanded (empty set) — the tree is shallow, nothing worth hiding
  // yet, but the toggle works now so no second redesign is needed when a deeper hierarchy appears.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  // Live counts (always over the unfiltered list)
  const counts = {
    all:       allPages.length,
    draft:     allPages.filter((p) => p.status === 'draft').length,
    published: allPages.filter((p) => p.status === 'published').length,
    archived:  allPages.filter((p) => p.status === 'archived').length,
    topic:     allPages.filter((p) => p.type === 'topic').length,
    event:     allPages.filter((p) => p.type === 'event').length,
    reference: allPages.filter((p) => p.type === 'reference').length,
  }

  // Filter + sort pipeline
  const filtered = allPages.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (search && !p.title.includes(search)) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sort.col === 'title')     cmp = a.title.localeCompare(b.title, 'he')
    else if (sort.col === 'type') cmp = a.type.localeCompare(b.type)
    else if (sort.col === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    else                          cmp = a.updatedAt.localeCompare(b.updatedAt)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  // Hierarchy order → apply expand/collapse → paginate WITHOUT splitting a top-level group.
  const visibleRows = applyCollapse(orderByHierarchy(sorted), collapsed)
  const pageGroups = paginateByGroups(visibleRows, PAGE_SIZE)
  const safePage = Math.min(currentPage, pageGroups.length)
  const pageRows = pageGroups[safePage - 1] ?? []
  const pageStart = pageGroups.slice(0, safePage - 1).reduce((n, g) => n + g.length, 0)

  function handleSort(col: SortCol) {
    setSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }
    )
    setCurrentPage(1)
  }

  function pill(active: boolean) {
    return `inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium font-heebo transition-colors cursor-pointer border ${
      active
        ? 'bg-foreground text-white border-foreground'
        : 'bg-transparent border-border text-foreground hover:bg-muted/50'
    }`
  }

  function setStatus(s: 'all' | 'draft' | 'published' | 'archived') { setStatusFilter(s); setCurrentPage(1) }
  function toggleType(t: 'topic' | 'event' | 'reference') { setTypeFilter((prev) => prev === t ? 'all' : t); setCurrentPage(1) }

  function handleCreate(type: 'topic' | 'event' | 'reference') {
    setShowTypeDialog(false)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    if (type === 'topic') {
      const newPage: TopicPage = { id, type: 'topic', title: '', status: 'draft', createdAt: now, updatedAt: now, content: {} }
      navigate(`/page/${id}/edit`, { state: { newPage } })
    } else if (type === 'event') {
      const newPage: EventPage = { id, type: 'event', title: '', status: 'draft', createdAt: now, updatedAt: now, content: {} }
      navigate(`/page/${id}/edit`, { state: { newPage } })
    } else {
      const newPage: ReferencePage = { id, type: 'reference', title: '', status: 'draft', createdAt: now, updatedAt: now, content: { deepening: [] } }
      navigate(`/page/${id}/edit`, { state: { newPage } })
    }
  }

  async function handlePublish(page: ContentPage) {
    setMutatingId(page.id)
    setMutationError(null)
    try { await publishPage(page.id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  async function handleUnpublish(page: ContentPage) {
    setMutatingId(page.id)
    setMutationError(null)
    try { await unpublishPage(page.id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  async function handleArchive(page: ContentPage) {
    setMutatingId(page.id)
    setMutationError(null)
    try { await archivePage(page.id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  async function handleUnarchive(page: ContentPage) {
    setMutatingId(page.id)
    setMutationError(null)
    try { await unarchivePage(page.id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setMutatingId(id)
    setMutationError(null)
    try { await deletePage(id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  async function confirmRestore() {
    if (!restoreTarget) return
    const { id } = restoreTarget
    setRestoreTarget(null)
    setMutatingId(id)
    setMutationError(null)
    try { await restorePage(id); reload() }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'שגיאה') }
    finally { setMutatingId(null) }
  }

  return (
    <div dir="rtl">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5 justify-between">
        <h1 className="text-2xl font-bold text-foreground font-heebo">עמודי תוכן</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="חיפוש לפי כותרת..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pr-8 w-44 h-8 text-xs bg-card text-right font-heebo"
            />
          </div>

          {/* Status pills */}
          <button className={pill(statusFilter === 'all')}    onClick={() => setStatus('all')}>       הכול · {counts.all}       </button>
          <button className={pill(statusFilter === 'draft')}  onClick={() => setStatus('draft')}>     טיוטות · {counts.draft}   </button>
          <button className={pill(statusFilter === 'published')} onClick={() => setStatus('published')}> פורסמו · {counts.published} </button>
          <button className={pill(statusFilter === 'archived')} onClick={() => setStatus('archived')}>
            <Archive className="size-3" /> בארכיון · {counts.archived}
          </button>

          {/* Type pills */}
          <button className={pill(typeFilter === 'topic')} onClick={() => toggleType('topic')}> נושא · {counts.topic} </button>
          <button className={pill(typeFilter === 'event')} onClick={() => toggleType('event')}> אירוע · {counts.event} </button>
          <button className={pill(typeFilter === 'reference')} onClick={() => toggleType('reference')}> עיון · {counts.reference} </button>
        </div>
      </div>

      {/* ── New page button ───────────────────────────────────────────────── */}
      <div className="mb-4">
        <Button className="gap-2 font-heebo" onClick={() => setShowTypeDialog(true)}>
          <Plus className="size-4" />
          עמוד חדש
        </Button>
      </div>

      {/* ── Mutation error banner ─────────────────────────────────────────── */}
      {mutationError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{mutationError}</span>
          <button onClick={() => setMutationError(null)} className="text-red-400 hover:text-red-600 text-xs underline shrink-0">סגור</button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        {status === 'loading' && (
          <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm font-heebo">טוען דפים...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-20 flex flex-col items-center gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>נסה שוב</Button>
          </div>
        )}

        {status === 'success' && (
          // Phones get stacked cards, not a scrolling table: below sm the table/row/cell
          // elements are re-laid out as blocks and the header row is hidden. One markup
          // source serves both shapes — there is no separate mobile list to keep in sync.
          <div className="overflow-x-visible sm:overflow-x-auto
            max-sm:[&_table]:block max-sm:[&_thead]:hidden max-sm:[&_tbody]:block
            max-sm:[&_tr]:block max-sm:[&_tr]:rounded-xl max-sm:[&_tr]:border
            max-sm:[&_tr]:border-border max-sm:[&_tr]:mb-3 max-sm:[&_tr]:bg-card
            max-sm:[&_td]:block max-sm:[&_td]:w-auto max-sm:[&_td]:border-0
            max-sm:[&_td]:px-4 max-sm:[&_td]:py-2 max-sm:[&_td:first-child]:pt-4
            max-sm:[&_td:last-child]:pb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border">
                  <TableHead className="text-right py-3 h-auto w-[35%]">
                    <SortHeader col="title"     label="כותרת" sort={sort} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right py-3 h-auto w-16 hidden sm:table-cell">
                    <SortHeader col="type"      label="סוג"   sort={sort} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right py-3 h-auto">
                    <SortHeader col="status"    label="סטטוס" sort={sort} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right py-3 h-auto w-28 hidden md:table-cell">
                    <SortHeader col="updatedAt" label="עודכן" sort={sort} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right py-3 h-auto">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-muted-foreground">פעולות</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center text-muted-foreground">
                      <p className="text-base font-heebo">לא נמצאו דפים</p>
                      <p className="text-sm mt-1 font-heebo">נסה לשנות את הפילטרים</p>
                    </TableCell>
                  </TableRow>
                )}

                {pageRows.map(({ page, depth, guides, hasChildren, key: rowKey, primaryTopicId }) => {
                  const isMutating   = mutatingId === page.id
                  const isExpanded   = !collapsed.has(page.id)
                  const gate         = computeGate(page, allPages)
                  const hasChanges   = hasUnpublishedChanges(page)
                  const blockReasonText = blockReason(page, allPages)
                  const hasSnapshot  = !!page.publishedSnapshot

                  // Build ⋯ menu
                  const menuItems: MenuItem[] = []
                  if (page.status === 'published') {
                    menuItems.push({
                      // Never disabled by blockReasonText — decision 2: archiving has zero cascading
                      // effect, an analyst can archive regardless of the status of anything connected
                      // to this page. Contrast "ביטול פרסום"/"מחיקה" just below, which ARE gated.
                      label: 'העבר לארכיון',
                      onClick: () => handleArchive(page),
                    })
                    menuItems.push({
                      label: 'ביטול פרסום',
                      disabled: !!blockReasonText,
                      reason: blockReasonText ?? undefined,
                      onClick: () => handleUnpublish(page),
                    })
                    menuItems.push({
                      label: 'מחיקה',
                      disabled: !!blockReasonText,
                      reason: blockReasonText ?? undefined,
                      destructive: !blockReasonText,
                      onClick: () => setDeleteTarget(page),
                    })
                    menuItems.push({
                      label: 'שחזור לגרסה שפורסמה',
                      disabled: !hasChanges,
                      reason: !hasChanges ? 'אין שינויים שלא פורסמו' : undefined,
                      onClick: () => setRestoreTarget(page),
                      separator: true,
                    })
                  } else if (page.status === 'archived') {
                    menuItems.push({
                      // Never disabled — same reasoning as "העבר לארכיון" above (decision 2).
                      label: 'הוצא מארכיון',
                      onClick: () => handleUnarchive(page),
                    })
                    menuItems.push({
                      label: 'מחיקה',
                      disabled: !!blockReasonText,
                      reason: blockReasonText ?? undefined,
                      destructive: !blockReasonText,
                      onClick: () => setDeleteTarget(page),
                    })
                    menuItems.push({
                      label: 'שחזור לגרסה שפורסמה',
                      disabled: !hasChanges,
                      reason: !hasChanges ? 'אין שינויים שלא פורסמו' : undefined,
                      onClick: () => setRestoreTarget(page),
                      separator: true,
                    })
                  } else {
                    menuItems.push({
                      label: 'מחיקה',
                      destructive: true,
                      onClick: () => setDeleteTarget(page),
                    })
                    if (hasSnapshot) {
                      menuItems.push({
                        label: 'שחזור לגרסה שפורסמה',
                        onClick: () => setRestoreTarget(page),
                        separator: true,
                      })
                    }
                  }

                  return (
                    <TableRow
                      key={rowKey}
                      className={`hover:bg-muted/10 transition-colors border-b border-border/50 last:border-b-0 ${
                        page.status === 'archived' ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Title — tree table: RTL connectors + per-parent expand/collapse, plus the
                          explicit "תחת: דף נושא …" caption on child rows (both, not one instead of the other). */}
                      <TableCell className="py-3">
                        <div className="flex items-stretch">
                          <TreeGuides guides={guides} />
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(page.id)}
                              className="shrink-0 self-center flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'כווץ דפי בן' : 'הרחב דפי בן'}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
                            </button>
                          ) : (
                            <span className="shrink-0 size-5" aria-hidden />
                          )}
                          <div className="min-w-0">
                            <a
                              href={`/page/${page.id}/view`}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                              onClick={(e) => { e.preventDefault(); navigate(`/page/${page.id}/view`) }}
                            >
                              {page.title || <span className="font-normal italic text-muted-foreground">ללא שם</span>}
                            </a>
                            {/* Redundant with indentation whenever the row is genuinely nested — omit
                                there. Kept ONLY for the orphaned-root case (depth === 0 despite having
                                a real parentTopicId): that row renders unindented, indistinguishable
                                from a true root topic, so this caption is the only remaining signal it
                                actually has a parent currently filtered out of view. */}
                            {page.type === 'topic' && page.parentTopicId && depth === 0 && (() => {
                              const parent = allPages.find((p) => p.id === page.parentTopicId)
                              if (!parent) return null
                              return (
                                <a
                                  href={`/page/${parent.id}/view`}
                                  onClick={(e) => { e.preventDefault(); navigate(`/page/${parent.id}/view`) }}
                                  className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors font-heebo w-fit"
                                  title={`דף נושא בן — תחת: ${parent.title}`}
                                >
                                  {/* ↳ flipped for RTL via CSS transform, not a different glyph. */}
                                  <span aria-hidden className="text-[13px] leading-none inline-block" style={{ transform: 'scaleX(-1)' }}>↳</span>
                                  <span className="truncate max-w-[16rem]">
                                    תחת: דף נושא {parent.title}{parent.status === 'draft' ? ' (טיוטה)' : parent.status === 'archived' ? ' (בארכיון)' : ''}
                                  </span>
                                </a>
                              )
                            })()}
                            {/* Topic → events is now shown by NESTING the events as tree rows (option A),
                                so the old "אירועים מקושרים:" caption is removed as redundant. */}
                            {/* Event → NON-PRIMARY linked topics only. The primary (deepest — see
                                primaryTopicOf in orderByHierarchy) is already shown via nesting, so it's
                                excluded here; this caption's job is only what indentation can't show.
                                When primaryTopicId is undefined (standalone-root fallback: this event's
                                topic(s) are filtered out of the current view, so nesting represents NO
                                relationship right now) no topic id ever equals undefined, so the filter
                                below is a no-op and everything is shown — correct for that case with no
                                separate branch needed. LinkedRowCaption no-ops on an empty array itself,
                                so no outer length/depth check is needed either. */}
                            {page.type === 'event' && (() => {
                              const linkedTopics = (page.linkedPageIds ?? [])
                                .map((id) => allPages.find((p) => p.id === id))
                                .filter((p): p is ContentPage => !!p && p.type === 'topic')
                              const captionTopics = linkedTopics.filter((t) => t.id !== primaryTopicId)
                              return (
                                <LinkedRowCaption
                                  label="מקושר אל:"
                                  pages={captionTopics}
                                  onNav={(id) => navigate(`/page/${id}/view`)}
                                />
                              )
                            })()}
                          </div>
                        </div>
                      </TableCell>

                      {/* Type — hidden on phones, see the header comment */}
                      <TableCell className="py-3 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground font-heebo">{TYPE_LABEL[page.type]}</span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        <StatusCell page={page} hasChanges={hasChanges} gate={gate} />
                      </TableCell>

                      {/* Updated */}
                      <TableCell className="py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground font-heebo">{formatRelativeTime(page.updatedAt)}</span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3">
                        {isMutating ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {page.status === 'published' || page.status === 'archived' ? (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 font-heebo"
                                  onClick={() => navigate(`/page/${page.id}/edit`)}>
                                  עריכה
                                </Button>
                                {/* For an archived page this correctly routes to the archived-notice
                                    screen (decision 6), not the real content — same URL, same rule,
                                    for every navigator including the analyst's own list. */}
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 font-heebo"
                                  onClick={() => navigate(`/page/${page.id}/view`)}>
                                  צפייה
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 font-heebo"
                                  onClick={() => navigate(`/page/${page.id}/edit`)}>
                                  המשך עריכה
                                </Button>
                                <PublishButton gate={gate} loading={false} onClick={() => handlePublish(page)} />
                              </>
                            )}
                            <ActionMenu items={menuItems} />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {status === 'success' && sorted.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-heebo">
          <Pagination pages={pageGroups.length} current={safePage} onChange={setCurrentPage} />
          <span>
            מציג {pageStart + 1}–{pageStart + pageRows.length} מתוך {visibleRows.length}
            {' · '}מיון: {SORT_LABEL[sort.col]} {sort.dir === 'desc' ? '↓' : '↑'}
            {' · '}מחיקה תמיד מבקשת אישור
          </span>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <TypePickerDialog open={showTypeDialog} onClose={() => setShowTypeDialog(false)} onCreate={handleCreate} />
      <DeleteDialog  page={deleteTarget}  onConfirm={confirmDelete}  onClose={() => setDeleteTarget(null)} />
      <RestoreDialog page={restoreTarget} onConfirm={confirmRestore} onClose={() => setRestoreTarget(null)} />
    </div>
  )
}
