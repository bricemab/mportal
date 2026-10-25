import { z } from 'zod'
import { isIsoDate } from './dates'

/** Schémas de validation partagés entre les formulaires et l'API. */

const trimmed = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const isoDateSchema = z.string().refine(isIsoDate, 'Date invalide (AAAA-MM-JJ)')
export const optionalIsoDateSchema = isoDateSchema.nullish().transform((v) => v ?? null)
export const centsSchema = z.number().int().min(0).max(100_000_000)
export const signedCentsSchema = z.number().int().min(-100_000_000).max(100_000_000)
export const quantitySchema = z
  .number()
  .positive()
  .max(100_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, '2 décimales maximum')
export const idSchema = z.number().int().positive()
export const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(190).pipe(z.email('Email invalide')),
  password: z.string().min(1).max(200),
})

export const passwordSchema = z
  .string()
  .min(12, '12 caractères minimum')
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), 'Au moins une minuscule, une majuscule et un chiffre')

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
})

export const profileSchema = z.object({
  firstname: trimmed(100).min(1),
  lastname: trimmed(100).min(1),
  bankIban: optionalText(34).refine((v) => v === null || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v.replace(/\s/g, '')), 'IBAN invalide'),
})

export const clientSchema = z.object({
  name: trimmed(190).min(1, 'Nom requis'),
  firstname: optionalText(100),
  lastname: optionalText(100),
  email: z
    .string()
    .trim()
    .max(190)
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.email().safeParse(v).success, 'Email invalide'),
  phone: optionalText(40),
  street: optionalText(190),
  streetNumber: optionalText(16),
  postalCode: optionalText(16),
  city: optionalText(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Code pays sur 2 lettres')
    .default('CH'),
  remark: optionalText(5000),
})
export type ClientInput = z.infer<typeof clientSchema>

export const serviceSchema = z.object({
  name: trimmed(190).min(1, 'Nom requis'),
  description: optionalText(2000),
  kind: z.enum(['ONE_SHOT', 'RECURRING']),
  defaultPriceCents: centsSchema.nullish().transform((v) => v ?? null),
  defaultCostCents: centsSchema.nullish().transform((v) => v ?? null),
  isMaintenance: z.boolean().default(false),
})
export type ServiceInput = z.infer<typeof serviceSchema>

export const invoiceLineSchema = z.object({
  serviceId: idSchema.nullish().transform((v) => v ?? null),
  label: trimmed(255).min(1, 'Libellé requis'),
  quantity: quantitySchema,
  unitPriceCents: centsSchema,
  unitCostCents: centsSchema.nullish().transform((v) => v ?? null),
})
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>

export const invoiceSchema = z.object({
  clientId: idSchema,
  title: trimmed(255).min(1, 'Titre requis'),
  notes: optionalText(2000),
  lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne').max(100),
  // Crée une dépense pour chaque ligne qui a un coût (remplace la « facture MDev »)
  createExpenses: z.boolean().default(false),
  expenseSupplier: optionalText(100),
})
export type InvoiceInput = z.infer<typeof invoiceSchema>

export const paymentSchema = z.object({
  amountCents: centsSchema.refine((v) => v > 0, 'Montant requis'),
  paidAt: isoDateSchema,
  note: optionalText(255),
})

export const writeOffSchema = z.object({
  reason: trimmed(255).min(3, 'Motif requis'),
})

export const subscriptionLineSchema = z.object({
  id: idSchema.optional(),
  serviceId: idSchema,
  label: optionalText(190),
  quantity: quantitySchema,
  unitPriceCents: centsSchema,
  unitCostCents: centsSchema.nullish().transform((v) => v ?? null),
  supplier: optionalText(100),
})

export const subscriptionSchema = z.object({
  clientId: idSchema,
  name: trimmed(190).min(1, 'Nom requis'),
  period: z.enum(['YEARLY', 'MONTHLY']),
  startDate: isoDateSchema,
  nextBillingDate: isoDateSchema,
  notes: optionalText(2000),
  lines: z.array(subscriptionLineSchema).min(1, 'Au moins une ligne').max(50),
})
export type SubscriptionInput = z.infer<typeof subscriptionSchema>

export const endSchema = z.object({
  endDate: isoDateSchema,
})

export const expenseSchema = z.object({
  date: isoDateSchema,
  amountCents: centsSchema.refine((v) => v > 0, 'Montant requis'),
  supplier: optionalText(100),
  category: z.enum(['DOMAIN', 'HOSTING', 'VPS', 'EMAIL', 'SOFTWARE', 'HARDWARE', 'OTHER']),
  label: trimmed(255).min(1, 'Libellé requis'),
  clientId: idSchema.nullish().transform((v) => v ?? null),
  invoiceId: idSchema.nullish().transform((v) => v ?? null),
  notes: optionalText(2000),
})
export type ExpenseInput = z.infer<typeof expenseSchema>

export const contractSchema = z.object({
  clientId: idSchema,
  name: trimmed(190).min(1, 'Nom requis'),
  hoursPerPeriod: z.number().positive().max(10_000),
  startDate: isoDateSchema,
  subscriptionLineId: idSchema.nullish().transform((v) => v ?? null),
  notes: optionalText(2000),
})
export type ContractInput = z.infer<typeof contractSchema>

export const timeEntrySchema = z.object({
  date: isoDateSchema,
  hours: z
    .number()
    .positive()
    .max(1000)
    .refine((v) => Math.abs(Math.round(v * 4) - v * 4) < 1e-6, 'Par quart d’heure (0.25)'),
  description: trimmed(5000).min(1, 'Description requise'),
})

export const periodSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  hoursQuota: z.number().positive().max(10_000),
})

export const settingsSchema = z.object({
  COMPANY_NAME: trimmed(70).min(1),
  COMPANY_HOLDER: trimmed(70).min(1),
  COMPANY_STREET: trimmed(70).min(1),
  COMPANY_STREET_NUMBER: trimmed(16),
  COMPANY_POSTAL_CODE: trimmed(16).min(1),
  COMPANY_CITY: trimmed(35).min(1),
  COMPANY_COUNTRY: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  COMPANY_EMAIL: trimmed(190),
  QR_IBAN: z
    .string()
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .pipe(z.string().regex(/^CH\d{2}3[01]\d{3}[A-Z0-9]{12}$/, 'QR-IBAN suisse invalide')),
  BANK_IBAN: z
    .string()
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .pipe(z.string().regex(/^CH\d{19}$/, 'IBAN suisse invalide')),
  INVOICE_DUE_DAYS: z.coerce.number().int().min(0).max(365).transform(String),
  SUBSCRIPTION_LEAD_DAYS: z.coerce.number().int().min(0).max(120).transform(String),
})
export type SettingsInput = z.infer<typeof settingsSchema>

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
})
