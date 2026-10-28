import type { ReactNode } from 'react'

// Shared shell for the viewer's non-content states (archived / data error / not found /
// unavailable). Layout and typography are identical across audiences; only the message and the
// actions differ, so those are passed in. Keeping one shell means a reader-facing notice can
// never accidentally drift into looking like the analyst one.
export function ViewerNotice({
  icon, title, body, children,
}: {
  icon?: ReactNode
  title: string
  /** Optional second line. Omit for the reader's deliberately terse "unavailable" state. */
  body?: string
  /** Action buttons/links. The reader passes one; the analyst passes two. */
  children?: ReactNode
}) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#FAFCFE] flex flex-col items-center justify-center gap-3 text-center px-6"
    >
      {icon}
      <p className="text-base font-semibold text-foreground font-heebo">{title}</p>
      {body && <p className="text-sm text-muted-foreground font-heebo max-w-sm">{body}</p>}
      {children && <div className="flex items-center gap-2 mt-2">{children}</div>}
    </div>
  )
}
