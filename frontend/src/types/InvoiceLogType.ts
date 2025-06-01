import { InvoiceState } from '@/types/InvoiceType.ts'

export enum InvoiceLogCode {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  UNPAID = 'UNPAID',
}

export interface InvoiceLogType {
  id: string
  code: InvoiceLogCode
  details: string
  invoiceId: number
  clientId: number
  createdAt: string
  updatedAt: string
}
