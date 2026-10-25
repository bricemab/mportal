import type { InternalApi } from 'nitropack/types'

/** Type de la réponse d'une route API (sérialisée JSON), dérivé du code serveur. */
export type ApiGet<R extends keyof InternalApi> = InternalApi[R] extends { get: infer T } ? T : never
export type ApiPost<R extends keyof InternalApi> = InternalApi[R] extends { post: infer T } ? T : never
export type ApiPut<R extends keyof InternalApi> = InternalApi[R] extends { put: infer T } ? T : never

export type DashboardData = ApiGet<'/api/dashboard'>
export type InvoiceList = ApiGet<'/api/invoices'>
export type InvoiceListItem = InvoiceList['items'][number]
export type InvoiceDetail = ApiGet<'/api/invoices/:id'>
export type ClientListItem = ApiGet<'/api/clients'>[number]
export type ClientDetail = ApiGet<'/api/clients/:id'>
export type ClientRow = ClientDetail['client']
export type ServiceRow = ApiGet<'/api/services'>[number]
export type SubscriptionListItem = ApiGet<'/api/subscriptions'>[number]
export type SubscriptionDetail = ApiGet<'/api/subscriptions/:id'>
export type ContractListItem = ApiGet<'/api/contracts'>[number]
export type ContractDetail = ApiGet<'/api/contracts/:id'>
export type ContractPeriod = ContractDetail['periods'][number]
export type ExpenseList = ApiGet<'/api/expenses'>
export type ExpenseItem = ExpenseList['items'][number]
export type BankTransactionList = ApiGet<'/api/bank/transactions'>
export type BankTransactionItem = BankTransactionList['items'][number]
export type BankImportItem = ApiGet<'/api/bank/imports'>[number]
export type BankImportSummary = ApiPost<'/api/bank/import'>
export type SettingsData = ApiGet<'/api/settings'>
export type AuditItem = ApiGet<'/api/audit'>[number]
export type UserItem = ApiGet<'/api/users'>[number]
export type ProfileData = ApiGet<'/api/auth/profile'>

export type ExpenseCategory = 'DOMAIN' | 'HOSTING' | 'VPS' | 'EMAIL' | 'SOFTWARE' | 'HARDWARE' | 'OTHER'

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  DOMAIN: 'Nom de domaine',
  HOSTING: 'Hébergement',
  VPS: 'VPS / serveur',
  EMAIL: 'Messagerie',
  SOFTWARE: 'Logiciel',
  HARDWARE: 'Matériel',
  OTHER: 'Autre',
}

export const expenseCategories = Object.keys(expenseCategoryLabels) as ExpenseCategory[]
