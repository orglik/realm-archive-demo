/**
 * Resolves a root-relative `public/` asset path against the app's base URL.
 *
 * WHY: vite.config.ts sets `base: './'` so the bundle works from any deploy path (a GitHub Pages
 * project site serves from `/<repo>/`). Vite rewrites *bundled* imports for that base, but it does
 * NOT touch path strings carried in data — so a stored `/demo-images/x.svg` resolves against the
 * ORIGIN and 404s under a subpath. This turns it into `./demo-images/x.svg`, which resolves against
 * the document URL. That is safe here because the app uses a HASH router (App.tsx), so the document
 * URL never changes as the user navigates.
 *
 * ONE SOURCE for the rule: call it wherever a stored public-asset path is written or becomes a URL.
 * It is idempotent and leaves anything that is already a resolvable reference untouched —
 * `data:`, `blob:`, `http(s):`, `mock://` and already-relative paths all pass through unchanged,
 * so applying it twice, or to an editor-uploaded image, is a no-op.
 */
export function assetPath(p: string): string {
  if (!p || !p.startsWith('/')) return p
  // `import.meta.env` is undefined outside Vite (e.g. the `tsx` dataset dump script), hence the guard.
  const base: string = import.meta.env?.BASE_URL || '/'
  return base.replace(/\/+$/, '') + p
}
