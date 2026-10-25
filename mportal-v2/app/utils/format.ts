/** Centimes → valeur d'un champ de saisie (« 1234.50 »). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

/** Champ de saisie → centimes ; null si vide, NaN si invalide. */
export function inputToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (text === '') return null
  const cents = parseAmountToCents(text)
  return cents === null ? Number.NaN : cents
}

export function formatHours(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} h`
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export const periodLabels = { YEARLY: 'Annuel', MONTHLY: 'Mensuel' } as const

export const statusBadgeClasses: Record<string, string> = {
  DRAFT: 'bg-neutral-800 text-neutral-300',
  ISSUED: 'bg-sky-950 text-sky-300',
  SENT: 'bg-indigo-950 text-indigo-300',
  OVERDUE: 'bg-red-950 text-red-300',
  PARTIALLY_PAID: 'bg-amber-950 text-amber-300',
  PAID: 'bg-emerald-950 text-emerald-300',
  CANCELLED: 'bg-neutral-900 text-neutral-500 line-through',
  WRITTEN_OFF: 'bg-purple-950 text-purple-300',
}
