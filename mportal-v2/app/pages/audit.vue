<script setup lang="ts">
import type { AuditItem } from '~/types/api'

useHead({ title: 'Journal – MPortal' })

const api = useApi()
const toast = useToast()
const items = ref<AuditItem[]>([])
const loading = ref(false)
const done = ref(false)

async function load() {
  loading.value = true
  try {
    const before = items.value.at(-1)?.id
    const page = await api<AuditItem[]>('/api/audit', { query: { limit: 100, before } })
    items.value = [...items.value, ...page]
    if (page.length < 100) done.value = true
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

onMounted(load)

const entityLabels: Record<string, string> = {
  invoice: 'Facture',
  client: 'Client',
  service: 'Service',
  subscription: 'Abonnement',
  contract: 'Contrat',
  expense: 'Dépense',
  bank: 'Import bancaire',
  bank_transaction: 'Mouvement bancaire',
  settings: 'Paramètres',
  user: 'Utilisateur',
}
const entityLinks: Record<string, string> = { invoice: '/invoices', client: '/clients', subscription: '/subscriptions', contract: '/contracts' }

/** MariaDB stocke le JSON en texte : selon le pilote, `changes` arrive déjà sérialisé. */
function changesText(changes: AuditItem['changes'] | string): string {
  if (!changes) return ''
  return typeof changes === 'string' ? changes : JSON.stringify(changes)
}

function summary(changes: AuditItem['changes'] | string): string {
  const text = changesText(changes)
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}
</script>

<template>
  <div>
    <PageHeader title="Journal" subtitle="Toutes les actions effectuées dans l’application" />
    <div class="card overflow-x-auto">
      <EmptyState v-if="items.length === 0 && !loading" text="Journal vide" />
      <table v-else>
        <thead>
          <tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Élément</th><th>Détails</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td class="whitespace-nowrap">{{ formatDateTimeCh(item.createdAt) }}</td>
            <td>{{ item.firstname ?? 'Système' }}</td>
            <td class="font-mono text-xs">{{ item.action }}</td>
            <td class="whitespace-nowrap">
              <NuxtLink v-if="item.entityId && entityLinks[item.entity]" :to="`${entityLinks[item.entity]}/${item.entityId}`" class="link">
                {{ entityLabels[item.entity] ?? item.entity }} #{{ item.entityId }}
              </NuxtLink>
              <span v-else>{{ entityLabels[item.entity] ?? item.entity }}<span v-if="item.entityId"> #{{ item.entityId }}</span></span>
            </td>
            <td class="max-w-md truncate font-mono text-xs text-muted" :title="changesText(item.changes)">{{ summary(item.changes) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!done" class="mt-4 flex justify-center">
        <button class="btn-secondary" :disabled="loading" @click="load">{{ loading ? 'Chargement…' : 'Charger plus' }}</button>
      </div>
    </div>
  </div>
</template>
