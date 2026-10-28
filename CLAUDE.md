# Working agreement — got-showcase

## What this repo is

A public portfolio demo: a Hebrew, right-to-left knowledge-page editor (topic / event / reference
pages behind a publish gate), shown with an invented Game-of-Thrones-flavoured dataset. It is a
front end only — state lives in `localStorage` behind a service layer. It is a copy of a private
app, rebuilt with original content.

## Ask Or first — never self-heal

- **No commit, no push, no creating a repo, and never flipping anything public** without Or's
  explicit approval, each time. Approval for one of these is not approval for the next.
- No system or OS settings. If something seems to need them, stop and ask.
- Never read, run or touch any private repo.

## Content rules

- **No real data, and no names or terms from any real workplace.** Every string here is invented
  for the demo. Names of houses, places and characters are labels only; the setting is unofficial
  and unaffiliated with the rights holders.
- If a value cannot be shown truthfully, omit it and warn the author. Never fake a position.

## Dataset changes require a seed-version bump

Seeding runs only when the storage key is **absent** (`pageService.ts`). After any change to
`src/data/*.ts`, bump `PAGES_KEY`, `LINKS_KEY` and `TOPIC_LINKS_KEY` together, or a browser that
already loaded the app keeps the old dataset and it reads as a rendering bug. Verifying on a **new
port** or in a fresh browser context is the reliable check — both give empty `localStorage`.

## Writing content into source files

**Write dataset and content changes through a `.py` script or a JSON file — never through a bash
heredoc.** Heredocs in this environment eat backslashes and have silently truncated multi-line
patches here more than once; the file still parses and the damage only shows up as wrong text on a
rendered page. Write an anchored-replacement script that asserts each anchor matches an **expected
count** and refuses to write anything if any anchor misses. The scripts live outside the repo,
in `../got-showcase-review/tools/` — `patch_mobile2.py` and `patch_timeline_f1.py` are the
pattern. Keep the script after running it.

## Public asset paths go through `assetPath()`

`vite.config.ts` sets `base: './'` so the build works from any deploy path. Vite rewrites bundled
imports for that base but **not** path strings held in data. Any `/demo-images/...`,
`/mock-files/...` or `/bundles/...` string must be wrapped in `assetPath()`
(`src/lib/assetPath.ts`) or it 404s under a subpath deploy. One source for the rule.

## Verification

- **Verify the rendered DOM in a fresh browser context before saying "verified."** A fresh context
  means empty storage and a full page load, not client-side navigation from another route.
- **Mobile verification must include overlap/squeeze detection and a visual read of the
  screenshots. Zero overflow is not sufficient.** Comparing rectangles to the viewport edge says
  nothing about whether text inside a scroll container is readable; a panel can pass that check
  while rendering one character per line. The detectors in
  `../got-showcase-review/tools/_detectors.cjs` cover overlapping siblings, text squeezed into a
  sliver, text clipped beyond reach, truncated must-show values,
  and the edge check — run them with `../got-showcase-review/tools/_sweep_all.cjs` across every
  surface and width, then look at the screenshots.
- **Always say what was NOT verified.** A claim without evidence beside it is not a result, and
  "it should be fine" is not a check.
