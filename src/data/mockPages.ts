import type { ContentPage, TimelineData, TopicContent, EventContent, ReferencePageContent } from '@/types/contentPage'
import { assetPath } from '@/lib/assetPath'

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATASET — entirely fictional.
//
// Setting: the world of "A Song of Ice and Fire" / "Game of Thrones". Only names of houses, places
// and broadly known characters are used, as labels. Every description, summary, timeline label and
// document in this file was written from scratch for this demo.
// Plot points follow publicly known events. All wording is original.
//
// This is an UNOFFICIAL fan demo. It is not affiliated with, endorsed by, or connected to the rights
// holders. No sigils, crests, logos or imagery from any published work appear anywhere in it.
//
// DATES: the year 8298 is used deliberately. It is unambiguously fictional, and unlike a 3-digit
// in-world year (e.g. 0298) it formats identically on topic pages and event pages — formatDate()
// takes a different code path for date-only vs datetime values, and the datetime path drops a
// leading zero via getFullYear(). 8298 avoids that mismatch entirely.
// ─────────────────────────────────────────────────────────────────────────────

// ── Timeline: t2 "מסע הצפון" — the showcase timeline ─────────────────────────
// Covers every behaviour the viewer has: two populated banks, both meeting-point kinds, a collapsed
// gap (the 4-month lull), a point factor INSIDE that collapsed gap, a range factor spanning it, a
// deliberately long factor label that forces the chip to grow past its 88px floor, and one factor
// dated outside the event span, which the viewer omits and the editor warns about.
const northMarchTimeline: TimelineData = {
  enemyEvents: [
    { id: 'nm-e1', timestamp: '8298-03-04', label: 'סגירת הדרך המזרחית' },
    { id: 'nm-e2', timestamp: '8298-03-19', label: 'פשיטה על מחסני התבואה' },
    { id: 'nm-e3', timestamp: '8298-04-02', label: 'גיוס כוחות בעיר הגדולה' },
    { id: 'nm-e4', timestamp: '8298-04-21', label: 'חסימת מעבר הנהר' },
    { id: 'nm-e5', timestamp: '8298-09-08', label: 'חידוש התנועה דרומה' },
    { id: 'nm-e6', timestamp: '8298-09-27', label: 'תקיפת שיירת אספקה' },
  ],
  friendlyEvents: [
    { id: 'nm-f1', timestamp: '8298-03-11', label: 'כינוס הדגלים' },
    { id: 'nm-f2', timestamp: '8298-03-26', label: 'יציאה דרומה' },
    { id: 'nm-f3', timestamp: '8298-04-21', label: 'מעבר בנקודה רדודה' },
    { id: 'nm-f4', timestamp: '8298-09-14', label: 'ביצור המחנה הקדמי' },
    { id: 'nm-f5', timestamp: '8298-10-05', label: 'סיכום המסע' },
  ],
  meetingPoints: [
    // תגובה — our crossing answers the river blockade; same day, so the connector reads as a response.
    { id: 'nm-mp1', kind: 'תגובה', enemyEventId: 'nm-e4', friendlyEventId: 'nm-f3' },
    // בו-זמני — both sides move within the same week without either reacting to the other.
    { id: 'nm-mp2', kind: 'בו-זמני', enemyEventId: 'nm-e5', friendlyEventId: 'nm-f4', label: 'תנועה מקבילה' },
  ],
  influencingFactors: [
    // RANGE spanning the collapsed gap — context that outlasts the lull in events.
    { id: 'nm-if1', label: 'חורף ממושך', startTs: '8298-04-25', endTs: '8298-09-02' },
    // POINT inside the collapsed gap — must still resolve to a position within the compressed zone.
    { id: 'nm-if2', label: 'שיירות שליחים', startTs: '8298-06-20' },
    // LONG LABEL — 24 characters, past the 88px chip floor, so the chip must grow rather than clip.
    { id: 'nm-if3', label: 'כינוס בני הבית הגדולים בצפון', startTs: '8298-03-22' },
    // OUT OF SPAN — dated after the last event (8298-10-05). The viewer omits it; the editor warns.
    { id: 'nm-if4', label: 'ועידת החורף', startTs: '8299-01-15' },
  ],
}

// ── Timeline: t3 "המצור על קינגס לנדינג" ─────────────────────────────────────
const siegeTimeline: TimelineData = {
  // צד א׳ = the besieging force (friendlyEvents); צד ב׳ = the defenders inside the walls.
  // Matches this page's own arenaCharacteristics, which describe צד א׳ as the encircling force.
  enemyEvents: [
    { id: 'sg-e1', timestamp: '8298-07-02', label: 'סגירת השערים' },
    { id: 'sg-e2', timestamp: '8298-08-01', label: 'בלימה בחומה' },
  ],
  friendlyEvents: [
    { id: 'sg-f1', timestamp: '8298-07-05', label: 'כיתור מהיבשה' },
    { id: 'sg-f2', timestamp: '8298-07-15', label: 'הצבת מנגנוני מצור' },
    { id: 'sg-f3', timestamp: '8298-08-01', label: 'ניסיון פריצה' },
  ],
  meetingPoints: [
    { id: 'sg-mp1', kind: 'בו-זמני', enemyEventId: 'sg-e2', friendlyEventId: 'sg-f3' },
  ],
  influencingFactors: [
    { id: 'sg-if1', label: 'מחסור במים', startTs: '8298-07-20', endTs: '8298-08-04' },
  ],
}

// ── Timeline: e2 "קרב המים השחורים" — hours scale, both meeting kinds ────────
const blackwaterTimeline: TimelineData = {
  // צד א׳ = the attacking force (friendlyEvents); צד ב׳ = the city's defenders (enemyEvents).
  // Swapped from the first draft so the side letters match e2's infoGrid and t3's convention.
  enemyEvents: [
    { id: 'bw-e1', timestamp: '8298-08-12T19:55', label: 'הצתת המחסום' },
    { id: 'bw-e2', timestamp: '8298-08-12T22:05', label: 'יציאת פרשים' },
  ],
  friendlyEvents: [
    { id: 'bw-f1', timestamp: '8298-08-12T19:40', label: 'כניסת הצי למפרץ' },
    { id: 'bw-f2', timestamp: '8298-08-12T20:15', label: 'נחיתת כוח ראשון' },
    { id: 'bw-f3', timestamp: '8298-08-12T22:05', label: 'לחץ על השער' },
  ],
  meetingPoints: [
    // צד א׳ lands in response to צד ב׳'s barrier (+20 min).
    { id: 'bw-mp1', kind: 'תגובה', enemyEventId: 'bw-e1', friendlyEventId: 'bw-f2' },
    // Both sides act at 22:05 without either reacting to the other.
    { id: 'bw-mp2', kind: 'בו-זמני', enemyEventId: 'bw-e2', friendlyEventId: 'bw-f3' },
  ],
  influencingFactors: [
    { id: 'bw-if1', label: 'ליל ירח חדש', startTs: '8298-08-12T19:00', endTs: '8298-08-13T01:00' },
  ],
}

// ── Timeline: e3 "הקרב על חומות וינטרפל" — hours scale ───────────────────────
const winterfellTimeline: TimelineData = {
  enemyEvents: [
    { id: 'wf-e1', timestamp: '8298-09-27T04:20', label: 'הסתערות ראשונה' },
    { id: 'wf-e2', timestamp: '8298-09-27T06:10', label: 'פריצת השער החיצוני' },
  ],
  friendlyEvents: [
    { id: 'wf-f1', timestamp: '8298-09-27T04:45', label: 'איוש החומה' },
    { id: 'wf-f2', timestamp: '8298-09-27T07:30', label: 'נסיגה לחצר הפנימית' },
  ],
  meetingPoints: [
    { id: 'wf-mp1', kind: 'תגובה', enemyEventId: 'wf-e1', friendlyEventId: 'wf-f1' },
  ],
}

// Timeline: t1 — the umbrella topic, months scale. צד א׳ = the northern alliance (matches this page's arenaCharacteristics).
const fiveKingsTimeline: TimelineData = {
  enemyEvents: [
    { id: 'fiv-e1', timestamp: '8298-02-02', label: 'הכרזת בית יריב על זכותו' },
    { id: 'fiv-e2', timestamp: '8298-04-21', label: 'חסימת צירי התנועה' },
    { id: 'fiv-e3', timestamp: '8298-07-02', label: 'סגירת העיר מבפנים' },
    { id: 'fiv-e4', timestamp: '8298-12-04', label: 'ביסוס אחיזה בעיר הגדולה' },
  ],
  friendlyEvents: [
    { id: 'fiv-f1', timestamp: '8298-01-18', label: 'הכרזת הברית הצפונית' },
    { id: 'fiv-f2', timestamp: '8298-03-26', label: 'יציאה דרומה' },
    { id: 'fiv-f3', timestamp: '8298-07-05', label: 'פתיחת המצור בדרום' },
    { id: 'fiv-f4', timestamp: '8298-11-12', label: 'התכנסות מחדש בצפון' },
  ],
  meetingPoints: [
    { id: 'fiv-mp1', kind: 'תגובה', enemyEventId: 'fiv-e1', friendlyEventId: 'fiv-f2' },
    { id: 'fiv-mp2', kind: 'תגובה', enemyEventId: 'fiv-e3', friendlyEventId: 'fiv-f3' },
  ],
  influencingFactors: [
    { id: 'fiv-if1', label: 'חורף ממושך', startTs: '8298-04-25', endTs: '8298-09-02' },
    { id: 'fiv-if2', label: 'כינוס שרי הבתים', startTs: '8298-10-20' },
  ],
}

// Timeline: t4 — a HOUSE page rather than an arena, so its axis א׳ is the house itself.
const starkTimeline: TimelineData = {
  enemyEvents: [
    { id: 'sta-e1', timestamp: '8298-02-14', label: 'לחץ על אחוזות הגבול' },
    { id: 'sta-e2', timestamp: '8298-05-29', label: 'הפרת כללי האירוח' },
    { id: 'sta-e3', timestamp: '8298-09-27', label: 'הסתערות על המעוז' },
  ],
  friendlyEvents: [
    { id: 'sta-f1', timestamp: '8298-01-22', label: 'גיוס מאחוזות הברית' },
    { id: 'sta-f2', timestamp: '8298-03-11', label: 'כינוס הדגלים' },
    { id: 'sta-f3', timestamp: '8298-09-27', label: 'הגנת המעוז המרכזי' },
    { id: 'sta-f4', timestamp: '8298-11-20', label: 'כינוס האחוזות הנותרות' },
  ],
  meetingPoints: [
    { id: 'sta-mp1', kind: 'תגובה', enemyEventId: 'sta-e1', friendlyEventId: 'sta-f2' },
    { id: 'sta-mp2', kind: 'בו-זמני', enemyEventId: 'sta-e3', friendlyEventId: 'sta-f3', label: 'הסתערות והגנה באותו יום' },
  ],
  influencingFactors: [
    { id: 'sta-if1', label: 'אבל על מות ראש הבית', startTs: '8298-06-10' },
    { id: 'sta-if2', label: 'קור מקדים בצפון', startTs: '8298-10-01', endTs: '8298-11-20' },
  ],
}

// Timeline: t5 — the counterpart house. Two SAME-DAY תגובה pairs, which is the tightest response the months scale can show.
const lannisterTimeline: TimelineData = {
  enemyEvents: [
    { id: 'lan-e1', timestamp: '8298-03-26', label: 'תנועת הכוח הצפוני דרומה' },
    { id: 'lan-e2', timestamp: '8298-07-02', label: 'סגירת העיר במצור' },
    { id: 'lan-e3', timestamp: '8298-08-12', label: 'כניסת הצי למפרץ' },
  ],
  friendlyEvents: [
    { id: 'lan-f1', timestamp: '8298-02-05', label: 'גיוס כוחות שכירים' },
    { id: 'lan-f2', timestamp: '8298-06-11', label: 'הכרעת המשפט בדו-קרב' },
    { id: 'lan-f3', timestamp: '8298-07-15', label: 'הפעלת מלאי החירום' },
    { id: 'lan-f4', timestamp: '8298-08-12', label: 'הדיפת הצי מן המפרץ' },
    { id: 'lan-f5', timestamp: '8298-12-04', label: 'ביסוס אחיזה בעיר' },
  ],
  meetingPoints: [
    { id: 'lan-mp1', kind: 'תגובה', enemyEventId: 'lan-e2', friendlyEventId: 'lan-f3' },
    { id: 'lan-mp2', kind: 'תגובה', enemyEventId: 'lan-e3', friendlyEventId: 'lan-f4' },
  ],
  influencingFactors: [
    { id: 'lan-if1', label: 'הגעת מלווים מעבר לים', startTs: '8298-04-18' },
    { id: 'lan-if2', label: 'הפסקת תשלום לכוחות השכירים', startTs: '8298-10-10', endTs: '8298-11-30' },
  ],
}

// Timeline: t6 — a DRAFT page. Its timeline is reachable only in the editor, never from a reader surface.
const nightsWatchTimeline: TimelineData = {
  enemyEvents: [
    { id: 'nig-e1', timestamp: '8298-03-09', label: 'חציית הגבול בקבוצות קטנות' },
    { id: 'nig-e2', timestamp: '8298-08-24', label: 'לחץ ממושך על המעוז המזרחי' },
    { id: 'nig-e3', timestamp: '8298-11-02', label: 'תקיפת המעוז המזרחי' },
  ],
  friendlyEvents: [
    { id: 'nig-f1', timestamp: '8298-02-01', label: 'סיור לאורך הגבול' },
    { id: 'nig-f2', timestamp: '8298-05-18', label: 'בקשת תגבור מאחוזות הצפון' },
    { id: 'nig-f3', timestamp: '8298-11-02', label: 'נטישת המעוז המזרחי' },
  ],
  meetingPoints: [
    { id: 'nig-mp1', kind: 'תגובה', enemyEventId: 'nig-e1', friendlyEventId: 'nig-f2' },
    { id: 'nig-mp2', kind: 'בו-זמני', enemyEventId: 'nig-e3', friendlyEventId: 'nig-f3', label: 'תקיפה ונטישה באותו לילה' },
  ],
  influencingFactors: [
    { id: 'nig-if1', label: 'ירידה מתמשכת באיוש', startTs: '8298-02-01', endTs: '8298-11-02' },
    { id: 'nig-if2', label: 'הפסקת האספקה הסדירה', startTs: '8298-09-15' },
  ],
}

// Timeline: t7 — an ARCHIVED page, so the viewer never reaches this; it exists for the editor and the unarchive path.
const beyondWallTimeline: TimelineData = {
  enemyEvents: [
    { id: 'bey-e1', timestamp: '8298-02-22', label: 'תנועת קבוצות מצפון' },
    { id: 'bey-e2', timestamp: '8298-05-05', label: 'היעלמות סיור בשטח' },
  ],
  friendlyEvents: [
    { id: 'bey-f1', timestamp: '8298-01-20', label: 'יציאת סיור ראשון' },
    { id: 'bey-f2', timestamp: '8298-05-02', label: 'הגעת מגויסים למעוזי הגבול' },
    { id: 'bey-f3', timestamp: '8298-06-30', label: 'סיכום עונת הסיורים' },
  ],
  meetingPoints: [
    { id: 'bey-mp1', kind: 'תגובה', enemyEventId: 'bey-e2', friendlyEventId: 'bey-f3' },
  ],
  influencingFactors: [
    { id: 'bey-if1', label: 'עונה קשה מעבר לגבול', startTs: '8298-01-20', endTs: '8298-04-30' },
  ],
}

// Timeline: e1 — hours scale across a single evening (21:00–23:30), matching its infoGrid window.
const redWeddingTimeline: TimelineData = {
  enemyEvents: [
    { id: 'red-e1', timestamp: '8298-05-29T22:35', label: 'סגירת דלתות האולם' },
    { id: 'red-e2', timestamp: '8298-05-29T22:50', label: 'פגיעה במשתתפים' },
    { id: 'red-e3', timestamp: '8298-05-29T23:30', label: 'השתלטות על החצר' },
  ],
  friendlyEvents: [
    { id: 'red-f1', timestamp: '8298-05-29T21:00', label: 'הגעת המשלחת לאולם' },
    { id: 'red-f2', timestamp: '8298-05-29T21:40', label: 'פתיחת טקס האירוח' },
    { id: 'red-f3', timestamp: '8298-05-29T22:45', label: 'ניסיון יציאה מן האולם' },
    { id: 'red-f4', timestamp: '8298-05-29T22:50', label: 'ניסיון הגנה בחצר' },
  ],
  meetingPoints: [
    { id: 'red-mp1', kind: 'תגובה', enemyEventId: 'red-e1', friendlyEventId: 'red-f3' },
    { id: 'red-mp2', kind: 'בו-זמני', enemyEventId: 'red-e2', friendlyEventId: 'red-f4', label: 'שני הצדדים פועלים באותו רגע' },
  ],
  influencingFactors: [
    { id: 'red-if1', label: 'כללי האירוח בתוקף', startTs: '8298-05-29T21:00', endTs: '8298-05-29T22:35' },
    { id: 'red-if2', label: 'הגעת כוח נוסף לחצר', startTs: '8298-05-29T23:10' },
  ],
}

// Timeline: e4 — the SHORTEST span in the dataset (75 minutes), so the hours scale has to hold up with almost no range.
const trialTimeline: TimelineData = {
  enemyEvents: [
    { id: 'tri-e1', timestamp: '8298-06-11T10:20', label: 'בחירת נציג ההגנה' },
    { id: 'tri-e2', timestamp: '8298-06-11T10:50', label: 'טענות ההגנה' },
  ],
  friendlyEvents: [
    { id: 'tri-f1', timestamp: '8298-06-11T10:00', label: 'פתיחת ההליך' },
    { id: 'tri-f2', timestamp: '8298-06-11T10:35', label: 'הצגת טענות התביעה' },
    { id: 'tri-f3', timestamp: '8298-06-11T11:05', label: 'הכרעת הדו-קרב' },
  ],
  meetingPoints: [
    { id: 'tri-mp1', kind: 'תגובה', enemyEventId: 'tri-e1', friendlyEventId: 'tri-f2' },
  ],
  influencingFactors: [
    { id: 'tri-if1', label: 'הסכמה מוקדמת על הנוהל', startTs: '8298-06-11T10:00' },
  ],
}

// Timeline: e5 — a DRAFT page held back by the publish gate; the timeline does not affect the gate.
const eastwatchTimeline: TimelineData = {
  enemyEvents: [
    { id: 'eas-e1', timestamp: '8298-11-02T02:45', label: 'התקרבות לשער' },
    { id: 'eas-e2', timestamp: '8298-11-02T04:30', label: 'פריצת השער' },
  ],
  friendlyEvents: [
    { id: 'eas-f1', timestamp: '8298-11-02T02:00', label: 'זיהוי תנועה מצפון' },
    { id: 'eas-f2', timestamp: '8298-11-02T03:10', label: 'איוש החומה המזרחית' },
    { id: 'eas-f3', timestamp: '8298-11-02T05:40', label: 'נטישה מסודרת' },
  ],
  meetingPoints: [
    { id: 'eas-mp1', kind: 'תגובה', enemyEventId: 'eas-e1', friendlyEventId: 'eas-f2' },
    { id: 'eas-mp2', kind: 'תגובה', enemyEventId: 'eas-e2', friendlyEventId: 'eas-f3' },
  ],
  influencingFactors: [
    { id: 'eas-if1', label: 'חשכה מלאה', startTs: '8298-11-02T02:00', endTs: '8298-11-02T05:10' },
  ],
}

// Timeline: e6 — ONE-SIDED. Its infoGrid says there was no opposing side, so צד ב׳ is genuinely empty rather than padded; the viewer renders that axis with no dots.
const walkTimeline: TimelineData = {
  enemyEvents: [
  ],
  friendlyEvents: [
    { id: 'wal-f1', timestamp: '8298-04-08T06:00', label: 'יציאה מנקודת הכינוס' },
    { id: 'wal-f2', timestamp: '8298-04-08T09:30', label: 'תחנת אספקה ראשונה' },
    { id: 'wal-f3', timestamp: '8298-04-08T13:15', label: 'מעבר בקטע חשוף' },
    { id: 'wal-f4', timestamp: '8298-04-08T18:00', label: 'הקמת מחנה הלילה' },
  ],
  influencingFactors: [
    { id: 'wal-if1', label: 'רוח חזיתית לאורך הדרך', startTs: '8298-04-08T09:00', endTs: '8298-04-08T15:00' },
    { id: 'wal-if2', label: 'אובדן עגלת אספקה', startTs: '8298-04-08T11:40' },
  ],
}

// Timeline: e7 — the only entry dated 8299, and the second one-sided case (a council has no opposing side).
const councilTimeline: TimelineData = {
  enemyEvents: [
  ],
  friendlyEvents: [
    { id: 'cou-f1', timestamp: '8299-02-14T09:00', label: 'פתיחת הכינוס' },
    { id: 'cou-f2', timestamp: '8299-02-14T11:20', label: 'הצגת עמדות הבתים' },
    { id: 'cou-f3', timestamp: '8299-02-14T14:00', label: 'ניסיון גיבוש נוסח מחייב' },
    { id: 'cou-f4', timestamp: '8299-02-14T16:00', label: 'נעילה ללא החלטה' },
  ],
  influencingFactors: [
    { id: 'cou-if1', label: 'היעדר מנגנון הצבעה מוסכם', startTs: '8299-02-14T09:00' },
    { id: 'cou-if2', label: 'דיון בדלתיים סגורות', startTs: '8299-02-14T11:20', endTs: '8299-02-14T14:00' },
  ],
}

// ═══════════════════ TOPIC CONTENT ═══════════════════

const warOfFiveKingsContent: TopicContent = {
  hero: {
    subtitle: 'סקירה של תקופת המאבק על כס המלוכה, הצדדים שנטלו בה חלק והזירות המרכזיות',
    periodFrom: '8298-01-01', periodTo: '8298-12-20', region: 'ארצות הסערה',
    heroImage: { id: 'h-w5k', src: assetPath('/demo-images/banner-realm.svg'), name: 'סמל כללי — ממלכה' },
  },
  overview: {
    summary: 'תקופה שבה כמה בתי אצולה הכריזו במקביל על זכותם לשלוט, והמאבק ביניהם התפרש על פני מספר זירות נפרדות. דף זה מרכז את הזירות ומקשר אליהן.',
    background: 'הסכסוך התפתח לאחר שהסדר השלטוני הקודם קרס, וכל אחד מן הבתים הגדולים פעל לבסס את מעמדו בנפרד. הזירות התנהלו במקביל ולא תמיד בתיאום.',
    arenaCharacteristics: {
      ourForces: 'כוחות הבתים שנשארו נאמנים לברית הצפונית, בעיקר פרשים וחיל רגלים מגויס.',
      enemy: 'בתים יריבים ובעלי בריתם, לרבות כוחות שכירים שהגיעו מעבר לים.',
      additional: [
        'הזירות פעלו במקביל, ולכן אירוע בזירה אחת לא תמיד השפיע על האחרת.',
        'עונות ארוכות הכתיבו את קצב התנועה של הכוחות.',
      ],
    },
  },
  gallery: [
    { id: 'w5k-g1', src: assetPath('/demo-images/banner-realm.svg'), name: 'איור כללי — הממלכה', caption: 'איור סכמטי של הממלכה כמסגרת אחת. אינו מפה ואינו מתאר מקום ממשי.' },
    { id: 'w5k-g2', src: assetPath('/demo-images/scene-keep.svg'), name: 'איור כללי — מעוז מבוצר', caption: 'מעוז מבוצר כטיפוס מבנה. מופיע בכמה דפים כאיור גנרי ולא כמקום מסוים.' },
  ],
  map: [
    { id: 'w5k-m1', src: assetPath('/demo-images/map-schematic.svg'), name: 'סכמה — חלוקת הזירות', caption: 'שלוש זירות מופשטות והקו המפריד ביניהן. הגאומטריה שרירותית ואינה גאוגרפיה.' },
  ],
  dashboards: [
    { id: 'w5k-d1', src: assetPath('/demo-images/chart-bars.svg'), name: 'סכמה — התפלגות לפי זירה', caption: 'עמודות ללא יחידות. נועד להדגים את מסגרת הדשבורד, לא להציג מדידה.' },
  ],
  timeline: fiveKingsTimeline,
  commanderWord: 'התקופה הזו מלמדת עד כמה קשה לנהל מאמץ בכמה זירות בלי מנגנון תיאום אחד. כל זירה פיתחה היגיון משלה.',
  deepening: [
    { type: 'מסמך', title: 'סקירת הזירות — מסמך רקע', fileName: 'arenas_overview.txt', fileRef: assetPath('/mock-files/arenas_overview.txt') },
  ],
  historySection: {
    teaser: 'מאבקי ירושה בין בתי אצולה אינם תופעה חדשה בעולם הזה.',
    fullContent: 'דפוסים חוזרים במאבקי ירושה\n\nרקע\n\nכאשר סדר שלטוני קורס, בתי אצולה נוטים לפעול תחילה לביסוס אחיזתם המקומית ורק אחר כך לתבוע מעמד רחב יותר.\n\nדפוס הזירות\n\nהמאבק מתפצל כמעט תמיד לכמה זירות גיאוגרפיות שמתנהלות במקביל. התיאום ביניהן חלקי בלבד.\n\nלקחים\n\n• ברית רחבה מתפרקת מהר כשאין מנגנון הכרעה משותף\n• זירה שמתנהלת בנפרד מפתחת סדרי עדיפויות משלה\n• קווי אספקה ארוכים הם נקודת התורפה החוזרת',
  },
}

const northMarchContent: TopicContent = {
  hero: {
    subtitle: 'תנועת הכוחות הצפוניים דרומה — ציר הזמן המלא של המסע',
    periodFrom: '8298-03-04', periodTo: '8298-10-05', region: 'הצפון',
    heroImage: { id: 'h-nm', src: assetPath('/demo-images/banner-north.svg'), name: 'סמל כללי — צפון' },
  },
  overview: {
    summary: 'מסע ממושך של כוחות הצפון דרומה, שכלל תקופת המתנה ארוכה באמצע בשל תנאי מזג אוויר. ציר הזמן מציג את שני הצדדים זה מול זה.',
    background: 'הכוחות גויסו באופן מדורג מאחוזות שונות, ולכן היציאה לדרך התעכבה. העיכוב השפיע על כל לוח הזמנים שאחריו.',
    arenaCharacteristics: {
      ourForces: 'פרשים מאחוזות הצפון, בתוספת חיל רגלים מגויס ושיירות אספקה.',
      enemy: 'כוחות שחסמו את צירי התנועה המרכזיים וניסו לשבש את קווי האספקה.',
      additional: [
        'הפער הארוך בציר הזמן הוא תקופת המתנה אמיתית, לא חוסר תיעוד.',
        'מעבר הנהר היה נקודת ההכרעה הלוגיסטית של המסע.',
      ],
    },
  },
  commanderWord: 'המסע הזה נקבע במידה רבה על ידי מזג האוויר ולא על ידי הצד שמולנו. זה לקח ששווה לזכור.',
  deepening: [
    { type: 'מסמך', title: 'סקירת מעבר הנהר', fileName: 'river_crossing.txt', fileRef: assetPath('/mock-files/river_crossing.txt') },
    { type: 'אוגדן', title: 'אוגדן המסע הצפוני', url: assetPath('/bundles/north-march.html') },
  ],
  timeline: northMarchTimeline,
  gallery: [
    { id: 'nm-g1', src: assetPath('/demo-images/scene-river.svg'), name: 'איור כללי — מעבר נהר', caption: 'מעבר נהר רדוד עם גשר זמני. נקודת ההכרעה הלוגיסטית של המסע, באיור גנרי.' },
    { id: 'nm-g2', src: assetPath('/demo-images/banner-north.svg'), name: 'איור כללי — הצפון', caption: 'איור סכמטי לאזור הצפון. אינו סמל של בית אצולה.' },
  ],
  map: [
    { id: 'nm-m1', src: assetPath('/demo-images/map-schematic.svg'), name: 'סכמה — ציר התנועה דרומה', caption: 'שלוש נקודות על ציר מופשט. אינו משקף מרחקים או כיוונים ממשיים.' },
  ],
  dashboards: [
    { id: 'nm-d1', src: assetPath('/demo-images/chart-line.svg'), name: 'סכמה — קצב ההתקדמות לעומת התכנון', caption: 'שני קווים ללא יחידות: הרציף והמקוטע. ממחיש פער, לא מודד אותו.' },
  ],

  historySection: {
    teaser: 'מסעות ארוכים בין אחוזות רחוקות הם דפוס חוזר בצפון.',
    fullContent: 'מסעות ארוכים בצפון\n\nרקע\n\nהמרחק בין האחוזות בצפון גדול, והגיוס נעשה בהדרגה. כוח שיוצא לדרך כמעט אף פעם אינו שלם ביום הראשון.\n\nדפוס חוזר\n\nהעיכוב הראשוני מכתיב את כל לוח הזמנים שאחריו. תקופות המתנה ארוכות אינן חריגות אלא חלק מהתכנון.\n\nלקחים\n\n• מזג האוויר קובע את הקצב יותר מהחלטות מלמעלה\n• מעברי נהר הם צווארי הבקבוק האמיתיים\n• שיירת אספקה איטית יותר מכוח רוכב, ויש לתכנן לפי האיטית',
  },
}

const siegeContent: TopicContent = {
  hero: {
    subtitle: 'מצור ממושך על עיר מבוצרת — מהלך האירועים וגורמי ההשפעה',
    periodFrom: '8298-07-02', periodTo: '8298-08-10', region: 'הדרום',
    heroImage: { id: 'h-sg', src: assetPath('/demo-images/scene-keep.svg'), name: 'איור כללי — עיר מבוצרת' },
  },
  overview: {
    summary: 'מצור שנמשך כחמישה שבועות על עיר מבוצרת גדולה. המחסור במים היה הגורם המכריע יותר מכל פעולה התקפית.',
    background: 'העיר נסגרה מרצונה לאחר שהתקבלה ידיעה על התקרבות כוחות. ההיערכות בתוך החומות הייתה מהירה אך לא שלמה.',
    arenaCharacteristics: {
      ourForces: 'כוח מכתר מן היבשה, ללא יכולת חסימה ימית מלאה.',
      enemy: 'מגינים מתוך החומות, עם מלאי מזון סביר ומלאי מים מוגבל.',
      additional: ['המצור הוכרע בלוגיסטיקה ולא בקרב פתוח.'],
    },
  },
  timeline: siegeTimeline,
  gallery: [
    { id: 'sg-g1', src: assetPath('/demo-images/scene-keep.svg'), name: 'איור כללי — עיר מבוצרת', caption: 'חומה חיצונית ושער. אותו איור גנרי שמשמש גם דפים אחרים.' },
    { id: 'sg-g2', src: assetPath('/demo-images/scene-harbor.svg'), name: 'איור כללי — מפרץ צר', caption: 'הכניסה הימית שנותרה פתוחה לאורך המצור, באיור סכמטי.' },
  ],
  map: [
    { id: 'sg-m1', src: assetPath('/demo-images/map-schematic.svg'), name: 'סכמה — טבעת הכיתור', caption: 'הכיתור מן היבשה בלבד. הצורות מופשטות ואינן תוואי שטח.' },
  ],
  dashboards: [
    { id: 'sg-d1', src: assetPath('/demo-images/chart-bars.svg'), name: 'סכמה — מלאי לפי שבוע מצור', caption: 'עמודות ללא יחידות. המחסור במים היה הגורם המכריע, אך המספרים כאן אינם נתון.' },
  ],

  commanderWord: 'מצור נמדד במלאי ולא בתעוזה. מי שסופר נכון את המים מנצח.',
  historySection: {
    teaser: 'מצורים בערים מבוצרות הם דפוס חוזר, ומה שמכריע אותם חוזר גם הוא.',
    fullContent: 'מצור על עיר מבוצרת\n\nרקע\n\nעיר גדולה יכולה להחזיק מעמד זמן רב אם מלאי המים והמזון מחושב מראש. החומה עצמה רק קונה זמן.\n\nדפוס חוזר\n\nברוב המקרים ההכרעה מגיעה מהאספקה ולא מפריצה. הצד המכתר מנסה לקצר את ההמתנה, והצד המגן מנסה להאריך אותה.\n\nלקחים\n\n• מלאי מים הוא המשתנה הקריטי, לא מלאי המזון\n• כיתור חלקי מן היבשה בלבד מאריך את המצור\n• מנגנוני מצור משפיעים על המורל לפני שהם משפיעים על החומה',
  },
}

const houseStarkContent: TopicContent = {
  hero: {
    subtitle: 'בית אצולה צפוני — אחוזות, בעלי ברית וזיקות',
    periodFrom: '8298-01-01', periodTo: '8298-12-20', region: 'הצפון',
    heroImage: { id: 'h-hs', src: assetPath('/demo-images/banner-north.svg'), name: 'סמל כללי — צפון' },
  },
  overview: {
    summary: 'דף נושא המרכז את הזיקות של בית אצולה צפוני: האחוזות שתחתיו, בעלי בריתו והאירועים שבהם היה מעורב.',
    background: 'הבית שולט באזור נרחב ודליל אוכלוסין, מה שמכתיב הסתמכות על בריתות עם אחוזות קטנות יותר.',
    arenaCharacteristics: {
      ourForces: 'כוחות הבית ואחוזות הברית שלו.',
      enemy: 'בתים יריבים בדרום ומעבר לים.',
      additional: ['המרחק בין האחוזות מאריך כל גיוס.'],
    },
  },

  gallery: [
    { id: 'hs-g1', src: assetPath('/demo-images/banner-north.svg'), name: 'איור כללי — הצפון', caption: 'איור סכמטי לאזור הצפון. אינו סמל של בית אצולה.' },
    { id: 'hs-g2', src: assetPath('/demo-images/scene-keep.svg'), name: 'איור כללי — המעוז המרכזי', caption: 'טיפוס מבנה בלבד, לא שרטוט של מבנה מסוים.' },
  ],
  map: [
    { id: 'hs-m1', src: assetPath('/demo-images/map-schematic.svg'), name: 'סכמה — פריסת אחוזות הברית', caption: 'נקודות מפוזרות על שטח מופשט, להמחשת מרחק ולא מיקום.' },
  ],
  dashboards: [
    { id: 'hs-d1', src: assetPath('/demo-images/chart-line.svg'), name: 'סכמה — קצב הגיוס מהאחוזות', caption: 'שני קווים ללא יחידות. ממחיש גיוס מדורג, לא מודד אותו.' },
  ],
  timeline: starkTimeline,
  commanderWord: 'בית שמחזיק שטח גדול ודליל לומד מוקדם שבריתות שוות יותר מחומות.',
  historySection: {
    teaser: 'בתי אצולה באזורים דלילים מתנהלים אחרת מאלה שבאזורים צפופים.',
    fullContent: 'שלטון באזור דליל\n\nרקע\n\nשליטה על שטח גדול עם אוכלוסייה מפוזרת מחייבת הסתמכות על אחוזות ברית ולא על כוח מרוכז.\n\nדפוס חוזר\n\nהגיוס איטי, אבל הנאמנות יציבה יותר. בית כזה חזק בהגנה ואיטי בתקיפה.\n\nלקחים\n\n• מרחק בין אחוזות מאריך כל גיוס\n• ברית עם אחוזה קטנה שווה יותר מתוספת כוח ישירה\n• חורף מצמצם את טווח הפעולה יותר מכל יריב',
  },
}

const houseLannisterContent: TopicContent = {
  hero: {
    subtitle: 'בית אצולה מערבי — בסיס כוח, משאבים וזיקות',
    periodFrom: '8298-01-01', periodTo: '8298-12-20', region: 'ארצות הסערה',
    heroImage: { id: 'h-hl', src: assetPath('/demo-images/banner-realm.svg'), name: 'איור כללי — הממלכה' },
  },
  overview: {
    summary: 'דף נושא המרכז את הזיקות של בית אצולה מערבי בעל בסיס כלכלי חזק, והאירועים שבהם היה מעורב.',
    background: 'עוצמתו של הבית נשענת על משאבים ולא רק על כוח אדם, ולכן הוא נוטה להעסיק כוחות חיצוניים.',
    arenaCharacteristics: {
      ourForces: 'כוחות הבית וכוחות שכירים במימונו.',
      enemy: 'בתים יריבים בצפון ובמזרח.',
      additional: ['יכולת מימון ממושכת היא היתרון המרכזי של הבית הזה.'],
    },
  },

  timeline: lannisterTimeline,
  commanderWord: 'כסף קונה זמן, וזמן קונה כוח. זה היתרון של הבית הזה וגם נקודת התורפה שלו.',
  historySection: {
    teaser: 'בתים שנשענים על משאבים מתנהלים אחרת מבתים שנשענים על כוח אדם.',
    fullContent: 'עוצמה המבוססת על משאבים\n\nרקע\n\nבית בעל בסיס כלכלי חזק יכול להעסיק כוחות חיצוניים ולהימנע מגיוס רחב של אנשיו.\n\nדפוס חוזר\n\nיתרון המימון בולט במערכה ממושכת ונחלש כשמקור ההכנסה נפגע. כוח שכיר נאמן לתשלום ולא לדגל.\n\nלקחים\n\n• מערכה ארוכה מיטיבה עם הצד הממומן\n• פגיעה במקור ההכנסה מכריעה מהר יותר מפגיעה בכוח\n• כוח שכיר מתפרק מהר כשהתשלום נעצר',
  },
}

const nightsWatchContent: TopicContent = {
  hero: {
    subtitle: 'מסדר שמירה על הגבול הצפוני — טיוטה, טרם פורסם',
    periodFrom: '8298-01-01', periodTo: '8298-12-20', region: 'הצפון',
  },
  overview: {
    summary: 'דף נושא בעבודה על מסדר השומר על הגבול הצפוני. הדף נשאר טיוטה בכוונה, כדי להדגים את שער הפרסום.',
    background: 'המסדר מאויש בהתנדבות ובגיוס כפוי כאחד, ומספר האנשים שלו ירד לאורך השנים.',
    arenaCharacteristics: {
      ourForces: 'מאוישים במספר מצומצם של מעוזים לאורך הגבול.',
      enemy: 'קבוצות שחוצות את הגבול מצפון.',
      additional: ['הדף הזה בטיוטה — לכן אירוע שמקושר אליו אינו יכול להתפרסם.'],
    },
  },

  timeline: nightsWatchTimeline,
  commanderWord: 'מסדר שמאויש בקושי שומר על גבול ארוך. המספרים חשובים יותר מהנחישות.',
  historySection: {
    teaser: 'מסדרי שמירת גבול מתמודדים עם אותה שחיקה לאורך הדורות.',
    fullContent: 'שמירה על גבול ארוך\n\nרקע\n\nגבול ארוך מחייב מעוזים מרוחקים זה מזה. כל מעוז עומד בפני עצמו רוב הזמן.\n\nדפוס חוזר\n\nמספר האנשים יורד בהדרגה, והמעוזים הרחוקים ננטשים ראשונים. הנטישה נעשית בשקט ולא בהחלטה אחת.\n\nלקחים\n\n• מעוזים רחוקים נשחקים לפני הקרובים\n• גיוס מרצון אינו מספיק לגבול בסדר גודל כזה\n• קשר רציף בין המעוזים חשוב מתוספת ביצורים',
  },
}

const beyondWallContent: TopicContent = {
  hero: {
    subtitle: 'האזור שמעבר לגבול הצפוני — ארכיון',
    periodFrom: '8298-01-01', periodTo: '8298-06-30', region: 'הצפון',
  },
  overview: {
    summary: 'דף נושא שהועבר לארכיון. הוא אינו מוצג לקוראים, אך נשאר גלוי לעורכים ברשימת הניהול עם תגית ארכיון.',
    background: 'התוכן נותר שמור בדיוק כפי שפורסם, וניתן להחזירו לפרסום בפעולה אחת.',
    arenaCharacteristics: {
      ourForces: 'סיורים מצומצמים בלבד.',
      enemy: 'קבוצות מעבר לגבול ותנאי שטח קשים.',
      additional: ['הדף בארכיון — מוצג כאן רק כדי להדגים את ההתנהגות.'],
    },
  },

  timeline: beyondWallTimeline,
  commanderWord: 'מעבר לגבול אין אחוזות ואין חוקים מוכרים. מי שנכנס לשם צריך תוכנית יציאה.',
  historySection: {
    teaser: 'האזור שמעבר לגבול תועד מעט, ומה שידוע עליו מגיע מסיורים בודדים.',
    fullContent: 'האזור שמעבר לגבול\n\nרקע\n\nהאזור אינו מחולק לאחוזות ואין בו שלטון מרכזי מוכר. הקבוצות שחיות בו נעות לפי העונה.\n\nדפוס חוזר\n\nסיורים שנכנסים עמוק מתקשים לחזור בלוח זמנים קבוע. התנאים משתנים מהר יותר מקצב התנועה.\n\nלקחים\n\n• תנאי השטח מסוכנים יותר מהקבוצות שחוצות את הגבול\n• סיור ללא נקודת חזרה קבועה מסתיים רע\n• עונה אחת משנה את כל מפת התנועה',
  },
}

// ═══════════════════ EVENT CONTENT ═══════════════════

const redWeddingContent: EventContent = {
  hero: {
    subtitle: 'אירוע הפרת אמון באירוח — תיאור בדיוני לצורכי הדמו',
    date: '8298-05-29', region: 'הצפון',
  },
  infoGrid: {
    commanderSummary: 'מפגש שנועד לאשרר ברית הסתיים בהפרת כללי האירוח ובפגיעה קשה במשתתפים. האירוע שינה את מאזן הכוחות בזירה הצפונית.',
    eventType: 'אחר', eventTypeDetail: 'הפרת כללי אירוח',
    sector: 'אולם האירוח, מעבר הנהר',
    timeFrom: '21:00', timeTo: '23:30',
    forces: 'משלחת צפונית ומלוויה',
    enemy: 'בית מארח ובעלי בריתו',
  },
  timeline: redWeddingTimeline,
  commanderWord: 'האירוע הזה נזכר פחות בשל היקפו ויותר בשל הכלל שנשבר בו.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['המפגש נקבע כדי לאשרר ברית', 'כללי האירוח נחשבו מחייבים', 'מאזן הכוחות בזירה השתנה מיד לאחר מכן'] },
    { heading: 'לקחים', points: ['ברית ללא ערובות אינה ברית', 'מפגש בשטח של צד אחר מחייב תנאי ביטחון'] },
  ],

  historySection: {
    teaser: 'כללי אירוח נחשבו מחייבים בכל הממלכה, ושבירתם נזכרת יותר מהאירוע עצמו.',
    fullContent: 'כללי האירוח\n\nרקע\n\nמי שמארח אחראי לשלום אורחיו כל עוד הם תחת קורת גגו. הכלל אינו כתוב בחוק אלא נשען על מוסכמה ארוכת שנים.\n\nמה קורה כשהכלל נשבר\n\nהפרה כזו פוגעת לא רק במי שנפגע ישירות אלא ביכולת של כל הצדדים לקיים מפגשים. אחריה נדרשות ערובות לכל מפגש.\n\nלקחים\n\n• מפגש בשטח של צד אחר מחייב תנאי ביטחון מוסכמים\n• ברית שנשענת על מוסכמה בלבד אינה ברית\n• אובדן אמון עולה יותר מאובדן כוח',
  },
}

const blackwaterContent: EventContent = {
  hero: {
    subtitle: 'קרב ימי ויבשתי על גישה לעיר מבוצרת',
    date: '8298-08-12', region: 'הדרום',
  },
  infoGrid: {
    commanderSummary: 'כוח תוקף ניסה להיכנס למפרץ ולפרוץ אל העיר. ההגנה השתמשה במחסום ובאמצעי הצתה, ולאחר מכן ביציאת פרשים.',
    eventType: 'אחר', eventTypeDetail: 'קרב משולב',
    sector: 'המפרץ והשער הדרומי',
    timeFrom: '19:40', timeTo: '23:50',
    forces: 'צי תוקף וכוח נחיתה',
    enemy: 'מגיני העיר וכוח פרשים שיצא מתוכה',
  },
  timeline: blackwaterTimeline,
  deepening: [
    { type: 'מסמך', title: 'סקירת קרב המפרץ', fileName: 'bay_battle.txt', fileRef: assetPath('/mock-files/bay_battle.txt') },
  ],

  gallery: [
    { id: 'bw-g1', src: assetPath('/demo-images/scene-harbor.svg'), name: 'איור כללי — הכניסה למפרץ', caption: 'מעבר ימי צר בין שתי גדות. איור סכמטי ולא תוואי ממשי.' },
    { id: 'bw-g2', src: assetPath('/demo-images/scene-river.svg'), name: 'איור כללי — קו החוף', caption: 'רצועת החוף שעליה נפרס כוח הנחיתה, באיור גנרי.' },
  ],
  map: [
    { id: 'bw-m1', src: assetPath('/demo-images/map-schematic.svg'), name: 'סכמה — ציר הכניסה והשער הדרומי', caption: 'שתי נקודות והקו ביניהן. מופשט לחלוטין.' },
  ],
  dashboards: [
    { id: 'bw-d1', src: assetPath('/demo-images/chart-bars.svg'), name: 'סכמה — פריסת הכוח לפי שעה', caption: 'עמודות ללא יחידות, להמחשת מסגרת הדשבורד בלבד.' },
  ],
  commanderWord: 'המפרץ הצר היה היתרון של המגינים, לא החומה. מי ששולט בכניסה שולט בקרב.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['הכניסה למפרץ צרה ומאפשרת חסימה בכוח קטן', 'אמצעי ההצתה הופעל לפני שהצי התפרס', 'יציאת הפרשים תוזמנה לרגע שבו כוח הנחיתה היה פרוס על החוף'] },
    { heading: 'לקחים', points: ['תזמון היציאה מן העיר הכריע יותר ממספר המגינים', 'צי שנכנס למעבר צר מאבד את יתרון הגודל'] },
  ],
  historySection: {
    teaser: 'קרבות על כניסה ימית צרה חוזרים על עצמם, וההכרעה בהם דומה.',
    fullContent: 'קרב על מעבר ימי צר\n\nרקע\n\nעיר נמל שיש לה כניסה אחת צרה יכולה להגן על עצמה בכוח קטן יחסית, בתנאי שהיא שולטת במעבר.\n\nדפוס חוזר\n\nהצד התוקף מנסה להיכנס מהר ולפרוס כוח על החוף. הצד המגן מנסה לעכב אותו בתוך המעבר, שם הגודל אינו יתרון.\n\nלקחים\n\n• שליטה בכניסה שווה יותר ממספר הספינות\n• כוח נחיתה פגיע ביותר בשעה הראשונה שלו על החוף\n• אמצעי הצתה משנים את התמונה רק אם הופעלו בזמן',
  },
}

const winterfellBattleContent: EventContent = {
  hero: {
    subtitle: 'הגנה על מעוז מבוצר בצפון',
    date: '8298-09-27', region: 'הצפון',
  },
  infoGrid: {
    commanderSummary: 'הסתערות על מעוז צפוני לפני עלות השחר. השער החיצוני נפרץ, והמגינים נסוגו לחצר הפנימית והחזיקו בה.',
    eventType: 'הסתערות על מעוז', eventTypeDetail: '',
    sector: 'החומה החיצונית והחצר הפנימית',
    timeFrom: '04:20', timeTo: '08:00',
    forces: 'חיל מצב מקומי',
    enemy: 'כוח תוקף מצפון־מזרח',
  },
  timeline: winterfellTimeline,

  commanderWord: 'השער החיצוני נועד לקנות זמן, לא לעצור. החצר הפנימית היא ההגנה האמיתית.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['ההסתערות נפתחה לפני עלות השחר', 'השער החיצוני נפרץ בתוך שעתיים', 'הנסיגה לחצר הפנימית בוצעה מסודרת ולא בלחץ'] },
    { heading: 'לקחים', points: ['ביצור פנימי שווה יותר מחומה חיצונית גבוהה', 'נסיגה מתוכננת מראש מונעת קריסה'] },
  ],
  historySection: {
    teaser: 'הגנה על מעוז בנויה בשכבות, וכל שכבה קונה זמן לזו שאחריה.',
    fullContent: 'הגנה בשכבות\n\nרקע\n\nמעוז מבוצר אינו מתוכנן לעצור הסתערות בקו אחד. כל שכבה נועדה לקנות זמן לשכבה שאחריה.\n\nדפוס חוזר\n\nהשער החיצוני נופל כמעט תמיד. מה שקובע הוא האם הנסיגה פנימה מתוכננת או מאולתרת.\n\nלקחים\n\n• קו הגנה אחד הוא קו הגנה שבור\n• תרגול נסיגה חשוב כמו תרגול עמידה\n• שעות החושך מיטיבות עם הצד התוקף',
  },
}

const trialByCombatContent: EventContent = {
  hero: {
    subtitle: 'הכרעת משפט בדו-קרב — נוהל משפטי בעולם הבדיוני',
    date: '8298-06-11', region: 'ארצות הסערה',
  },
  infoGrid: {
    commanderSummary: 'סכסוך משפטי הוכרע בדו-קרב בין נציגי הצדדים, בהתאם לנוהל המקובל. התוצאה חייבה את שני הצדדים.',
    eventType: 'אחר', eventTypeDetail: 'הליך משפטי',
    sector: 'חצר המשפט',
    timeFrom: '10:00', timeTo: '11:15',
    forces: 'נציג התביעה',
    enemy: 'נציג ההגנה',
  },

  timeline: trialTimeline,
  commanderWord: 'הכרעה בדו-קרב סוגרת סכסוך מהר, אבל אינה קובעת מי צדק.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['שני הצדדים הסכימו מראש על הנוהל', 'התוצאה חייבה את שניהם ללא ערעור', 'ההליך ארך פחות משעתיים'] },
    { heading: 'לקחים', points: ['הליך מהיר אינו בהכרח הליך צודק', 'הסכמה מוקדמת על הנוהל מונעת מחלוקת אחריו'] },
  ],
  historySection: {
    teaser: 'הכרעת סכסוך בדו-קרב היא נוהל ותיק, ומקומו השתנה עם השנים.',
    fullContent: 'הכרעה בדו-קרב\n\nרקע\n\nכאשר אין ראיות מכריעות, מקובל להכריע סכסוך בדו-קרב בין נציגי הצדדים. התוצאה נחשבת מחייבת.\n\nדפוס חוזר\n\nהצד שידו משגת שוכר נציג מיומן. כך הנוהל נוטה לטובת מי שיכול לשלם.\n\nלקחים\n\n• נוהל מהיר נוטה לטובת הצד החזק\n• הסכמה מראש על הכללים מונעת סכסוך נוסף אחרי ההכרעה',
  },
}

// e5 — the publish-gate demo. Every infoGrid field is filled, so the ONLY blocker is that its single
// linked topic (t6, המשמר הלילי) is still a draft. That makes the gate refuse on relationship state
// rather than on a blank field, which is the more interesting half of the rule.
const eastwatchFallContent: EventContent = {
  hero: {
    subtitle: 'נפילת מעוז גבול — טיוטה שאינה עוברת את שער הפרסום',
    date: '8298-11-02', region: 'הצפון',
  },
  infoGrid: {
    commanderSummary: 'מעוז גבול מזרחי ננטש לאחר לחץ ממושך. כל שדות פרטי האירוע מולאו בכוונה, כדי שהחסימה תנבע אך ורק מכך שדף הנושא המקושר עדיין בטיוטה.',
    eventType: 'אחר', eventTypeDetail: 'נטישת מעוז',
    sector: 'המעוז המזרחי',
    timeFrom: '02:00', timeTo: '05:40',
    forces: 'חיל מצב מצומצם',
    enemy: 'כוח תוקף מצפון',
  },

  timeline: eastwatchTimeline,
  commanderWord: 'המעוז לא נפל בקרב אחד. הוא נשחק עד שלא נשאר מי שיחזיק אותו.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['הלחץ על המעוז נמשך שבועות לפני הנטישה', 'מספר האנשים ירד מתחת למינימום הנדרש', 'הנטישה בוצעה בלילה וללא אבדות'] },
    { heading: 'לקחים', points: ['מעוז מבודד נופל מחוסר אדם לפני שהוא נופל מלחימה', 'החלטת נטישה מוקדמת חוסכת אבדות'] },
  ],
  historySection: {
    teaser: 'נטישת מעוז גבול היא תהליך ולא אירוע.',
    fullContent: 'נטישת מעוז גבול\n\nרקע\n\nמעוזים רחוקים ננטשים בהדרגה. תחילה פוחת האיוש, אחר כך נפסקת האספקה הסדירה, ורק בסוף מתקבלת ההחלטה הרשמית.\n\nדפוס חוזר\n\nההחלטה מתקבלת כמעט תמיד מאוחר מדי מכדי להציל את המעוז, ומוקדם מספיק כדי להציל את האנשים.\n\nלקחים\n\n• ירידה באיוש היא סימן מקדים ולא תוצאה\n• נטישה מסודרת עדיפה על החזקה סמלית',
  },
}

const walkToWallContent: EventContent = {
  hero: {
    subtitle: 'מסע רגלי ארוך אל הגבול הצפוני',
    date: '8298-04-08', region: 'הצפון',
  },
  infoGrid: {
    commanderSummary: 'קבוצת מגויסים הועברה ברגל אל מעוזי הגבול. המסע ארך שבועות ולווה בקשיי אספקה.',
    eventType: 'אחר', eventTypeDetail: 'תנועת כוחות',
    sector: 'הדרך הצפונית',
    timeFrom: '06:00', timeTo: '18:00',
    forces: 'שיירת מגויסים ומלווים',
    enemy: 'ללא צד נגדי',
  },

  timeline: walkTimeline,
  commanderWord: 'מסע ארוך ברגל שוחק יותר מקרב קצר. האספקה היא שמכריעה מי מגיע.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['המסע ארך שבועות ברגל', 'לא היה מגע עם צד נגדי לאורך הדרך', 'קשיי האספקה היו הגורם המשמעותי'] },
    { heading: 'לקחים', points: ['תנועה ארוכה דורשת נקודות אספקה מתוכננות מראש', 'שחיקה מצטברת פוגעת בכושר עוד לפני ההגעה'] },
  ],
  historySection: {
    teaser: 'העברת מגויסים למרחק גדול היא בעיה לוגיסטית לפני שהיא בעיה מעשית.',
    fullContent: 'תנועת כוחות למרחק\n\nרקע\n\nהעברת קבוצה גדולה ברגל לאורך מאות קילומטרים מחייבת תחנות קבועות ומלאי מחושב.\n\nדפוס חוזר\n\nהקצב נקבע על ידי האיטיים ביותר ועל ידי השיירה, לא על ידי החזקים ביותר.\n\nלקחים\n\n• תחנות אספקה קובעות את המסלול, לא הקיצור הגאוגרפי\n• קבוצה שיצאה שלמה כמעט אף פעם אינה מגיעה שלמה',
  },
}

const councilContent: EventContent = {
  hero: {
    subtitle: 'כינוס מועצה לדיון בסדר השלטוני',
    date: '8299-02-14', region: 'ארצות הסערה',
  },
  infoGrid: {
    commanderSummary: 'נציגי הבתים התכנסו לדיון על הסדר השלטוני שלאחר המאבק. הדיון לא הניב הכרעה מחייבת.',
    eventType: 'אחר', eventTypeDetail: 'כינוס מדיני',
    sector: 'אולם המועצה',
    timeFrom: '09:00', timeTo: '16:00',
    forces: 'נציגי הבתים',
    enemy: 'ללא צד נגדי',
  },

  timeline: councilTimeline,
  commanderWord: 'מועצה שאין לה סמכות הכרעה מייצרת פרוטוקול, לא החלטה.',
  commanderHighlights: [
    { heading: 'נקודות מפתח', points: ['נציגי הבתים התכנסו מרצונם', 'לא הוגדר מנגנון הכרעה מחייב', 'הדיון הסתיים ללא החלטה'] },
    { heading: 'לקחים', points: ['כינוס ללא סמכות מוסכמת אינו מייצר הכרעה', 'הגדרת מנגנון ההצבעה חשובה יותר מסדר היום'] },
  ],
  historySection: {
    teaser: 'כינוסים של נציגי בתים חוזרים על עצמם אחרי כל מערכה.',
    fullContent: 'כינוסי נציגים\n\nרקע\n\nאחרי מערכה ארוכה מתכנסים נציגי הבתים כדי לדון בסדר השלטוני. הכינוס נעשה בהסכמה ולא מכוח סמכות.\n\nדפוס חוזר\n\nללא מנגנון הכרעה מוסכם מראש, הדיון מסתיים בהצהרות. ההכרעה בפועל נדחית לשדה.\n\nלקחים\n\n• מנגנון ההכרעה חשוב יותר מזהות המשתתפים\n• כינוס ללא סמכות מאריך את הסכסוך במקום לקצר אותו',
  },
}

// ═══════════════════ REFERENCE CONTENT ═══════════════════

const housesRefContent: ReferencePageContent = {
  hero: { subtitle: 'ריכוז מקורות על בתי האצולה המרכזיים' },
  overview: {
    synthesis: 'דף עיון רוחבי המרכז מקורות על בתי האצולה: אחוזות, בריתות וזיקות הדדיות. הדף אינו חלק מהיררכיית הנושאים אלא מקושר לרוחב.',
  },
  deepening: [
    { type: 'מסמך', title: 'סקירת הזירות — מסמך רקע', fileName: 'arenas_overview.txt', fileRef: assetPath('/mock-files/arenas_overview.txt') },
    { type: 'אוגדן', title: 'אוגדן בתי האצולה', url: assetPath('/bundles/houses.html') },
  ],

  commanderWord: 'רשימת מקורות שווה כמה שהיא מעודכנת. זו נבדקה לאחרונה בסוף המערכה.',
}

const chronologyRefContent: ReferencePageContent = {
  hero: { subtitle: 'כרונולוגיה מרוכזת של תקופת המאבק' },
  overview: {
    synthesis: 'דף עיון המרכז את סדר האירועים של התקופה בציר אחד, לצורך התמצאות מהירה בין הזירות.',
  },
  deepening: [
    { type: 'מסמך', title: 'סקירת מעבר הנהר', fileName: 'river_crossing.txt', fileRef: assetPath('/mock-files/river_crossing.txt') },
  ],

  commanderWord: 'סדר האירועים כאן נועד להתמצאות מהירה, לא להכרעה בין גרסאות.',
}

// Deliberately linked to NO topic — demonstrates the "unassigned reference" shelf on the reader home.
const glossaryRefContent: ReferencePageContent = {
  hero: { subtitle: 'מונחון קצר של מונחים ומנהגים בעולם הבדיוני' },
  overview: {
    synthesis: 'מונחון עצמאי שאינו משויך לאף דף נושא. הוא מופיע בקבוצת דפי העיון הלא-משויכים בעמוד הבית.',
  },
  deepening: [],

  commanderWord: 'המונחון נועד לקריאה רוחבית. אין בו הכרעה בין שימושים שונים באותו מונח.',
}

const sourcesRefContent: ReferencePageContent = {
  hero: { subtitle: 'רשימת מקורות גלויים — טיוטה' },
  overview: {
    synthesis: 'דף עיון בטיוטה. אינו מוצג לקוראים, ומשמש כאן כדי להראות שגם דף עיון יכול להישאר לא מפורסם.',
  },
  deepening: [],

  commanderWord: 'הרשימה בטיוטה. מקורות נוספים ייבדקו לפני פרסום.',
}

// ═══════════════════ PAGES ═══════════════════

export const mockPages: ContentPage[] = [
  // ── Topics ──
  {
    id: 't1', type: 'topic', title: 'מלחמת חמשת המלכים', status: 'published',
    createdAt: '8298-01-05T00:00:00.000Z', updatedAt: '8298-12-01T00:00:00.000Z', lastPublishedAt: '8298-12-01T00:00:00.000Z',
    content: warOfFiveKingsContent,
    publishedSnapshot: { title: 'מלחמת חמשת המלכים', content: warOfFiveKingsContent },
  },
  {
    id: 't2', type: 'topic', title: 'מסע הצפון', status: 'published',
    createdAt: '8298-03-01T00:00:00.000Z', updatedAt: '8298-10-10T00:00:00.000Z', lastPublishedAt: '8298-10-10T00:00:00.000Z',
    content: northMarchContent,
    publishedSnapshot: { title: 'מסע הצפון', content: northMarchContent },
  },
  {
    id: 't3', type: 'topic', title: 'המצור על קינגס לנדינג', status: 'published',
    createdAt: '8298-07-01T00:00:00.000Z', updatedAt: '8298-08-15T00:00:00.000Z', lastPublishedAt: '8298-08-15T00:00:00.000Z',
    content: siegeContent,
    publishedSnapshot: { title: 'המצור על קינגס לנדינג', content: siegeContent },
  },
  {
    id: 't4', type: 'topic', title: 'בית סטארק', status: 'published',
    createdAt: '8298-01-10T00:00:00.000Z', updatedAt: '8298-11-20T00:00:00.000Z', lastPublishedAt: '8298-11-20T00:00:00.000Z',
    content: houseStarkContent,
    publishedSnapshot: { title: 'בית סטארק', content: houseStarkContent },
  },
  {
    id: 't5', type: 'topic', title: 'בית לאניסטר', status: 'published',
    createdAt: '8298-01-10T00:00:00.000Z', updatedAt: '8298-11-18T00:00:00.000Z', lastPublishedAt: '8298-11-18T00:00:00.000Z',
    content: houseLannisterContent,
    publishedSnapshot: { title: 'בית לאניסטר', content: houseLannisterContent },
  },
  {
    // DRAFT — the publish-gate partner for e5.
    id: 't6', type: 'topic', title: 'המשמר הלילי', status: 'draft',
    createdAt: '8298-02-01T00:00:00.000Z', updatedAt: '8298-11-25T00:00:00.000Z',
    content: nightsWatchContent,
  },
  {
    // ARCHIVED — hidden from readers, visible tagged (בארכיון) in the management list.
    id: 't7', type: 'topic', title: 'מעבר לחומה', status: 'archived',
    createdAt: '8298-01-20T00:00:00.000Z', updatedAt: '8298-07-01T00:00:00.000Z', lastPublishedAt: '8298-06-30T00:00:00.000Z',
    content: beyondWallContent,
    publishedSnapshot: { title: 'מעבר לחומה', content: beyondWallContent },
  },

  // ── Events ──
  {
    id: 'e1', type: 'event', title: 'החתונה האדומה', status: 'published',
    createdAt: '8298-05-29T00:00:00.000Z', updatedAt: '8298-06-02T00:00:00.000Z', lastPublishedAt: '8298-06-02T00:00:00.000Z',
    content: redWeddingContent,
    publishedSnapshot: { title: 'החתונה האדומה', content: redWeddingContent },
  },
  {
    id: 'e2', type: 'event', title: 'קרב המים השחורים', status: 'published',
    createdAt: '8298-08-12T00:00:00.000Z', updatedAt: '8298-08-20T00:00:00.000Z', lastPublishedAt: '8298-08-20T00:00:00.000Z',
    content: blackwaterContent,
    publishedSnapshot: { title: 'קרב המים השחורים', content: blackwaterContent },
  },
  {
    id: 'e3', type: 'event', title: 'הקרב על חומות וינטרפל', status: 'published',
    createdAt: '8298-09-27T00:00:00.000Z', updatedAt: '8298-10-02T00:00:00.000Z', lastPublishedAt: '8298-10-02T00:00:00.000Z',
    content: winterfellBattleContent,
    publishedSnapshot: { title: 'הקרב על חומות וינטרפל', content: winterfellBattleContent },
  },
  {
    id: 'e4', type: 'event', title: 'משפט הדו-קרב', status: 'published',
    createdAt: '8298-06-11T00:00:00.000Z', updatedAt: '8298-06-15T00:00:00.000Z', lastPublishedAt: '8298-06-15T00:00:00.000Z',
    content: trialByCombatContent,
    publishedSnapshot: { title: 'משפט הדו-קרב', content: trialByCombatContent },
  },
  {
    // DRAFT — blocked from publishing because its only linked topic (t6) is itself a draft.
    id: 'e5', type: 'event', title: 'נפילת המצודה המזרחית', status: 'draft',
    createdAt: '8298-11-02T00:00:00.000Z', updatedAt: '8298-11-26T00:00:00.000Z',
    content: eastwatchFallContent,
  },
  {
    id: 'e6', type: 'event', title: 'מסע ההליכה אל הקיר', status: 'published',
    createdAt: '8298-04-08T00:00:00.000Z', updatedAt: '8298-04-30T00:00:00.000Z', lastPublishedAt: '8298-04-30T00:00:00.000Z',
    content: walkToWallContent,
    publishedSnapshot: { title: 'מסע ההליכה אל הקיר', content: walkToWallContent },
  },
  {
    // Dated 8299 — gives the reader home's event-year grouping two distinct years to show.
    id: 'e7', type: 'event', title: 'כינוס מועצת הלורדים', status: 'published',
    createdAt: '8299-02-14T00:00:00.000Z', updatedAt: '8299-02-20T00:00:00.000Z', lastPublishedAt: '8299-02-20T00:00:00.000Z',
    content: councilContent,
    publishedSnapshot: { title: 'כינוס מועצת הלורדים', content: councilContent },
  },

  // ── References ──
  {
    id: 'r1', type: 'reference', title: 'מקורות על בתי האצולה', status: 'published',
    createdAt: '8298-02-15T00:00:00.000Z', updatedAt: '8298-11-10T00:00:00.000Z', lastPublishedAt: '8298-11-10T00:00:00.000Z',
    content: housesRefContent,
    publishedSnapshot: { title: 'מקורות על בתי האצולה', content: housesRefContent },
  },
  {
    id: 'r2', type: 'reference', title: 'כרונולוגיית המלחמה', status: 'published',
    createdAt: '8298-03-01T00:00:00.000Z', updatedAt: '8298-12-05T00:00:00.000Z', lastPublishedAt: '8298-12-05T00:00:00.000Z',
    content: chronologyRefContent,
    publishedSnapshot: { title: 'כרונולוגיית המלחמה', content: chronologyRefContent },
  },
  {
    // UNASSIGNED — linked to no topic, so it lands in the unassigned-references group on the home page.
    id: 'r3', type: 'reference', title: 'מונחון', status: 'published',
    createdAt: '8298-04-01T00:00:00.000Z', updatedAt: '8298-09-20T00:00:00.000Z', lastPublishedAt: '8298-09-20T00:00:00.000Z',
    content: glossaryRefContent,
    publishedSnapshot: { title: 'מונחון', content: glossaryRefContent },
  },
  {
    id: 'r4', type: 'reference', title: 'רשימת מקורות גלויים', status: 'draft',
    createdAt: '8298-05-01T00:00:00.000Z', updatedAt: '8298-11-28T00:00:00.000Z',
    content: sourcesRefContent,
  },
]
