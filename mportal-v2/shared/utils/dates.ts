/** Dates métier au format ISO « YYYY-MM-DD », manipulées sans fuseau horaire. */

export type IsoDate = string

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

function parts(date: IsoDate): [number, number, number] {
  const m = ISO_RE.exec(date)
  if (!m) throw new Error(`Date invalide : ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

/** Date du jour en Suisse (Europe/Zurich), indépendamment du fuseau du serveur. */
export function todayIso(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date)
  return fromUtc(new Date(Date.UTC(y, m - 1, d + days)))
}

/** Ajoute des mois en restant sur le dernier jour du mois si besoin (31.01 + 1 mois = 28/29.02). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUtc(target)
}

export function addPeriod(date: IsoDate, period: 'YEARLY' | 'MONTHLY', count = 1): IsoDate {
  return addMonths(date, period === 'YEARLY' ? 12 * count : count)
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** 2026-10-25 → 25.10.2026 */
export function formatDateCh(date: IsoDate | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = parts(date)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}

/** 25.10.2026 → 2026-10-25 */
export function parseDateCh(input: string): IsoDate | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input.trim())
  if (!m) return null
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  return isIsoDate(iso) ? iso : null
}

export function formatDateTimeCh(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
