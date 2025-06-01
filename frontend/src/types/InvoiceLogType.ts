import { InvoiceState } from '@/types/InvoiceType.ts'

export interface InvoiceLogType {
  id: string
  code: InvoiceState
  details: string
  invoiceId: number
  clientId: number
  createdAt: string
  updatedAt: string
}
