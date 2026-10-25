<script setup lang="ts">
import type { ClientListItem, ContractDetail, SubscriptionListItem } from '~/types/api'

const props = defineProps<{ open: boolean; contract?: ContractDetail['contract'] | null }>()
const emit = defineEmits<{ close: []; saved: [id: number] }>()

const { data: clients } = await useApiFetch<ClientListItem[]>('/api/clients')
const form = reactive({ clientId: '', name: '', hours: 10, startDate: todayIso(), subscriptionLineId: '', notes: '' })

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const c = props.contract
    Object.assign(form, {
      clientId: c ? String(c.clientId) : '',
      name: c?.name ?? '',
      hours: c?.hoursPerPeriod ?? 10,
      startDate: c?.startDate ?? todayIso(),
      subscriptionLineId: c?.subscriptionLineId ? String(c.subscriptionLineId) : '',
      notes: c?.notes ?? '',
    })
  },
  { immediate: true },
)

const { data: subscriptions } = await useApiFetch<SubscriptionListItem[]>('/api/subscriptions', {
  query: () => ({ clientId: form.clientId || undefined, status: 'ACTIVE' }),
})
const lineOptions = computed(() =>
  form.clientId
    ? (subscriptions.value ?? []).flatMap((s) =>
        s.lines.map((l) => ({ id: l.id, label: `${s.name} — ${l.serviceName}${l.label ? ` (${l.label})` : ''}` })),
      )
    : [],
)

const { pending, run } = useAction()
async function submit() {
  const body = {
    clientId: Number(form.clientId),
    name: form.name,
    hoursPerPeriod: Number(form.hours),
    startDate: form.startDate,
    subscriptionLineId: form.subscriptionLineId ? Number(form.subscriptionLineId) : null,
    notes: form.notes || null,
  }
  const result = props.contract
    ? await run<{ id: number }>('PUT', `/api/contracts/${props.contract.id}`, body, 'Contrat enregistré')
    : await run<{ id: number }>('POST', '/api/contracts', body, 'Contrat créé')
  if (result) emit('saved', result.id)
}
</script>

<template>
  <BaseModal :open="open" :title="contract ? 'Modifier le contrat' : 'Nouveau contrat de maintenance'" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="ct-client">Client *</label>
        <select id="ct-client" v-model="form.clientId" class="input" required :disabled="Boolean(contract)">
          <option value="" disabled>Choisir un client</option>
          <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ct-name">Nom *</label>
        <input id="ct-name" v-model="form.name" class="input" required maxlength="190" placeholder="ex. Contrat de maintenance – Campo SA" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="ct-hours">Heures par période *</label>
          <input id="ct-hours" v-model.number="form.hours" class="input" type="number" min="0.25" step="0.25" required />
        </div>
        <div>
          <label class="label" for="ct-start">Début *</label>
          <input id="ct-start" v-model="form.startDate" class="input" type="date" required :disabled="Boolean(contract)" />
        </div>
      </div>
      <div>
        <label class="label" for="ct-line">Ligne d’abonnement liée (renouvellement automatique des heures)</label>
        <select id="ct-line" v-model="form.subscriptionLineId" class="input">
          <option value="">— Aucune —</option>
          <option v-for="l in lineOptions" :key="l.id" :value="String(l.id)">{{ l.label }}</option>
        </select>
        <p class="mt-1 text-xs text-muted">Si liée, une nouvelle période d’heures est créée à chaque facture de l’abonnement.</p>
      </div>
      <div>
        <label class="label" for="ct-notes">Notes</label>
        <textarea id="ct-notes" v-model="form.notes" class="input" rows="2" maxlength="2000" />
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="emit('close')">Annuler</button>
        <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
      </div>
    </form>
  </BaseModal>
</template>
