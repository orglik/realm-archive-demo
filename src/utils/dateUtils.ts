/**
 * Formats any ISO date string or timestamp into a Hebrew-style display string.
 *
 *   YYYY-MM-DD    →  DD.MM.YYYY
 *   ISO timestamp →  DD.MM.YYYY, HH:MM
 *
 * Date-only strings are parsed manually to avoid UTC-offset day-shift issues.
 * All other callers should pass the raw ISO value and let this function decide.
 */
export function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (isNaN(ts)) return iso
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (mins  <  1) return 'עכשיו'
  if (mins  === 1) return 'לפני דקה'
  if (mins  <  60) return `לפני ${mins} דקות`
  if (hours === 1) return 'לפני שעה'
  if (hours === 2) return 'לפני שעתיים'
  if (hours <  24) return `לפני ${hours} שעות`
  if (days  === 1) return 'אתמול'
  if (days  <   7) return `לפני ${days} ימים`
  if (weeks === 1) return 'לפני שבוע'
  if (weeks === 2) return 'לפני שבועיים'
  if (weeks <   4) return `לפני ${weeks} שבועות`
  if (months === 1) return 'לפני חודש'
  if (months === 2) return 'לפני חודשיים'
  return `לפני ${months} חודשים`
}

export function formatDate(iso: string): string {
  if (!iso) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }

  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return iso

  const d = String(dt.getDate()).padStart(2, '0')
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const y = dt.getFullYear()
  const H = String(dt.getHours()).padStart(2, '0')
  const M = String(dt.getMinutes()).padStart(2, '0')
  return `${d}.${m}.${y}, ${H}:${M}`
}
