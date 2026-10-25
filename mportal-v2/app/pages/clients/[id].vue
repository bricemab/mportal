<script setup lang="ts">
import { Archive, ArchiveRestore, FilePlus2, Pencil, RefreshCw } from 'lucide-vue-next'
import type { ClientDetail } from '~/types/api'

const route = useRoute()
const id = Number(route.params.id)
const { data, refresh } = await useApiFetch<ClientDetail>(`/api/clients/${id}`)
useHead({ title: () => `${data.value?.client.name ?? 'Client'} – MPortal` })

const editOpen = ref(false)
const { pending, run } = useAction()

async function toggleArchive() {
  if (!data.value) return
  const archived = !data.value.client.archivedAt
  if (archived && !window.confirm('Archiver ce client ? Il n’apparaîtra plus dans les listes.')) return
  const ok = await run('POST', `/api/clients/${id}/archive`, { archived }, archived ? 'Client archivé' : 'Client réactivé')
  if (ok !== null) await refresh()
}

async function onSaved() {
  editOpen.value = false
  await refresh()
}

const totals = computed(() => {
  const invoices = data.value?.invoices ?? []
  const active = invoices.filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
  return {
    invoiced: active.reduce((s, i) => s + (i.status === 'WRITTEN_OFF' ? i.paidCents : i.totalCents), 0),
    open: invoices.filter((i) => i.status === 'ISSUED' || i.status === 'SENT').reduce((s, i) => s + remainingCents(i), 0),
  }
})
</script>

<template>
  <div v-if="data">
    <PageHeader :title="data.client.name" :subtitle="data.client.archivedAt ? 'Client archivé' : undefined" back="/clients">
      <button class="btn-secondary" @click="editOpen = true"><Pencil class="size-4" /> Modifier</button>
      <NuxtLink :to="`/invoices/new?clientId=${id}`" class="btn-secondary"><FilePlus2 class="size-4" /> Facture</NuxtLink>
      <NuxtLink :to="`/subscriptions/new?clientId=${id}`" class="btn-secondary"><RefreshCw class="size-4" /> Abonnement</NuxtLink>
      <button class="btn-ghost" :disabled="pending" @click="toggleArchive">
        <component :is="data.client.archivedAt ? ArchiveRestore : Archive" class="size-4" />
        {{ data.client.archivedAt ? 'Réactiver' : 'Archiver' }}
      </button>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="card space-y-2 text-sm">
        <h2 class="mb-2">Coordonnées</h2>
        <p v-if="data.client.firstname || data.client.lastname">{{ [data.client.firstname, data.client.lastname].filter(Boolean).join(' ') }}</p>
        <p v-if="data.client.street">{{ data.client.street }} {{ data.client.streetNumber }}</p>
        <p v-if="data.client.postalCode || data.client.city">{{ data.client.postalCode }} {{ data.client.city }} ({{ data.client.country }})</p>
        <p v-if="data.client.email"><a :href="`mailto:${data.client.email}`" class="link">{{ data.client.email }}</a></p>
        <p v-if="data.client.phone">{{ data.client.phone }}</p>
        <p v-if="data.client.remark" class="border-t border-line pt-2 whitespace-pre-line text-muted">{{ data.client.remark }}</p>
        <div class="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <p class="text-xs text-muted">Total facturé</p>
            <p class="font-semibold">{{ formatChf(totals.invoiced) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">Solde ouvert</p>
            <p class="font-semibold" :class="totals.open > 0 ? 'text-amber-300' : ''">{{ formatChf(totals.open) }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-6 lg:col-span-2">
        <div class="card">
          <h2 class="mb-3">Abonnements</h2>
          <EmptyState v-if="data.subscriptions.length === 0" text="Aucun abonnement" />
          <ul v-else class="divide-y divide-line">
            <li v-for="s in data.subscriptions" :key="s.id">
              <NuxtLink :to="`/subscriptions/${s.id}`" class="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-neutral-300">
                <span class="font-medium">{{ s.name }}</span>
                <span class="text-muted">
                  {{ s.status === 'ACTIVE' ? `prochaine facture ${formatDateCh(s.nextBillingDate)}` : `terminé ${formatDateCh(s.endDate)}` }}
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div v-if="data.contracts.length > 0" class="card">
          <h2 class="mb-3">Contrats de maintenance</h2>
          <ul class="divide-y divide-line">
            <li v-for="c in data.contracts" :key="c.id">
              <NuxtLink :to="`/contracts/${c.id}`" class="flex items-center justify-between py-2.5 text-sm hover:text-neutral-300">
                <span class="font-medium">{{ c.name }}</span>
                <span class="text-muted">{{ c.status === 'ACTIVE' ? 'actif' : 'terminé' }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="card overflow-x-auto">
          <h2 class="mb-3">Factures</h2>
          <EmptyState v-if="data.invoices.length === 0" text="Aucune facture" />
          <table v-else>
            <thead>
              <tr><th>N°</th><th>Titre</th><th>Émise le</th><th class="text-right">Montant</th><th>Statut</th></tr>
            </thead>
            <tbody>
              <tr v-for="invoice in data.invoices" :key="invoice.id" class="cursor-pointer hover:bg-card-2" @click="navigateTo(`/invoices/${invoice.id}`)">
                <td class="whitespace-nowrap">{{ invoice.number }}</td>
                <td class="max-w-72 truncate">{{ invoice.title }}</td>
                <td class="whitespace-nowrap">{{ formatDateCh(invoice.issueDate) }}</td>
                <td class="text-right whitespace-nowrap">{{ formatChf(invoice.totalCents) }}</td>
                <td><StatusBadge :status="displayStatus(invoice)" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <ClientFormModal :open="editOpen" :client="data.client" @close="editOpen = false" @saved="onSaved" />
  </div>
</template>
