<script setup lang="ts">
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-vue-next'
import type { ServiceRow } from '~/types/api'

useHead({ title: 'Services – MPortal' })

const showArchived = ref(false)
const { data, refresh } = await useApiFetch<ServiceRow[]>('/api/services', { query: () => ({ all: showArchived.value ? '1' : undefined }) })

const modalOpen = ref(false)
const editing = ref<ServiceRow | null>(null)
const form = reactive({ name: '', description: '', kind: 'RECURRING' as 'ONE_SHOT' | 'RECURRING', price: '', cost: '', isMaintenance: false })

function open(service: ServiceRow | null) {
  editing.value = service
  Object.assign(form, {
    name: service?.name ?? '',
    description: service?.description ?? '',
    kind: service?.kind ?? 'RECURRING',
    price: centsToInput(service?.defaultPriceCents),
    cost: centsToInput(service?.defaultCostCents),
    isMaintenance: service?.isMaintenance ?? false,
  })
  modalOpen.value = true
}

const { pending, run } = useAction()
const toast = useToast()

async function submit() {
  const price = inputToCents(form.price)
  const cost = inputToCents(form.cost)
  if ((price !== null && Number.isNaN(price)) || (cost !== null && Number.isNaN(cost))) return toast.error('Montant invalide')
  const body = { name: form.name, description: form.description || null, kind: form.kind, defaultPriceCents: price, defaultCostCents: cost, isMaintenance: form.isMaintenance }
  const ok = editing.value ? await run('PUT', `/api/services/${editing.value.id}`, body, 'Service enregistré') : await run('POST', '/api/services', body, 'Service créé')
  if (ok !== null) {
    modalOpen.value = false
    await refresh()
  }
}

async function toggleArchive(service: ServiceRow) {
  const archived = !service.archivedAt
  const ok = await run('POST', `/api/services/${service.id}/archive`, { archived }, archived ? 'Service archivé' : 'Service réactivé')
  if (ok !== null) await refresh()
}
</script>

<template>
  <div>
    <PageHeader title="Services" subtitle="Catalogue : les prix réels sont négociés par client dans les factures et abonnements">
      <button class="btn-primary" @click="open(null)"><Plus class="size-4" /> Nouveau service</button>
    </PageHeader>

    <label class="mb-4 flex items-center gap-2 text-sm text-muted">
      <input v-model="showArchived" type="checkbox" class="size-4 accent-white" />
      Afficher les services archivés
    </label>

    <div class="card overflow-x-auto">
      <EmptyState v-if="data && data.length === 0" text="Aucun service" />
      <table v-else>
        <thead>
          <tr><th>Service</th><th>Type</th><th class="text-right">Prix par défaut</th><th class="text-right">Coût par défaut</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="s in data ?? []" :key="s.id" :class="{ 'opacity-50': s.archivedAt }">
            <td>
              <p class="font-medium">
                {{ s.name }}
                <span v-if="s.isMaintenance" class="ml-1 rounded-full bg-sky-950 px-2 py-0.5 text-xs text-sky-300">maintenance</span>
              </p>
              <p v-if="s.description" class="text-xs text-muted">{{ s.description }}</p>
            </td>
            <td>{{ s.kind === 'RECURRING' ? 'Récurrent' : 'Ponctuel' }}</td>
            <td class="text-right whitespace-nowrap">{{ s.defaultPriceCents !== null ? formatChf(s.defaultPriceCents) : '—' }}</td>
            <td class="text-right whitespace-nowrap text-muted">{{ s.defaultCostCents !== null ? formatChf(s.defaultCostCents) : '—' }}</td>
            <td class="text-right whitespace-nowrap">
              <button class="btn-ghost btn-sm" aria-label="Modifier" @click="open(s)"><Pencil class="size-4" /></button>
              <button class="btn-ghost btn-sm" :aria-label="s.archivedAt ? 'Réactiver' : 'Archiver'" :disabled="pending" @click="toggleArchive(s)">
                <component :is="s.archivedAt ? ArchiveRestore : Archive" class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="modalOpen" :title="editing ? 'Modifier le service' : 'Nouveau service'" @close="modalOpen = false">
      <form class="grid grid-cols-2 gap-4" @submit.prevent="submit">
        <div class="col-span-2">
          <label class="label" for="sv-name">Nom *</label>
          <input id="sv-name" v-model="form.name" class="input" required maxlength="190" />
        </div>
        <div class="col-span-2">
          <label class="label" for="sv-desc">Description</label>
          <textarea id="sv-desc" v-model="form.description" class="input" rows="2" maxlength="2000" />
        </div>
        <div>
          <label class="label" for="sv-kind">Type</label>
          <select id="sv-kind" v-model="form.kind" class="input">
            <option value="RECURRING">Récurrent (abonnement)</option>
            <option value="ONE_SHOT">Ponctuel</option>
          </select>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-2 pb-2 text-sm">
            <input v-model="form.isMaintenance" type="checkbox" class="size-4 accent-white" />
            Contrat de maintenance (heures)
          </label>
        </div>
        <div>
          <label class="label" for="sv-price">Prix par défaut CHF</label>
          <input id="sv-price" v-model="form.price" class="input" inputmode="decimal" />
        </div>
        <div>
          <label class="label" for="sv-cost">Coût fournisseur par défaut CHF</label>
          <input id="sv-cost" v-model="form.cost" class="input" inputmode="decimal" />
        </div>
        <div class="col-span-2 flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="modalOpen = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
