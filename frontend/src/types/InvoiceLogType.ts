import { InvoiceStatus } from '@/types/InvoiceType.ts'

export interface InvoiceLogType {
  id: string
  code: InvoiceStatus
  details: string
  invoiceId: number
  clientId: number
  createdAt: string
  updatedAt: string
}
