export interface InvoiceType {
  id: number
  name: string
  clientId: number
  state: InvoiceStatus
  createdAt: string
  updatedAt: string
}

export enum InvoiceStatus {
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  UNPAID = 'UNPAID',
}
