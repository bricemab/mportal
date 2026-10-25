<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, Ban, Link2, Plus, RotateCcw, Upload, UserRound } from 'lucide-vue-next'
import {
  expenseCategories,
  expenseCategoryLabels,
  type BankImportItem,
  type BankImportSummary,
  type BankTransactionItem,
  type BankTransactionList,
  type ClientListItem,
  type ExpenseCategory,
  type InvoiceList,
  type UserItem,
} from '~/types/api'

useHead({ title: 'Banque – MPortal' })

const status = ref<'PENDING' | 'MATCHED' | 'IGNORED'>('PENDING')
const direction = ref<'' | 'CREDIT' | 'DEBIT'>('')
const page = ref(1)
watch([status, direction], () => (page.value = 1))

const { data, pending, refresh } = await useApiFetch<BankTransactionList>('/api/bank/transactions', {
  query: () => ({ status: status.value, direction: direction.value || undefined, page: page.value, pageSize: 50 }),
})
const { data: imports, refresh: refreshImports } = await useApiFetch<BankImportItem[]>('/api/bank/imports')
const { data: users } = await useApiFetch<UserItem[]>('/api/users')
const { data: clients } = await useApiFetch<ClientListItem[]>('/api/clients')
const { data: openInvoices, refresh: refreshOpen } = await useApiFetch<InvoiceList>('/api/invoices', { query: { status: 'OPEN', pageSize: 100 } })

const { pending: busy, run } = useAction()

async function reloadAll() {
  await Promise.all([refresh(), refreshImports(), refreshOpen()])
}

// Import
const fileInput = ref<HTMLInputElement | null>(null)
const summary = ref<BankImportSummary | null>(null)
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const body = new FormData()
  body.append('file', file)
  const result = await run<BankImportSummary>('POST', '/api/bank/import', body, 'Relevé importé')
  if (fileInput.value) fileInput.value.value = ''
  if (result) {
    summary.value = result
    await reloadAll()
  }
}

// Actions sur un mouvement
async function act(t: BankTransactionItem, path: string, body: Record<string, unknown>, message: string) {
  const ok = await run('POST', `/api/bank/transactions/${t.id}/${path}`, body, message)
  if (ok !== null) await reloadAll()
}
const manualInvoice = reactive<Record<number, string>>({})
const partnerChoice = reactive<Record<number, string>>({})

// Création de dépense
const expenseFor = ref<BankTransactionItem | null>(null)
const expenseForm = reactive({ category: 'OTHER' as ExpenseCategory, label: '', supplier: '', clientId: '' })
function openExpense(t: BankTransactionItem) {
  expenseFor.value = t
  const suggested = t.suggestions && 'category' in t.suggestions ? t.suggestions.category : 'OTHER'
  Object.assign(expenseForm, {
    category: suggested,
    label: t.counterparty ? `${t.counterparty} – ${formatDateCh(t.bookingDate)}` : (t.description ?? '').slice(0, 120),
    supplier: t.counterparty ?? '',
    clientId: '',
  })
}
async function submitExpense() {
  if (!expenseFor.value) return
  const t = expenseFor.value
  const ok = await run(
    'POST',
    `/api/bank/transactions/${t.id}/create-expense`,
    {
      category: expenseForm.category,
      label: expenseForm.label,
      supplier: expenseForm.supplier || null,
      clientId: expenseForm.clientId ? Number(expenseForm.clientId) : null,
      invoiceId: null,
    },
    'Dépense créée et rapprochée',
  )
  if (ok !== null) {
    expenseFor.value = null
    await reloadAll()
  }
}

async function reset(t: BankTransactionItem) {
  if (!window.confirm('Remettre ce mouvement « à traiter » ? Le paiement ou la dépense lié est conservé mais délié.')) return
  await act(t, 'reset', {}, 'Rapprochement annulé')
}

const kindLabels: Record<string, string> = {
  INVOICE_PAYMENT: 'Paiement de facture',
  EXPENSE: 'Dépense',
  PARTNER_WITHDRAWAL: 'Prélèvement associé',
  OTHER: 'Autre',
  UNCLASSIFIED: 'Non classé',
}
</script>

<template>
  <div>
    <PageHeader title="Banque" subtitle="Import des relevés BCVS (PDF « Transactions individuelles avec détails » ou camt.053) et rapprochement">
      <label class="btn-primary">
        <Upload class="size-4" /> Importer un relevé
        <input ref="fileInput" type="file" accept=".pdf,.xml,application/pdf,text/xml,application/xml" class="sr-only" :disabled="busy" @change="importFile" />
      </label>
    </PageHeader>

    <div v-if="summary" class="mb-6 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100">
      <p class="font-semibold">Import {{ summary.format === 'PDF' ? 'PDF' : 'camt.053' }} terminé</p>
      <p>
        {{ summary.total }} mouvement(s) lus · {{ summary.created }} nouveau(x) · {{ summary.enriched }} complété(s) ·
        rapprochés automatiquement : {{ summary.autoMatched.payments }} paiement(s), {{ summary.autoMatched.expenses }} dépense(s),
        {{ summary.autoMatched.withdrawals }} prélèvement(s)
      </p>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        v-for="opt in [{ v: 'PENDING', l: 'À traiter' }, { v: 'MATCHED', l: 'Traités' }, { v: 'IGNORED', l: 'Ignorés' }] as const"
        :key="opt.v"
        class="btn-sm"
        :class="status === opt.v ? 'btn-primary' : 'btn-secondary'"
        @click="status = opt.v"
      >
        {{ opt.l }}
      </button>
      <select v-model="direction" class="input ml-auto w-auto" aria-label="Sens">
        <option value="">Crédits et débits</option>
        <option value="CREDIT">Crédits</option>
        <option value="DEBIT">Débits</option>
      </select>
    </div>

    <div class="space-y-3" :class="{ 'opacity-60': pending }">
      <EmptyState v-if="data && data.items.length === 0" :text="status === 'PENDING' ? 'Rien à traiter 🎉' : 'Aucun mouvement'" />
      <div v-for="t in data?.items ?? []" :key="t.id" class="card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="t.direction === 'CREDIT' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'">
              <ArrowDownLeft v-if="t.direction === 'CREDIT'" class="size-4" />
              <ArrowUpRight v-else class="size-4" />
            </div>
            <div class="min-w-0">
              <p class="font-medium">{{ t.counterparty ?? 'Contrepartie inconnue' }}</p>
              <p class="text-xs text-muted">
                {{ formatDateCh(t.bookingDate) }}
                <span v-if="t.qrReference"> · réf. {{ formatQrReference(t.qrReference) }}</span>
              </p>
              <p v-if="t.description" class="mt-1 line-clamp-2 text-xs text-muted">{{ t.description }}</p>
            </div>
          </div>
          <p class="text-lg font-semibold whitespace-nowrap" :class="t.direction === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'">
            {{ t.direction === 'CREDIT' ? '+' : '−' }}{{ formatChf(t.amountCents) }}
          </p>
        </div>

        <!-- Mouvement traité -->
        <div v-if="t.status !== 'PENDING'" class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
          <p>
            <span class="text-muted">{{ t.status === 'IGNORED' ? 'Ignoré' : kindLabels[t.kind] }}</span>
            <template v-if="t.invoice">
              · <NuxtLink :to="`/invoices/${t.invoice.invoiceId}`" class="link">facture {{ t.invoice.number }}</NuxtLink> ({{ t.invoice.clientName }})
            </template>
            <template v-if="t.expense"> · <NuxtLink to="/expenses" class="link">{{ t.expense.label }}</NuxtLink></template>
            <template v-if="t.partner"> · {{ t.partner.firstname }}</template>
            <template v-if="t.note"> · {{ t.note }}</template>
          </p>
          <button class="btn-ghost btn-sm" :disabled="busy" @click="reset(t)"><RotateCcw class="size-4" /> Annuler le rapprochement</button>
        </div>

        <!-- Mouvement à traiter -->
        <div v-else class="mt-3 space-y-3 border-t border-line pt-3">
          <template v-if="t.direction === 'CREDIT'">
            <div v-if="t.suggestions && t.suggestions.invoices.length > 0" class="space-y-2">
              <p class="text-xs text-muted">Factures correspondantes</p>
              <div v-for="inv in t.suggestions.invoices" :key="inv.id" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card-2 px-3 py-2 text-sm">
                <span>
                  <NuxtLink :to="`/invoices/${inv.id}`" class="link">{{ inv.number }}</NuxtLink> · {{ inv.clientName }} — {{ inv.title }}
                  <span class="text-muted">(reste {{ formatChf(inv.totalCents - inv.paidCents) }})</span>
                </span>
                <button class="btn-primary btn-sm" :disabled="busy" @click="act(t, 'match-invoice', { invoiceId: inv.id }, 'Paiement rapproché')">
                  <Link2 class="size-4" /> Rapprocher
                </button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select v-model="manualInvoice[t.id]" class="input w-auto max-w-full" aria-label="Choisir une facture">
                <option :value="undefined">Autre facture ouverte…</option>
                <option v-for="inv in openInvoices?.items ?? []" :key="inv.id" :value="String(inv.id)">
                  {{ inv.number }} · {{ inv.clientName }} · reste {{ formatChf(inv.totalCents - inv.paidCents) }}
                </option>
              </select>
              <button
                class="btn-secondary btn-sm"
                :disabled="busy || !manualInvoice[t.id]"
                @click="act(t, 'match-invoice', { invoiceId: Number(manualInvoice[t.id]) }, 'Paiement rapproché')"
              >
                <Link2 class="size-4" /> Rapprocher
              </button>
            </div>
          </template>

          <template v-else>
            <div v-if="t.suggestions && t.suggestions.expenses.length > 0" class="space-y-2">
              <p class="text-xs text-muted">Dépenses du même montant</p>
              <div v-for="e in t.suggestions.expenses" :key="e.id" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card-2 px-3 py-2 text-sm">
                <span>{{ e.label }} <span class="text-muted">({{ formatDateCh(e.date) }})</span></span>
                <button class="btn-primary btn-sm" :disabled="busy" @click="act(t, 'link-expense', { expenseId: e.id }, 'Dépense rapprochée')">
                  <Link2 class="size-4" /> Lier
                </button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button class="btn-secondary btn-sm" @click="openExpense(t)"><Plus class="size-4" /> Créer une dépense</button>
              <select v-model="partnerChoice[t.id]" class="input w-auto" aria-label="Associé">
                <option :value="undefined">Associé…</option>
                <option v-for="u in users ?? []" :key="u.id" :value="String(u.id)">{{ u.firstname }} {{ u.lastname }}</option>
              </select>
              <button
                class="btn-secondary btn-sm"
                :disabled="busy || !partnerChoice[t.id]"
                @click="act(t, 'classify', { kind: 'PARTNER_WITHDRAWAL', partnerUserId: Number(partnerChoice[t.id]), note: null }, 'Prélèvement associé enregistré')"
              >
                <UserRound class="size-4" /> Prélèvement associé
              </button>
            </div>
          </template>

          <div class="flex flex-wrap gap-2">
            <button class="btn-ghost btn-sm" :disabled="busy" @click="act(t, 'classify', { kind: 'OTHER', partnerUserId: null, note: null }, 'Classé « autre »')">Autre</button>
            <button class="btn-ghost btn-sm" :disabled="busy" @click="act(t, 'ignore', { note: null }, 'Mouvement ignoré')"><Ban class="size-4" /> Ignorer</button>
          </div>
        </div>
      </div>
      <PaginationBar v-if="data" v-model:page="page" :page-size="data.pageSize" :total="data.total" />
    </div>

    <div class="card mt-8 overflow-x-auto">
      <h2 class="mb-3">Imports</h2>
      <EmptyState v-if="!imports || imports.length === 0" text="Aucun relevé importé" />
      <table v-else>
        <thead>
          <tr><th>Date</th><th>Fichier</th><th>Format</th><th>Période</th><th class="text-right">Mouvements</th><th class="text-right">Nouveaux</th><th>Par</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in imports" :key="row.import.id">
            <td class="whitespace-nowrap">{{ formatDateTimeCh(row.import.createdAt) }}</td>
            <td class="max-w-56 truncate">{{ row.import.fileName }}</td>
            <td>{{ row.import.format === 'PDF' ? 'PDF' : 'camt.053' }}</td>
            <td class="whitespace-nowrap">{{ formatDateCh(row.import.periodFrom) }} – {{ formatDateCh(row.import.periodTo) }}</td>
            <td class="text-right">{{ row.import.transactionCount }}</td>
            <td class="text-right">{{ row.import.newTransactionCount }}</td>
            <td class="text-muted">{{ row.firstname ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="Boolean(expenseFor)" title="Créer une dépense depuis le débit" @close="expenseFor = null">
      <form v-if="expenseFor" class="space-y-4" @submit.prevent="submitExpense">
        <p class="text-sm text-muted">{{ formatDateCh(expenseFor.bookingDate) }} · {{ formatChf(expenseFor.amountCents) }}</p>
        <div>
          <label class="label" for="be-label">Libellé</label>
          <input id="be-label" v-model="expenseForm.label" class="input" required maxlength="255" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="be-cat">Catégorie</label>
            <select id="be-cat" v-model="expenseForm.category" class="input">
              <option v-for="c in expenseCategories" :key="c" :value="c">{{ expenseCategoryLabels[c] }}</option>
            </select>
          </div>
          <div>
            <label class="label" for="be-sup">Fournisseur</label>
            <input id="be-sup" v-model="expenseForm.supplier" class="input" maxlength="100" />
          </div>
        </div>
        <div>
          <label class="label" for="be-client">Client concerné (optionnel)</label>
          <select id="be-client" v-model="expenseForm.clientId" class="input">
            <option value="">— Aucun —</option>
            <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="expenseFor = null">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="busy">Créer</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
