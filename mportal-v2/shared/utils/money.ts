/** Montants : toujours en centimes (entiers) dans le code et la base. */

export function toCents(value: number): number {
  return Math.round(value * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** Total d'une ligne : quantité (2 décimales max) × prix unitaire en centimes, arrondi au centime. */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents)
}

export function sumLinesCents(lines: ReadonlyArray<{ quantity: number; unitPriceCents: number }>): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l.quantity, l.unitPriceCents), 0)
}

/** Format suisse : 1'234.50 */
export function formatAmount(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const francs = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  const rappen = (abs % 100).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${francs}.${rappen}`
}

export function formatChf(cents: number): string {
  return `${formatAmount(cents)} CHF`
}

/** « 1'234.50 », « 1234,5 », « 12 » → centimes. Retourne null si invalide. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/['\s]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return toCents(Number(cleaned))
}
