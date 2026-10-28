# Archive of the Realm — demo

A knowledge-page editor where analysts write topic, event and reference pages, and nothing reaches readers until it passes a publish gate. It comes from a real product need I worked on as a PM. This version is a demo, shown with public data, built to practice directing AI agents with written premises and independent review.

> **This is a demo, not the production tool.** The content was written from scratch for this repository, and the dataset is fictional and contains no real data.

---

## Live demo

https://orglik.github.io/realm-archive-demo/

## What it does

**Three page types.** A *topic* page frames an arena or a subject over a period. An *event* page covers a single incident with a structured detail grid. A *reference* page is a lateral resource that sits outside the topic hierarchy.

**A publish gate.** A page stays invisible to readers until it passes validation. The interesting half of the rule is not blank fields — it is relationship state: a fully filled event page is still blocked when the only topic it links to is itself a draft. The demo includes a page in exactly that position.

**Published snapshots.** Publishing freezes a copy of the content. Every reader surface renders from that frozen snapshot, never from the live draft, so editing a published page changes nothing for readers until it is published again.

**Reader and analyst are separate by construction.** Readers get `#/read/:id`; analysts get `#/page/:id/view` and the editor. The split is enforced by a React context that throws when a link is built without it — not by a flag someone can forget to check. Reader surfaces never link into analyst routes.

**A two-axis timeline.** Events run on two banks with meeting points between them, marked either as a response or as simultaneous. *Sides are relative to each page's subject.* Side א׳ is always the subject of the page you are reading, and side ב׳ is its counterpart — so the same incident can appear with the sides swapped on two different pages, which is the point.

Alongside the banks, *influencing factors* carry context that is not an event: a drought, a season, a rule that was in force. They have no dot and take no part in layout. A factor dated outside the span of the events is **omitted rather than clamped** to the edge, and the editor warns the author — if the system cannot place something truthfully, it does not place it at all.

**Archiving.** Archive is reversible, applies only to published pages, and cascades to nothing. Archived pages disappear from reader surfaces but stay visible to editors with a tag.

## Scope

This repository is the front end only. There is no backend: state lives in localStorage behind
a service layer designed to be swapped for a real API. In the real product, the backend and
integration were owned by someone else, and the handoff included the spec and the service-layer
contract.

There are **no automated tests** in this repository.

The reader and analyst screens are responsive down to 320px, checked with layout detectors across
all pages and by hand at 375.

## Running it

```bash
npm install
npm run dev
```

The dataset seeds itself into `localStorage` on first load. To get a clean copy, clear site data for the origin and reload.

```bash
npm run build     # production build; works from any deploy path
npm run preview
```

## Built with

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui on Base UI · React Router (hash router). The interface is Hebrew and right-to-left throughout.

No backend: state lives in `localStorage` behind a service layer that mimics an async API, so the storage can be swapped for a real one without touching the components.

**No third-party URL in the production build is ever fetched.** Fonts are self-hosted, images
are SVGs generated in this repository, and there is no analytics, map tile service or CDN call.
Checked by listing every absolute URL in `dist/` after a build and confirming each one is an XML
namespace, a documentation link inside a library error message, or an internal parsing fallback —
full inventory in [`docs/network-audit.md`](docs/network-audit.md).

---

## Content and licensing

### The fiction

The demo is set in the world of *A Song of Ice and Fire* / *Game of Thrones*. **It is unofficial, and is not affiliated with, endorsed by or connected to the rights holders.** Names of houses, places and widely known characters are used as labels only. The names themselves belong to their owners and are not mine to license. Every description, summary, timeline label, document and illustration in this repository was written or drawn from scratch; the plot points referenced are publicly known. No sigils, crests, logos or artwork from any published work appear anywhere in it.

### The license

The **code and the original Hebrew text** in this repository — and only those — are licensed under the **PolyForm Noncommercial License 1.0.0**. The full text is in [`LICENSE`](LICENSE).

This license does not and cannot extend to the fictional names and setting described above.

### Fonts

Heebo, Noto Sans Hebrew and IBM Plex Mono are bundled via `@fontsource` and are licensed under the SIL Open Font License 1.1. Full license texts are in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

---
---

<div dir="rtl">

# ארכיון הממלכה — דמו

עורך דפי ידע שבו אנליסטים כותבים דפי נושא, אירוע ועיון, ושום דבר אינו מגיע לקוראים עד שהוא עובר שער פרסום. הוא נובע מצורך מוצרי אמיתי שעבדתי עליו כמנהלת מוצר. הגרסה הזו היא דמו, המוצג עם נתונים פומביים, שנבנה כדי להתאמן בהכוונת סוכני AI באמצעות הנחות כתובות וביקורת עצמאית.

> **זהו דמו ולא הכלי שבייצור.** התוכן נכתב מאפס עבור המאגר הזה, ומערך הנתונים בדיוני ואינו מכיל נתונים אמיתיים.

---

## הדגמה חיה

https://orglik.github.io/realm-archive-demo/

## מה הוא עושה

**שלושה סוגי דפים.** דף *נושא* ממסגר זירה או נושא לאורך תקופה. דף *אירוע* מתאר אירוע יחיד עם רשת פרטים מובנית. דף *עיון* הוא משאב רוחבי שיושב מחוץ להיררכיית הנושאים.

**שער פרסום.** דף נותר בלתי נראה לקוראים עד שהוא עובר אימות. החלק המעניין בכלל אינו שדות ריקים אלא מצב הקשרים: דף אירוע מלא לגמרי עדיין חסום כאשר דף הנושא היחיד שהוא מקושר אליו הוא עצמו טיוטה. בדמו יש דף שנמצא בדיוק במצב הזה.

**תמונת מצב מפורסמת.** הפרסום מקפיא עותק של התוכן. כל משטח קריאה מוצג מתוך העותק הקפוא ולעולם לא מתוך הטיוטה החיה, כך שעריכת דף מפורסם אינה משנה דבר עבור הקוראים עד הפרסום הבא.

**קורא ואנליסט מופרדים מעצם הבנייה.** הקוראים מקבלים `#/read/:id`, והאנליסטים מקבלים `#/page/:id/view` ואת העורך. ההפרדה נאכפת על ידי הקשר (context) שזורק שגיאה כשנבנה קישור בלעדיו — ולא על ידי דגל שאפשר לשכוח לבדוק. משטחי הקריאה לעולם אינם מקשרים לנתיבי האנליסט.

**ציר זמן דו-צירי.** אירועים נעים בשני צירים ובהם נקודות מפגש, המסומנות כתגובה או כבו-זמניות. *הצדדים הם ביחס לנושא של כל דף.* צד א׳ הוא תמיד נושא הדף שקוראים, וצד ב׳ הוא מי שמולו — כך שאותו אירוע יכול להופיע עם צדדים הפוכים בשני דפים שונים, וזו בדיוק הנקודה.

לצד הצירים, *גורמים משפיעים* נושאים הקשר שאינו אירוע: בצורת, עונה, כלל שהיה בתוקף. אין להם נקודה ואינם משתתפים בפריסה. גורם שמתוארך מחוץ לטווח האירועים **מושמט ולא נצמד** לקצה, והעורך מתריע בפני הכותב — אם המערכת אינה יכולה למקם משהו באמת, היא אינה ממקמת אותו כלל.

**ארכיון.** ההעברה לארכיון הפיכה, חלה רק על דפים מפורסמים, ואינה גוררת דבר. דפים בארכיון נעלמים ממשטחי הקריאה אך נשארים גלויים לעורכים עם תגית.

## היקף

המאגר הזה הוא צד לקוח בלבד. אין בו שרת: המצב נשמר ב-localStorage מאחורי שכבת שירות שתוכננה כך
שניתן יהיה להחליף אותה ב-API אמיתי. במוצר האמיתי, השרת והאינטגרציה היו באחריות מישהו אחר,
וההעברה כללה את האפיון ואת חוזה שכבת השירות.

אין במאגר הזה **בדיקות אוטומטיות**.

מסכי הקורא והאנליסט מותאמים למסכים ברוחב 320 פיקסלים ומעלה, נבדקו באמצעות גלאי פריסה על כל
הדפים ובבדיקה ידנית ברוחב 375.

## הרצה

```bash
npm install
npm run dev
```

מערך הנתונים נזרע אל `localStorage` בטעינה הראשונה. לקבלת עותק נקי, נקו את נתוני האתר עבור המקור (origin) וטענו מחדש.

```bash
npm run build     # בניית ייצור; עובדת מכל נתיב פריסה
npm run preview
```

## נבנה עם

React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui על Base UI · React Router (נתב hash). הממשק כולו בעברית ומימין לשמאל.

ללא שרת: המצב נשמר ב-`localStorage` מאחורי שכבת שירות שמחקה API אסינכרוני, כך שניתן להחליף את האחסון באמיתי בלי לגעת ברכיבים.

**שום כתובת URL של צד שלישי בבניית הייצור אינה נטענת אי פעם.** הגופנים מאוחסנים מקומית, התמונות
הן קובצי SVG שנוצרו במאגר הזה, ואין בה אנליטיקה, שירות אריחי מפה או קריאת CDN. הבדיקה נעשתה
באמצעות ריכוז כל הכתובות המוחלטות ב-`dist/` לאחר בנייה, ואימות שכל אחת מהן היא מרחב שמות של XML,
קישור תיעוד בתוך הודעת שגיאה של ספרייה, או ברירת מחדל פנימית לפענוח כתובות — הפירוט המלא נמצא
ב-[`docs/network-audit.md`](docs/network-audit.md).

---

## תוכן ורישוי

### הבדיון

הדמו מתרחש בעולם של *שיר של אש ושל קרח* / *משחקי הכס*. **הוא אינו רשמי, ואינו מזוהה עם בעלי הזכויות, אינו מאושר על ידם ואינו קשור אליהם.** שמות של בתים, מקומות ודמויות מוכרות משמשים כתוויות בלבד. השמות עצמם שייכים לבעליהם ואינם שלי לרישוי. כל תיאור, תקציר, תווית בציר זמן, מסמך ואיור במאגר הזה נכתבו או שורטטו מאפס; נקודות העלילה המוזכרות ידועות בציבור. אין בו סמלים, שלטי אצולה, לוגואים או יצירות אמנות מתוך שום יצירה שפורסמה.

### הרישיון

**הקוד והטקסט העברי המקורי** במאגר הזה — ורק הם — מורשים תחת **PolyForm Noncommercial License 1.0.0**. הנוסח המלא נמצא בקובץ [`LICENSE`](LICENSE).

הרישיון הזה אינו חל, ואינו יכול לחול, על השמות הבדיוניים ועל העולם המתוארים לעיל.

### גופנים

הגופנים Heebo,‏ Noto Sans Hebrew ו-IBM Plex Mono נארזים דרך `@fontsource` ומורשים תחת SIL Open Font License 1.1. נוסחי הרישיונות המלאים נמצאים ב-[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

</div>
