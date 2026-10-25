import { eq, sql } from 'drizzle-orm'
import type { DbOrTx } from '../db/client'
import { settings } from '../db/schema'
import { badRequest } from './errors'

export const SETTING_DEFAULTS = {
  COMPANY_NAME: 'MDevelopment',
  COMPANY_HOLDER: 'Mabillard Brice & Mayoraz Théo',
  COMPANY_STREET: 'Route de la Fontaine',
  COMPANY_STREET_NUMBER: '39',
  COMPANY_POSTAL_CODE: '1921',
  COMPANY_CITY: 'Martigny-Croix',
  COMPANY_COUNTRY: 'CH',
  COMPANY_EMAIL: 'contact@mdevelopment.ch',
  QR_IBAN: 'CH9730765001055862405',
  BANK_IBAN: 'CH7500765001055862405',
  INVOICE_DUE_DAYS: '30',
  SUBSCRIPTION_LEAD_DAYS: '30',
  // Dernier numéro attribué (la prochaine facture prend +1)
  INVOICE_NUMBER: '3255485674200',
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type SettingsMap = Record<SettingKey, string>

export async function ensureDefaultSettings(db: DbOrTx): Promise<void> {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { key: sql`\`key\`` } })
  }
}

export async function getSettings(db: DbOrTx): Promise<SettingsMap> {
  const rows = await db.select().from(settings)
  const map: SettingsMap = { ...SETTING_DEFAULTS }
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) map[row.key as SettingKey] = row.value
  }
  return map
}

export async function getNumberSetting(db: DbOrTx, key: SettingKey): Promise<number> {
  const map = await getSettings(db)
  const value = Number(map[key])
  return Number.isFinite(value) ? value : Number(SETTING_DEFAULTS[key])
}

export async function updateSettings(db: DbOrTx, values: Partial<Record<SettingKey, string>>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in SETTING_DEFAULTS) || key === 'INVOICE_NUMBER' || value === undefined) continue
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } })
  }
}

/**
 * Attribue le prochain numéro de facture. Doit être appelé dans une transaction :
 * la ligne du réglage est verrouillée (SELECT … FOR UPDATE) jusqu'au commit.
 */
export async function allocateInvoiceNumber(tx: DbOrTx): Promise<number> {
  const rows = await tx.select().from(settings).where(eq(settings.key, 'INVOICE_NUMBER')).for('update')
  const current = rows[0] ? Number(rows[0].value) : Number(SETTING_DEFAULTS.INVOICE_NUMBER)
  if (!Number.isSafeInteger(current)) throw badRequest('Réglage INVOICE_NUMBER invalide')
  const next = current + 1
  await tx
    .insert(settings)
    .values({ key: 'INVOICE_NUMBER', value: String(next) })
    .onDuplicateKeyUpdate({ set: { value: String(next) } })
  return next
}
