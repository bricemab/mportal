<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next'
import type { ClientListItem, InvoiceList } from '~/types/api'

useHead({ title: 'Factures – MPortal' })

const route = useRoute()
const router = useRouter()

const statusOptions = [
  { value: '', label: 'Toutes (hors annulées)' },
  { value: 'OPEN', label: 'À encaisser' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'ISSUED', label: 'Émises' },
  { value: 'SENT', label: 'Envoyées' },
  { value: 'OVERDUE', label: 'En retard' },
  { value: 'PARTIALLY_PAID', label: 'Partiellement payées' },
  { value: 'PAID', label: 'Payées' },
  { value: 'WRITTEN_OFF', label: 'Soldées' },
  { value: 'CANCELLED', label: 'Annulées' },
]

const queryString = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')

const filters = reactive({
  q: queryString('q'),
  status: queryString('status'),
  clientId: queryString('clientId'),
  year: queryString('year'),
  sort: queryString('sort') || 'number_desc',
  page: Number(queryString('page')) || 1,
})
const search = ref(filters.q)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.q = value
    filters.page = 1
  }, 300)
})
watch(
  () => [filters.status, filters.clientId, filters.year, filters.sort],
  () => {
    filters.page = 1
  },
)
watch(
  filters,
  () => {
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters)) if (v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'number_desc')) query[k] = String(v)
    router.replace({ query })
  },
  { deep: true },
)

const query = computed(() => ({
  q: filters.q || undefined,
  status: filters.status || undefined,
  clientId: filters.clientId || undefined,
  year: filters.year || undefined,
  sort: filters.sort,
  page: filters.page,
  pageSize: 25,
}))

const { data, pending } = await useApiFetch<InvoiceList>('/api/invoices', { query })
const { data: clients } = await useApiFetch<ClientListItem[]>('/api/clients')

const currentYear = Number(todayIso().slice(0, 4))
const years = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i)
</script>

<template>
  <div>
    <PageHeader title="Factures" :subtitle="data ? `${data.total} facture(s) · ${formatChf(data.totalCents)} · payé ${formatChf(data.paidCents)}` : ''">
      <NuxtLink to="/invoices/new" class="btn-primary"><Plus class="size-4" /> Nouvelle facture</NuxtLink>
    </PageHeader>

    <div class="card mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div class="relative lg:col-span-2">
        <Search class="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
        <input v-model="search" class="input pl-9" placeholder="N°, titre, client, référence…" aria-label="Rechercher" />
      </div>
      <select v-model="filters.status" class="input" aria-label="Statut">
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select v-model="filters.clientId" class="input" aria-label="Client">
        <option value="">Tous les clients</option>
        <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
      </select>
      <div class="flex gap-2 lg:col-span-2">
        <select v-model="filters.year" class="input" aria-label="Année">
          <option value="">Toutes années</option>
          <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
        </select>
        <select v-model="filters.sort" class="input" aria-label="Tri">
          <option value="number_desc">N° ↓</option>
          <option value="number_asc">N° ↑</option>
          <option value="amount_desc">Montant ↓</option>
          <option value="amount_asc">Montant ↑</option>
          <option value="due_asc">Échéance</option>
        </select>
      </div>
    </div>

    <div class="card overflow-x-auto" :class="{ 'opacity-60': pending }">
      <EmptyState v-if="data && data.items.length === 0" text="Aucune facture pour ces critères" />
      <table v-else>
        <thead>
          <tr>
            <th>N°</th>
            <th>Client</th>
            <th>Titre</th>
            <th>Émise le</th>
            <th>Échéance</th>
            <th class="text-right">Montant</th>
            <th class="text-right">Payé</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invoice in data?.items ?? []" :key="invoice.id" class="cursor-pointer hover:bg-card-2" @click="navigateTo(`/invoices/${invoice.id}`)">
            <td class="whitespace-nowrap">
              <NuxtLink :to="`/invoices/${invoice.id}`" class="hover:underline" @click.stop>{{ invoice.number }}</NuxtLink>
            </td>
            <td class="min-w-44">{{ invoice.clientName }}</td>
            <td class="max-w-80 truncate" :title="invoice.title">{{ invoice.title }}</td>
            <td class="whitespace-nowrap">{{ formatDateCh(invoice.issueDate) }}</td>
            <td class="whitespace-nowrap">{{ formatDateCh(invoice.dueDate) }}</td>
            <td class="text-right whitespace-nowrap">{{ formatChf(invoice.totalCents) }}</td>
            <td class="text-right whitespace-nowrap text-muted">{{ invoice.paidCents ? formatChf(invoice.paidCents) : '—' }}</td>
            <td><StatusBadge :status="invoice.displayStatus" /></td>
          </tr>
        </tbody>
      </table>
      <PaginationBar v-if="data" v-model:page="filters.page" :page-size="data.pageSize" :total="data.total" />
    </div>
  </div>
</template>
