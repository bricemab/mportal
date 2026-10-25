<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next'
import type { ClientListItem, ClientRow } from '~/types/api'

useHead({ title: 'Clients – MPortal' })

const search = ref('')
const q = ref('')
const archived = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = v), 300)
})

const { data, pending } = await useApiFetch<ClientListItem[]>('/api/clients', {
  query: () => ({ q: q.value || undefined, archived: archived.value ? '1' : undefined }),
})

const modalOpen = ref(false)
async function onSaved(client: ClientRow) {
  modalOpen.value = false
  await navigateTo(`/clients/${client.id}`)
}
</script>

<template>
  <div>
    <PageHeader title="Clients" :subtitle="data ? `${data.length} client(s)` : ''">
      <button class="btn-primary" @click="modalOpen = true"><Plus class="size-4" /> Nouveau client</button>
    </PageHeader>

    <div class="card mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-60 flex-1">
        <Search class="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
        <input v-model="search" class="input pl-9" placeholder="Nom, contact, email, localité…" aria-label="Rechercher" />
      </div>
      <label class="flex items-center gap-2 text-sm text-muted">
        <input v-model="archived" type="checkbox" class="size-4 accent-white" />
        Afficher les archivés
      </label>
    </div>

    <div class="card overflow-x-auto" :class="{ 'opacity-60': pending }">
      <EmptyState v-if="data && data.length === 0" text="Aucun client" />
      <table v-else>
        <thead>
          <tr>
            <th>Client</th>
            <th>Contact</th>
            <th>Localité</th>
            <th class="text-right">Factures</th>
            <th class="text-right">Facturé</th>
            <th class="text-right">Solde ouvert</th>
            <th class="text-right">Abonnements</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="client in data ?? []" :key="client.id" class="cursor-pointer hover:bg-card-2" @click="navigateTo(`/clients/${client.id}`)">
            <td class="font-medium">
              <NuxtLink :to="`/clients/${client.id}`" class="hover:underline" @click.stop>{{ client.name }}</NuxtLink>
            </td>
            <td class="text-muted">{{ [client.firstname, client.lastname].filter(Boolean).join(' ') || '—' }}</td>
            <td class="text-muted">{{ client.city ?? '—' }}</td>
            <td class="text-right">{{ client.invoiceCount }}</td>
            <td class="text-right whitespace-nowrap">{{ formatChf(client.invoicedCents) }}</td>
            <td class="text-right whitespace-nowrap" :class="client.openCents > 0 ? 'text-amber-300' : 'text-muted'">{{ formatChf(client.openCents) }}</td>
            <td class="text-right">{{ client.activeSubscriptions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ClientFormModal :open="modalOpen" @close="modalOpen = false" @saved="onSaved" />
  </div>
</template>
