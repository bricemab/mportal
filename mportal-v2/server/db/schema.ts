import {
  bigint,
  boolean,
  char,
  date,
  datetime,
  decimal,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

/**
 * Conventions :
 * - montants en centimes (INT) ;
 * - dates métier en DATE (mode string « YYYY-MM-DD ») ;
 * - horodatages en DATETIME UTC, toujours renseignés par l'application (jamais par la DB).
 */

const now = () => new Date()

const timestamps = {
  createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().$defaultFn(now).$onUpdateFn(now),
}

// ---------------------------------------------------------------------------
// Utilisateurs & sécurité
// ---------------------------------------------------------------------------

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 190 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstname: varchar('firstname', { length: 100 }).notNull(),
  lastname: varchar('lastname', { length: 100 }).notNull(),
  // IBAN personnel : permet de reconnaître les prélèvements associés dans les relevés
  bankIban: varchar('bank_iban', { length: 34 }),
  // Incrémenté pour invalider toutes les sessions (changement de mot de passe, déconnexion globale)
  sessionVersion: int('session_version').notNull().default(1),
  lastLoginAt: datetime('last_login_at', { mode: 'date' }),
  ...timestamps,
})

export const loginAttempts = mysqlTable(
  'login_attempts',
  {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 190 }).notNull(),
    ip: varchar('ip', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 255 }).notNull(),
    success: boolean('success').notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  },
  (t) => [index('login_attempts_email_idx').on(t.email, t.createdAt), index('login_attempts_ip_idx').on(t.ip, t.createdAt)],
)

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().$defaultFn(now).$onUpdateFn(now),
})

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').references(() => users.id),
    action: varchar('action', { length: 64 }).notNull(),
    entity: varchar('entity', { length: 64 }).notNull(),
    entityId: int('entity_id'),
    changes: json('changes').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 64 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_created_idx').on(t.createdAt)],
)

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------

export const clients = mysqlTable('clients', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 190 }).notNull(),
  firstname: varchar('firstname', { length: 100 }),
  lastname: varchar('lastname', { length: 100 }),
  email: varchar('email', { length: 190 }),
  phone: varchar('phone', { length: 40 }),
  street: varchar('street', { length: 190 }),
  streetNumber: varchar('street_number', { length: 16 }),
  postalCode: varchar('postal_code', { length: 16 }),
  city: varchar('city', { length: 100 }),
  country: char('country', { length: 2 }).notNull().default('CH'),
  remark: text('remark'),
  archivedAt: datetime('archived_at', { mode: 'date' }),
  ...timestamps,
})

export const serviceKinds = ['ONE_SHOT', 'RECURRING'] as const

export const services = mysqlTable('services', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 190 }).notNull(),
  description: text('description'),
  kind: mysqlEnum('kind', serviceKinds).notNull(),
  defaultPriceCents: int('default_price_cents'),
  defaultCostCents: int('default_cost_cents'),
  // Lie le service à un contrat de maintenance (quota d'heures)
  isMaintenance: boolean('is_maintenance').notNull().default(false),
  archivedAt: datetime('archived_at', { mode: 'date' }),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Abonnements
// ---------------------------------------------------------------------------

export const subscriptionPeriods = ['YEARLY', 'MONTHLY'] as const
export const subscriptionStatuses = ['ACTIVE', 'ENDED'] as const

export const subscriptions = mysqlTable(
  'subscriptions',
  {
    id: int('id').autoincrement().primaryKey(),
    clientId: int('client_id')
      .notNull()
      .references(() => clients.id),
    name: varchar('name', { length: 190 }).notNull(),
    period: mysqlEnum('period', subscriptionPeriods).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    nextBillingDate: date('next_billing_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    status: mysqlEnum('status', subscriptionStatuses).notNull().default('ACTIVE'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('subscriptions_next_idx').on(t.status, t.nextBillingDate)],
)

export const subscriptionLines = mysqlTable('subscription_lines', {
  id: int('id').autoincrement().primaryKey(),
  subscriptionId: int('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  serviceId: int('service_id')
    .notNull()
    .references(() => services.id),
  label: varchar('label', { length: 190 }),
  quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  unitPriceCents: int('unit_price_cents').notNull(),
  unitCostCents: int('unit_cost_cents'),
  supplier: varchar('supplier', { length: 100 }),
  position: int('position').notNull().default(0),
  endedAt: date('ended_at', { mode: 'string' }),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

export const invoiceStatuses = ['DRAFT', 'ISSUED', 'SENT', 'CANCELLED', 'WRITTEN_OFF'] as const

export const invoices = mysqlTable(
  'invoices',
  {
    id: int('id').autoincrement().primaryKey(),
    number: bigint('number', { mode: 'number' }).notNull().unique(),
    qrReference: char('qr_reference', { length: 27 }).notNull().unique(),
    clientId: int('client_id')
      .notNull()
      .references(() => clients.id),
    subscriptionId: int('subscription_id').references(() => subscriptions.id),
    // Début de la période facturée par l'abonnement (unicité = pas de double génération)
    billingPeriodStart: date('billing_period_start', { mode: 'string' }),
    title: varchar('title', { length: 255 }).notNull(),
    status: mysqlEnum('status', invoiceStatuses).notNull().default('DRAFT'),
    issueDate: date('issue_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    totalCents: int('total_cents').notNull().default(0),
    paidCents: int('paid_cents').notNull().default(0),
    pdfFile: varchar('pdf_file', { length: 255 }),
    sentAt: datetime('sent_at', { mode: 'date' }),
    cancelledAt: datetime('cancelled_at', { mode: 'date' }),
    writtenOffAt: datetime('written_off_at', { mode: 'date' }),
    writeOffReason: varchar('write_off_reason', { length: 255 }),
    notes: text('notes'),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('invoices_subscription_period_uq').on(t.subscriptionId, t.billingPeriodStart),
    index('invoices_client_idx').on(t.clientId),
    index('invoices_status_idx').on(t.status, t.dueDate),
    index('invoices_issue_idx').on(t.issueDate),
  ],
)

export const invoiceLines = mysqlTable('invoice_lines', {
  id: int('id').autoincrement().primaryKey(),
  invoiceId: int('invoice_id')
    .notNull()
    .references(() => invoices.id),
  serviceId: int('service_id').references(() => services.id),
  subscriptionLineId: int('subscription_line_id').references(() => subscriptionLines.id),
  label: varchar('label', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  unitPriceCents: int('unit_price_cents').notNull(),
  unitCostCents: int('unit_cost_cents'),
  position: int('position').notNull().default(0),
})

export const invoiceEvents = mysqlTable(
  'invoice_events',
  {
    id: int('id').autoincrement().primaryKey(),
    invoiceId: int('invoice_id')
      .notNull()
      .references(() => invoices.id),
    type: varchar('type', { length: 32 }).notNull(),
    message: varchar('message', { length: 500 }).notNull(),
    userId: int('user_id').references(() => users.id),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  },
  (t) => [index('invoice_events_invoice_idx').on(t.invoiceId)],
)

// ---------------------------------------------------------------------------
// Banque, paiements, dépenses
// ---------------------------------------------------------------------------

export const bankFormats = ['CAMT053', 'PDF'] as const

export const bankImports = mysqlTable('bank_imports', {
  id: int('id').autoincrement().primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileHash: char('file_hash', { length: 64 }).notNull().unique(),
  format: mysqlEnum('format', bankFormats).notNull(),
  iban: varchar('iban', { length: 34 }),
  periodFrom: date('period_from', { mode: 'string' }),
  periodTo: date('period_to', { mode: 'string' }),
  openingBalanceCents: int('opening_balance_cents'),
  closingBalanceCents: int('closing_balance_cents'),
  transactionCount: int('transaction_count').notNull().default(0),
  newTransactionCount: int('new_transaction_count').notNull().default(0),
  importedBy: int('imported_by').references(() => users.id),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
})

export const bankDirections = ['CREDIT', 'DEBIT'] as const
export const bankKinds = ['UNCLASSIFIED', 'INVOICE_PAYMENT', 'EXPENSE', 'PARTNER_WITHDRAWAL', 'OTHER'] as const
export const bankStatuses = ['PENDING', 'MATCHED', 'IGNORED'] as const

export const bankTransactions = mysqlTable(
  'bank_transactions',
  {
    id: int('id').autoincrement().primaryKey(),
    importId: int('import_id')
      .notNull()
      .references(() => bankImports.id),
    // Empreinte commune aux formats camt.053 et PDF : un même mouvement n'est jamais importé deux fois
    fingerprint: char('fingerprint', { length: 64 }).notNull().unique(),
    bookingDate: date('booking_date', { mode: 'string' }).notNull(),
    valueDate: date('value_date', { mode: 'string' }),
    amountCents: int('amount_cents').notNull(),
    direction: mysqlEnum('direction', bankDirections).notNull(),
    counterparty: varchar('counterparty', { length: 255 }),
    counterpartyIban: varchar('counterparty_iban', { length: 34 }),
    description: text('description'),
    qrReference: char('qr_reference', { length: 27 }),
    kind: mysqlEnum('kind', bankKinds).notNull().default('UNCLASSIFIED'),
    partnerUserId: int('partner_user_id').references(() => users.id),
    status: mysqlEnum('status', bankStatuses).notNull().default('PENDING'),
    matchedAt: datetime('matched_at', { mode: 'date' }),
    matchedBy: int('matched_by').references(() => users.id),
    note: varchar('note', { length: 255 }),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  },
  (t) => [index('bank_tx_status_idx').on(t.status, t.bookingDate), index('bank_tx_ref_idx').on(t.qrReference)],
)

export const payments = mysqlTable(
  'payments',
  {
    id: int('id').autoincrement().primaryKey(),
    invoiceId: int('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amountCents: int('amount_cents').notNull(),
    paidAt: date('paid_at', { mode: 'string' }).notNull(),
    bankTransactionId: int('bank_transaction_id').references(() => bankTransactions.id),
    note: varchar('note', { length: 255 }),
    createdBy: int('created_by').references(() => users.id),
    createdAt: datetime('created_at', { mode: 'date' }).notNull().$defaultFn(now),
  },
  (t) => [index('payments_invoice_idx').on(t.invoiceId), index('payments_paid_idx').on(t.paidAt)],
)

export const expenseCategories = ['DOMAIN', 'HOSTING', 'VPS', 'EMAIL', 'SOFTWARE', 'HARDWARE', 'OTHER'] as const

export const expenses = mysqlTable(
  'expenses',
  {
    id: int('id').autoincrement().primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    amountCents: int('amount_cents').notNull(),
    supplier: varchar('supplier', { length: 100 }),
    category: mysqlEnum('category', expenseCategories).notNull().default('OTHER'),
    label: varchar('label', { length: 255 }).notNull(),
    clientId: int('client_id').references(() => clients.id),
    invoiceId: int('invoice_id').references(() => invoices.id),
    subscriptionLineId: int('subscription_line_id').references(() => subscriptionLines.id),
    bankTransactionId: int('bank_transaction_id')
      .references(() => bankTransactions.id)
      .unique(),
    notes: text('notes'),
    createdBy: int('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('expenses_date_idx').on(t.date)],
)

// ---------------------------------------------------------------------------
// Contrats de maintenance
// ---------------------------------------------------------------------------

export const contractStatuses = ['ACTIVE', 'ENDED'] as const

export const maintenanceContracts = mysqlTable('maintenance_contracts', {
  id: int('id').autoincrement().primaryKey(),
  clientId: int('client_id')
    .notNull()
    .references(() => clients.id),
  subscriptionLineId: int('subscription_line_id').references(() => subscriptionLines.id),
  name: varchar('name', { length: 190 }).notNull(),
  hoursPerPeriod: decimal('hours_per_period', { precision: 8, scale: 2, mode: 'number' }).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  status: mysqlEnum('status', contractStatuses).notNull().default('ACTIVE'),
  fileName: varchar('file_name', { length: 255 }),
  fileOriginalName: varchar('file_original_name', { length: 255 }),
  notes: text('notes'),
  ...timestamps,
})

export const maintenancePeriods = mysqlTable(
  'maintenance_periods',
  {
    id: int('id').autoincrement().primaryKey(),
    contractId: int('contract_id')
      .notNull()
      .references(() => maintenanceContracts.id),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    hoursQuota: decimal('hours_quota', { precision: 8, scale: 2, mode: 'number' }).notNull(),
    invoiceId: int('invoice_id').references(() => invoices.id),
    ...timestamps,
  },
  (t) => [uniqueIndex('maintenance_periods_contract_start_uq').on(t.contractId, t.startDate)],
)

export const timeEntries = mysqlTable(
  'time_entries',
  {
    id: int('id').autoincrement().primaryKey(),
    periodId: int('period_id')
      .notNull()
      .references(() => maintenancePeriods.id),
    date: date('date', { mode: 'string' }).notNull(),
    hours: decimal('hours', { precision: 6, scale: 2, mode: 'number' }).notNull(),
    description: text('description').notNull(),
    userId: int('user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('time_entries_period_idx').on(t.periodId)],
)

// ---------------------------------------------------------------------------
// Archive de l'ancienne application
// ---------------------------------------------------------------------------

export const legacyHistory = mysqlTable('legacy_history', {
  id: int('id').primaryKey(),
  tableName: varchar('table_name', { length: 64 }).notNull(),
  tableId: int('table_id').notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  userId: int('user_id'),
  value: longtext('value'),
  changes: longtext('changes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull(),
})
