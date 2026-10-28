import { DEMO_NOTICE } from '@/lib/brand'

/**
 * Persistent fictional-data notice. Rendered at the top of every screen — management list, editor,
 * analyst viewer, reader viewer and reader home — so no route can be screenshotted or deep-linked
 * without it. Deliberately NOT dismissible: the whole point is that it survives a shared link.
 */
export function DemoBanner() {
  return (
    <div
      dir="rtl"
      role="note"
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-900
                 text-[11px] leading-snug font-heebo px-4 py-1.5 text-center"
    >
      {DEMO_NOTICE}
    </div>
  )
}
