<script setup lang="ts">
import { Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import { expenseCategories, expenseCategoryLabels, type ClientListItem, type ExpenseCategory, type ExpenseItem, type ExpenseList } from '~/types/api'

useHead({ title: 'Dépenses – MPortal' })

const currentYear = Number(todayIso().slice(0, 4))
const years = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i)
const filters = reactive({ year: String(currentYear), category: '' as ExpenseCategory | '', q: '', unmatched: false, page: 1 })
const search = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    filters.q = v
    filters.page = 1
  }, 300)
})
watch(
  () => [filters.year, filters.category, filters.unmatched],
  () => {
    filters.page = 1
  },
)

const { data, pending, refresh } = await useApiFetch<ExpenseList>('/api/expenses', {
  query: () => ({
    year: filters.year || undefined,
    category: filters.category || undefined,
    q: filters.q || undefined,
    unmatched: filters.unmatched ? '1' : undefined,
    page: filters.page,
    pageSize: 25,
  }),
})
const { data: clients } = await useApiFetch<ClientListItem[]>('/api/clients')

// Formulaire
const modalOpen = ref(false)
const editing = ref<ExpenseItem | null>(null)
const form = reactive({ date: todayIso(), amount: '', supplier: '', category: 'OTHER' as ExpenseCategory, label: '', clientId: '', notes: '' })
function open(expense: ExpenseItem | null) {
  editing.value = expense
  Object.assign(form, {
    date: expense?.date ?? todayIso(),
    amount: expense ? centsToInput(expense.amountCents) : '',
    supplier: expense?.supplier ?? '',
    category: expense?.category ?? 'OTHER',
    label: expense?.label ?? '',
    clientId: expense?.clientId ? String(expense.clientId) : '',
    notes: expense?.notes ?? '',
  })
  modalOpen.value = true
}

const { pending: saving, run } = useAction()
const toast = useToast()
async function submit() {
  const cents = inputToCents(form.amount)
  if (cents === null || Number.isNaN(cents) || cents <= 0) return toast.error('Montant invalide')
  const body = {
    date: form.date,
    amountCents: cents,
    supplier: form.supplier || null,
    category: form.category,
    label: form.label,
    clientId: form.clientId ? Number(form.clientId) : null,
    invoiceId: editing.value?.invoiceId ?? null,
    notes: form.notes || null,
  }
  const ok = editing.value
    ? await run('PUT', `/api/expenses/${editing.value.id}`, body, 'Dépense enregistrée')
    : await run('POST', '/api/expenses', body, 'Dépense créée')
  if (ok !== null) {
    modalOpen.value = false
    await refresh()
  }
}
async function remove(expense: ExpenseItem) {
  if (!window.confirm(`Supprimer la dépense « ${expense.label} » ?`)) return
  const ok = await run('DELETE', `/api/expenses/${expense.id}`, undefined, 'Dépense supprimée')
  if (ok !== null) await refresh()
}
</script>

<template>
  <div>
    <PageHeader title="Dépenses" :subtitle="data ? `${data.total} dépense(s) · ${formatChf(data.totalCents)}` : ''">
      <button class="btn-primary" @click="open(null)"><Plus class="size-4" /> Nouvelle dépense</button>
    </PageHeader>

    <div class="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="relative">
        <Search class="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
        <input v-model="search" class="input pl-9" placeholder="Libellé, fournisseur, client…" aria-label="Rechercher" />
      </div>
      <select v-model="filters.year" class="input" aria-label="Année">
        <option value="">Toutes années</option>
        <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
      </select>
      <select v-model="filters.category" class="input" aria-label="Catégorie">
        <option value="">Toutes catégories</option>
        <option v-for="c in expenseCategories" :key="c" :value="c">{{ expenseCategoryLabels[c] }}</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-muted">
        <input v-model="filters.unmatched" type="checkbox" class="size-4 accent-white" />
        Non rapprochées de la banque
      </label>
    </div>

    <div class="card overflow-x-auto" :class="{ 'opacity-60': pending }">
      <EmptyState v-if="data && data.items.length === 0" text="Aucune dépense" />
      <table v-else>
        <thead>
          <tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Fournisseur</th><th>Client / facture</th><th class="text-right">Montant</th><th>Banque</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="e in data?.items ?? []" :key="e.id">
            <td class="whitespace-nowrap">{{ formatDateCh(e.date) }}</td>
            <td>{{ e.label }}</td>
            <td class="text-muted">{{ expenseCategoryLabels[e.category] }}</td>
            <td class="text-muted">{{ e.supplier ?? '—' }}</td>
            <td class="text-sm">
              <NuxtLink v-if="e.clientId" :to="`/clients/${e.clientId}`" class="hover:underline">{{ e.clientName }}</NuxtLink>
              <NuxtLink v-if="e.invoiceId" :to="`/invoices/${e.invoiceId}`" class="ml-1 text-muted hover:underline">#{{ e.invoiceNumber }}</NuxtLink>
              <span v-if="!e.clientId && !e.invoiceId" class="text-muted">—</span>
            </td>
            <td class="text-right whitespace-nowrap">{{ formatChf(e.amountCents) }}</td>
            <td>
              <span v-if="e.bankTransactionId" class="rounded-full bg-emerald-950 px-2 py-0.5 text-xs whitespace-nowrap text-emerald-300">
                rapprochée {{ formatDateCh(e.bankDate) }}
              </span>
              <span v-else class="text-xs text-muted">non rapprochée</span>
            </td>
            <td class="text-right whitespace-nowrap">
              <button class="btn-ghost btn-sm" aria-label="Modifier" @click="open(e)"><Pencil class="size-4" /></button>
              <button class="btn-ghost btn-sm" aria-label="Supprimer" @click="remove(e)"><Trash2 class="size-4 text-red-400" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <PaginationBar v-if="data" v-model:page="filters.page" :page-size="data.pageSize" :total="data.total" />
    </div>

    <BaseModal :open="modalOpen" :title="editing ? 'Modifier la dépense' : 'Nouvelle dépense'" @close="modalOpen = false">
      <form class="grid grid-cols-2 gap-4" @submit.prevent="submit">
        <div>
          <label class="label" for="ex-date">Date</label>
          <input id="ex-date" v-model="form.date" class="input" type="date" required />
        </div>
        <div>
          <label class="label" for="ex-amount">Montant CHF</label>
          <input id="ex-amount" v-model="form.amount" class="input" inputmode="decimal" required :disabled="Boolean(editing?.bankTransactionId)" />
        </div>
        <div class="col-span-2">
          <label class="label" for="ex-label">Libellé</label>
          <input id="ex-label" v-model="form.label" class="input" required maxlength="255" />
        </div>
        <div>
          <label class="label" for="ex-cat">Catégorie</label>
          <select id="ex-cat" v-model="form.category" class="input">
            <option v-for="c in expenseCategories" :key="c" :value="c">{{ expenseCategoryLabels[c] }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="ex-supplier">Fournisseur</label>
          <input id="ex-supplier" v-model="form.supplier" class="input" maxlength="100" />
        </div>
        <div class="col-span-2">
          <label class="label" for="ex-client">Client concerné (optionnel)</label>
          <select id="ex-client" v-model="form.clientId" class="input">
            <option value="">— Aucun —</option>
            <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
        </div>
        <div class="col-span-2">
          <label class="label" for="ex-notes">Notes</label>
          <textarea id="ex-notes" v-model="form.notes" class="input" rows="2" maxlength="2000" />
        </div>
        <p v-if="editing?.bankTransactionId" class="col-span-2 text-xs text-muted">Montant verrouillé : cette dépense est rapprochée d’un débit bancaire.</p>
        <div class="col-span-2 flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="modalOpen = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="saving">Enregistrer</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
