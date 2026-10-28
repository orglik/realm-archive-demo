import type { ContentPage } from '@/types/contentPage'

/**
 * Returns true if the page's working copy (title + content) differs from its
 * last published snapshot. Derived by comparison — not stored as a status flag.
 *
 * Returns false when there is no snapshot (page was never published, so there
 * is nothing to compare against).
 */
export function hasUnpublishedChanges(page: ContentPage): boolean {
  if (!page.publishedSnapshot) return false
  return (
    page.title !== page.publishedSnapshot.title ||
    JSON.stringify(page.content ?? {}) !== JSON.stringify(page.publishedSnapshot.content ?? {})
  )
}
