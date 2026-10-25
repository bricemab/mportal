import { todayIso } from './dates'

export type InvoiceLifecycleStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'CANCELLED' | 'WRITTEN_OFF'

/** Statut affiché : combine le cycle de vie et les paiements reçus. */
export type InvoiceDisplayStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'SENT'
  | 'OVERDUE'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED'
  | 'WRITTEN_OFF'

export interface InvoiceStatusInput {
  status: InvoiceLifecycleStatus
  totalCents: number
  paidCents: number
  dueDate: string | null
}

export function displayStatus(invoice: InvoiceStatusInput, today: string = todayIso()): InvoiceDisplayStatus {
  if (invoice.status === 'CANCELLED') return 'CANCELLED'
  if (invoice.status === 'WRITTEN_OFF') return 'WRITTEN_OFF'
  if (invoice.totalCents > 0 && invoice.paidCents >= invoice.totalCents) return 'PAID'
  if (invoice.status === 'DRAFT') return 'DRAFT'
  if (invoice.paidCents > 0) return 'PARTIALLY_PAID'
  if (invoice.status === 'SENT' && invoice.dueDate && invoice.dueDate < today) return 'OVERDUE'
  return invoice.status
}

export const invoiceStatusLabels: Record<InvoiceDisplayStatus, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  SENT: 'Envoyée',
  OVERDUE: 'En retard',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
  WRITTEN_OFF: 'Soldée',
}

/** Une facture n'est plus modifiable dès qu'elle est envoyée, payée (même partiellement) ou close. */
export function isInvoiceEditable(invoice: InvoiceStatusInput): boolean {
  return (invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && invoice.paidCents === 0
}

/** Reste dû, jamais négatif. */
export function remainingCents(invoice: { totalCents: number; paidCents: number }): number {
  return Math.max(0, invoice.totalCents - invoice.paidCents)
}
