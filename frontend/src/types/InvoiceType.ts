import { type ClientType } from '@/types/ClientType.ts'
import { type InvoiceLogType } from '@/types/InvoiceLogType.ts'
import { type InvoiceServiceType } from '@/types/InvoiceServiceType.ts'

export interface InvoiceType {
  id: number
  name: string
  clientId: number
  state: InvoiceState
  createdAt: string
  updatedAt: string
}

export enum InvoiceState {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  UNPAID = 'UNPAID',
}

export interface InvoicePage {
  id: number
  name: string
  number: string
  amount: number
  client: ClientType
  logs: InvoiceLogType[]
  services: InvoiceServiceType[]
  createdAt: string
  updatedAt: string
}
