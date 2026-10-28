import { createContext, useContext } from 'react'

// How the viewer builds links to OTHER pages.
//
// PageViewer and everything under it (breadcrumbs, the linked-pages ribbon) render the same content
// for a reader and for an analyst — but the links inside that content must point at different
// routes, because the two audiences get different chrome and different guards.
//
// The context therefore carries a link BUILDER, not an audience label. Nothing inside PageViewer
// ever branches on "am I being read by a reader or an analyst" — it only ever asks "how do I link
// to a page from here". That keeps the viewer audience-blind, which is what makes it safe to share.
//
// Deliberately a plain .ts module exporting no components: mixing component and non-component
// exports breaks React Fast Refresh (react-refresh/only-export-components). Wrappers therefore use
// <PageLinkContext.Provider value={...}> directly rather than a wrapper component.

/** Builds the href for a page, given its id. */
export type PageHref = (id: string) => string

/** Reader-facing route — public chrome, published-only guard. */
export const readerHref: PageHref = (id) => `/read/${id}`

/** Analyst-facing route — edit/list controls, renders drafts for preview. */
export const analystHref: PageHref = (id) => `/page/${id}/view`

export const PageLinkContext = createContext<PageHref | null>(null)

/**
 * Deliberately has NO default value, and throws when unwrapped.
 *
 * A default would mean any future wrapper that forgets to provide silently inherits the other
 * audience's links — which is precisely the bug this split exists to fix (reader-facing pages were
 * linking into the analyst tool). Failing at render costs one line per wrapper and makes the
 * omission impossible to ship unnoticed.
 */
export function usePageHref(): PageHref {
  const href = useContext(PageLinkContext)
  if (!href) {
    throw new Error(
      'usePageHref: no PageLinkContext.Provider found. Any wrapper rendering <PageViewer> must ' +
      'declare its audience: <PageLinkContext.Provider value={readerHref | analystHref}>.'
    )
  }
  return href
}
