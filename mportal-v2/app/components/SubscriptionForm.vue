<script setup lang="ts">
import { Info, Plus, Trash2 } from 'lucide-vue-next'
import type { ClientListItem, ServiceRow, SubscriptionDetail } from '~/types/api'

const props = defineProps<{ initial?: SubscriptionDetail | null; presetClientId?: number | null }>()
const emit = defineEmits<{ saved: [id: number] }>()

interface LineForm {
  key: number
  id?: number
  serviceId: string
  label: string
  quantity: number
  price: string
  cost: string
  supplier: string
}

let keySeq = 0
const newLine = (): LineForm => ({ key: ++keySeq, serviceId: '', label: '', quantity: 1, price: '', cost: '', supplier: 'Infomaniak' })

const { data: clients } = await useApiFetch<ClientListItem[]>('/api/clients')
const { data: services } = await useApiFetch<ServiceRow[]>('/api/services')

const today = todayIso()
const s = props.initial?.subscription
const form = reactive({
  clientId: s ? String(s.clientId) : props.presetClientId ? String(props.presetClientId) : '',
  name: s?.name ?? '',
  period: (s?.period ?? 'YEARLY') as 'YEARLY' | 'MONTHLY',
  startDate: s?.startDate ?? today,
  nextBillingDate: s?.nextBillingDate ?? today,
  notes: s?.notes ?? '',
})
const lines = ref<LineForm[]>(
  props.initial
    ? props.initial.lines.map((l) => ({
        key: ++keySeq,
        id: l.id,
        serviceId: String(l.serviceId),
        label: l.label ?? '',
        quantity: l.quantity,
        price: centsToInput(l.unitPriceCents),
        cost: centsToInput(l.unitCostCents),
        supplier: l.supplier ?? '',
      }))
    : [newLine()],
)

const recurringServices = computed(() => (services.value ?? []).filter((sv) => sv.kind === 'RECURRING' || lines.value.some((l) => l.serviceId === String(sv.id))))

function onServiceChange(line: LineForm) {
  const service = services.value?.find((sv) => String(sv.id) === line.serviceId)
  if (!service) return
  if (!line.price && service.defaultPriceCents !== null) line.price = centsToInput(service.defaultPriceCents)
  if (!line.cost && service.defaultCostCents !== null) line.cost = centsToInput(service.defaultCostCents)
}

const periodTotal = computed(() =>
  lines.value.reduce((sum, l) => {
    const p = inputToCents(l.price)
    return p !== null && !Number.isNaN(p) ? sum + Math.round(l.quantity * p) : sum
  }, 0),
)
const periodCost = computed(() =>
  lines.value.reduce((sum, l) => {
    const c = inputToCents(l.cost)
    return c !== null && !Number.isNaN(c) ? sum + Math.round(l.quantity * c) : sum
  }, 0),
)

const { pending, run } = useAction()
const toast = useToast()

async function submit() {
  const payloadLines = []
  for (const [index, l] of lines.value.entries()) {
    const price = inputToCents(l.price)
    const cost = inputToCents(l.cost)
    if (!l.serviceId) return toast.error(`Ligne ${index + 1} : service requis`)
    if (price === null || Number.isNaN(price)) return toast.error(`Ligne ${index + 1} : prix invalide`)
    if (cost !== null && Number.isNaN(cost)) return toast.error(`Ligne ${index + 1} : coût invalide`)
    payloadLines.push({
      ...(l.id !== undefined ? { id: l.id } : {}),
      serviceId: Number(l.serviceId),
      label: l.label || null,
      quantity: Number(l.quantity),
      unitPriceCents: price,
      unitCostCents: cost,
      supplier: l.supplier || null,
    })
  }
  const body = {
    clientId: Number(form.clientId),
    name: form.name,
    period: form.period,
    startDate: form.startDate,
    nextBillingDate: form.nextBillingDate,
    notes: form.notes || null,
    lines: payloadLines,
  }
  const result = props.initial
    ? await run<{ id: number }>('PUT', `/api/subscriptions/${props.initial.subscription.id}`, body, 'Abonnement enregistré')
    : await run<{ id: number }>('POST', '/api/subscriptions', body, 'Abonnement créé')
  if (result) emit('saved', result.id)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <p v-if="initial" class="flex items-start gap-2 rounded-lg border border-sky-900 bg-sky-950/50 px-4 py-3 text-sm text-sky-100">
      <Info class="mt-0.5 size-4 shrink-0" />
      Les modifications (lignes, quantités, prix) s’appliquent au prochain renouvellement. Les factures déjà générées ne changent pas, et il n’y a pas de prorata.
    </p>

    <div class="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="sm:col-span-2">
        <label class="label" for="sub-client">Client *</label>
        <select id="sub-client" v-model="form.clientId" class="input" required :disabled="Boolean(initial)">
          <option value="" disabled>Choisir un client</option>
          <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="sub-name">Nom *</label>
        <input id="sub-name" v-model="form.name" class="input" required maxlength="190" placeholder="ex. Hébergement & domaine" />
      </div>
      <div>
        <label class="label" for="sub-period">Périodicité</label>
        <select id="sub-period" v-model="form.period" class="input">
          <option value="YEARLY">Annuel</option>
          <option value="MONTHLY">Mensuel</option>
        </select>
      </div>
      <div>
        <label class="label" for="sub-start">Début</label>
        <input id="sub-start" v-model="form.startDate" class="input" type="date" required />
      </div>
      <div>
        <label class="label" for="sub-next">Prochaine facturation</label>
        <input id="sub-next" v-model="form.nextBillingDate" class="input" type="date" required />
      </div>
      <div class="sm:col-span-2 lg:col-span-4">
        <label class="label" for="sub-notes">Notes</label>
        <textarea id="sub-notes" v-model="form.notes" class="input" rows="2" maxlength="2000" />
      </div>
    </div>

    <div class="card">
      <h2 class="mb-4">Lignes facturées ensemble</h2>
      <div class="space-y-3">
        <div class="hidden grid-cols-12 gap-2 text-xs text-muted lg:grid">
          <span class="col-span-3">Service *</span>
          <span class="col-span-3">Libellé (ex. nom de domaine)</span>
          <span class="col-span-1">Qté</span>
          <span class="col-span-2">Prix client CHF</span>
          <span class="col-span-1">Coût CHF</span>
          <span class="col-span-2">Fournisseur</span>
        </div>
        <div v-for="(line, index) in lines" :key="line.key" class="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 lg:grid-cols-12 lg:border-0 lg:p-0">
          <select v-model="line.serviceId" class="input col-span-2 lg:col-span-3" required :aria-label="`Service ligne ${index + 1}`" @change="onServiceChange(line)">
            <option value="" disabled>Service</option>
            <option v-for="sv in recurringServices" :key="sv.id" :value="String(sv.id)">{{ sv.name }}</option>
          </select>
          <input v-model="line.label" class="input col-span-2 lg:col-span-3" maxlength="190" placeholder="ex. hdnl.ch" :aria-label="`Libellé ligne ${index + 1}`" />
          <input v-model.number="line.quantity" class="input lg:col-span-1" type="number" min="0.01" step="0.01" required :aria-label="`Quantité ligne ${index + 1}`" />
          <input v-model="line.price" class="input lg:col-span-2" inputmode="decimal" required placeholder="0.00" :aria-label="`Prix ligne ${index + 1}`" />
          <input v-model="line.cost" class="input lg:col-span-1" inputmode="decimal" placeholder="coût" :aria-label="`Coût ligne ${index + 1}`" />
          <div class="flex items-center gap-2 lg:col-span-2">
            <input v-model="line.supplier" class="input" maxlength="100" placeholder="Fournisseur" :aria-label="`Fournisseur ligne ${index + 1}`" />
            <button v-if="lines.length > 1" type="button" class="btn-ghost btn-sm" :aria-label="`Retirer la ligne ${index + 1}`" @click="lines.splice(index, 1)">
              <Trash2 class="size-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>
      <button type="button" class="btn-secondary btn-sm mt-3" @click="lines.push(newLine())"><Plus class="size-4" /> Ajouter une ligne</button>
      <div class="mt-5 flex flex-col items-end gap-1 border-t border-line pt-4 text-sm">
        <p class="text-lg font-semibold">{{ formatChf(periodTotal) }} / {{ form.period === 'YEARLY' ? 'an' : 'mois' }}</p>
        <p class="text-muted">Coûts {{ formatChf(periodCost) }} · marge {{ formatChf(periodTotal - periodCost) }}</p>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <NuxtLink :to="initial ? `/subscriptions/${initial.subscription.id}` : '/subscriptions'" class="btn-secondary">Annuler</NuxtLink>
      <button type="submit" class="btn-primary" :disabled="pending">{{ initial ? 'Enregistrer' : 'Créer l’abonnement' }}</button>
    </div>
  </form>
</template>
