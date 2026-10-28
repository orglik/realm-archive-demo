# Network audit

The production build is checked for third-party URLs before every release. This file records
the method and the full result so the README can state the conclusion in one line.

## Method

```bash
npm run build
grep -rhoE "https?://[^\"',;)}]+" dist | sort -u
```

Separately, `src/` is searched for outbound-request primitives and `index.html` for external
tags:

```bash
grep -rnE "\bfetch\(|XMLHttpRequest|new WebSocket|navigator\.sendBeacon|import\(" src/
grep -nE "<link|<script" index.html
```

## Link-preview metadata (added after the first deploy)

`index.html` carries Open Graph and Twitter card tags whose `og:url`, `og:image` and
`twitter:image` values are ABSOLUTE `https://orglik.github.io/...` URLs. They are **metadata read
by a crawler when someone shares the link** — the app never requests them, and no code path
dereferences them. They do appear in `dist/index.html`, so the grep below now reports them and
they must be recognised rather than treated as a regression.

The preview image itself, `og-image.png`, is served from this site's own origin like any other
file in `public/`.

## Result

Eleven distinct absolute URLs now appear in `dist/`: the nine below, plus the two
`orglik.github.io` metadata values just described. **None is a request target.**

| URL | What it is | Fetched? |
|---|---|---|
| `http://www.w3.org/2000/svg` | XML namespace identifier, one per SVG file | no |
| `http://www.w3.org/1999/xlink` | XML namespace identifier | no |
| `http://www.w3.org/1998/Math/MathML` | XML namespace identifier | no |
| `http://www.w3.org/XML/1998/namespace` | XML namespace identifier | no |
| `https://react.dev/errors/` | documentation link inside a React error message | no |
| `https://reactrouter.com/en/main/routers/picking-a-router` | documentation link in a React Router warning | no |
| `https://base-ui.com/production-error` | documentation link in a Base UI error message | no |
| `https://github.com/ungap/url-search-params` | attribution comment in a bundled polyfill | no |
| `http://localhost` | React Router's internal fallback base for URL parsing | no |

Plus the literal placeholder text `https://...` shown inside an editor input field.

`src/` contains no `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or dynamic `import(`.
`index.html` loads only `/favicon.svg` and `/src/main.tsx`.

Fonts are bundled from `@fontsource` and served from the app's own origin; the Google Fonts
`<link>` tags that the project started with were removed. Images are SVGs generated in this
repository by `tools/make_svgs.py`. There is no analytics, map tile service or CDN call.
