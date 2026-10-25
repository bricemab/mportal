/**
 * Référence QR suisse (27 chiffres) : 26 chiffres + chiffre de contrôle modulo 10 récursif.
 * Identique à l'ancienne application, pour que les références déjà émises restent valides.
 */
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5]

export function qrCheckDigit(base: string): number {
  let carry = 0
  for (const char of base) {
    carry = MOD10_TABLE[(Number.parseInt(char, 10) + carry) % 10] ?? 0
  }
  return (10 - carry) % 10
}

export function qrReferenceFromNumber(invoiceNumber: number): string {
  const base = Math.trunc(invoiceNumber).toString().padStart(26, '0')
  if (base.length !== 26) throw new Error('Numéro de facture trop long pour une référence QR')
  return base + qrCheckDigit(base)
}

export function isValidQrReference(reference: string): boolean {
  if (!/^\d{27}$/.test(reference)) return false
  return qrCheckDigit(reference.slice(0, 26)) === Number(reference[26])
}

/** Normalise « 00 00000 00000 03255 48567 42555 » → « 000000000000032554856742555 » */
export function normalizeQrReference(input: string): string | null {
  const digits = input.replace(/\s/g, '')
  return isValidQrReference(digits) ? digits : null
}

/** Affichage par blocs comme sur les bulletins : 00 00000 00000 03255 48567 42555 */
export function formatQrReference(reference: string): string {
  if (reference.length !== 27) return reference
  const parts = [reference.slice(0, 2)]
  for (let i = 2; i < 27; i += 5) parts.push(reference.slice(i, i + 5))
  return parts.join(' ')
}
