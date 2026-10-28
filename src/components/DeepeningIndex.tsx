import type { DeepeningItem } from '@/types/contentPage'

// ── העמקה dossier index (design anchor 1b) ─────────────────────────────────────
// A numbered section card whose rows are a dossier-style index: thumbnail + kicker + title + meta +
// chevron. Bundles (אוגדן) carry a structural paper-stack; documents (מסמך) do not. The current
// DeepeningItem schema has no image/count/date fields, so every tile uses the designed EMPTY-IMAGE
// treatment (ruled-paper for a doc, dark plate for a bundle) — not a broken/generic placeholder.

function itemHref(item: DeepeningItem): string | undefined {
  const raw = item.type === 'אוגדן' ? item.url : item.fileRef
  return raw && !raw.startsWith('mock://') ? raw : undefined
}
function itemMeta(item: DeepeningItem): string | undefined {
  // Best-effort from the fields we actually have (no counts/dates in the schema yet).
  return item.type === 'מסמך' ? item.fileName : undefined
}

// Bundle: stack sheets peeking on the right, behind the cover/plate. Structural, not colour-coded.
function BundleThumb() {
  return (
    <div className="relative flex-none w-full h-[110px] sm:w-[104px] sm:h-[74px]">
      <div className="absolute" style={{ inset: '10px -12px 0 12px', border: '1px solid #D3DDE7', borderRadius: 6, background: '#EDF1F5' }} />
      <div className="absolute" style={{ inset: '5px -6px 3px 6px', border: '1px solid var(--lp-control)', borderRadius: 6, background: '#F5F8FA' }} />
      <div className="absolute flex items-end" style={{ inset: 0, borderRadius: 6, border: '1px solid var(--lp-control)', background: 'var(--lp-plate)', padding: 8 }}>
        <span className="font-mono" style={{ fontSize: 9.5, color: 'rgba(255,255,255,.45)', letterSpacing: '.12em' }}>BUNDLE</span>
      </div>
    </div>
  )
}

// Document empty image: ruled-paper tile in the system paper tone, DOC label on a chip that clears the rules.
function DocThumb() {
  return (
    <div
      className="relative flex-none flex items-center justify-center w-full h-[110px] sm:w-[104px] sm:h-[74px]"
      style={{ borderRadius: 6, border: '1px solid var(--lp-control)', background: '#F6F8FA', backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 13px, #E6ECF2 13px 14px)' }}
    >
      <span className="font-mono" style={{ fontSize: 10, color: '#9CB0C4', letterSpacing: '.1em', background: '#F6F8FA', padding: '2px 5px' }}>DOC</span>
    </div>
  )
}

function Row({ item, last }: { item: DeepeningItem; last: boolean }) {
  const href = itemHref(item)
  const isBundle = item.type === 'אוגדן'
  const meta = itemMeta(item)

  const inner = (
    <>
      {isBundle ? <BundleThumb /> : <DocThumb />}
      <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
        <div className="font-mono font-semibold" style={{ fontSize: 10.5, letterSpacing: '.14em', color: isBundle ? 'var(--lp-blue-label)' : 'var(--lp-label)' }}>
          {item.type}
        </div>
        <div className="font-heebo font-semibold break-words" style={{ fontSize: 16.5, lineHeight: 1.35, color: 'var(--lp-ink)' }}>{item.title}</div>
        {meta && <div className="font-heebo break-all" style={{ fontSize: 12.5, color: 'var(--lp-meta)' }}>{meta}</div>}
      </div>
      <span className="flex-none text-[15px] leading-none self-end sm:self-auto" style={{ color: 'var(--lp-faint)' }}>←</span>
    </>
  )

  const cls = 'flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 hover:bg-[var(--lp-row-hover)] transition-colors'
  const style: React.CSSProperties = { padding: '14px 8px', borderBottom: last ? 'none' : '1px solid var(--lp-hairline-inner)' }

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring`} style={style}>{inner}</a>
  ) : (
    <div className={cls} style={style}>{inner}</div>
  )
}

export function DeepeningIndex({ id, num, items }: { id: string; num: string; items: DeepeningItem[] }) {
  return (
    <section id={id} className="scroll-mt-24" style={{ background: '#fff', border: '1px solid var(--lp-hairline)', borderRadius: 14, padding: '28px 30px 30px' }}>
      <div className="flex items-baseline gap-2.5 mb-[22px]">
        <span className="font-mono font-bold" style={{ fontSize: 15, color: 'var(--lp-blue-num)' }}>{num}</span>
        <h2 className="font-heebo font-bold" style={{ fontSize: 24, letterSpacing: '-.01em', color: 'var(--lp-ink)' }}>העמקה</h2>
      </div>
      <div className="flex flex-col">
        {items.map((item, i) => <Row key={i} item={item} last={i === items.length - 1} />)}
      </div>
    </section>
  )
}
