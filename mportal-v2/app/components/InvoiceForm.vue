<script setup lang="ts">
import { Plus, Trash2, UserPlus } from 'lucide-vue-next'
import type { ClientListItem, ClientRow, InvoiceDetail, ServiceRow } from '~/types/api'

const props = defineProps<{ initial?: InvoiceDetail | null; presetClientId?: number | null }>()
const emit = defineEmits<{ saved: [id: number] }>()

interface LineForm {
  key: number
  serviceId: string
  label: string
  quantity: number
  price: string
  cost: string
}

let keySeq = 0
const newLine = (): LineForm => ({ key: ++keySeq, serviceId: '', label: '', quantity: 1, price: '', cost: '' })

const { data: clients, refresh: refreshClients } = await useApiFetch<ClientListItem[]>('/api/clients')
const { data: services } = await useApiFetch<ServiceRow[]>('/api/services')

const form = reactive({
  clientId: props.initial ? String(props.initial.invoice.clientId) : props.presetClientId ? String(props.presetClientId) : '',
  title: props.initial?.invoice.title ?? '',
  notes: props.initial?.invoice.notes ?? '',
  createExpenses: false,
  expenseSupplier: 'Infomaniak',
})
const lines = ref<LineForm[]>(
  props.initial
    ? props.initial.lines.map((l) => ({
        key: ++keySeq,
        serviceId: l.serviceId ? String(l.serviceId) : '',
        label: l.label,
        quantity: l.quantity,
        price: centsToInput(l.unitPriceCents),
        cost: centsToInput(l.unitCostCents),
      }))
    : [newLine()],
)

const showClientModal = ref(false)
const { pending, run } = useAction()
const toast = useToast()

function onServiceChange(line: LineForm) {
  const service = services.value?.find((s) => String(s.id) === line.serviceId)
  if (!service) return
  if (!line.label) line.label = service.name
  if (!line.price && service.defaultPriceCents !== null) line.price = centsToInput(service.defaultPriceCents)
  if (!line.cost && service.defaultCostCents !== null) line.cost = centsToInput(service.defaultCostCents)
}

const lineTotals = computed(() =>
  lines.value.map((l) => {
    const price = inputToCents(l.price)
    return price !== null && !Number.isNaN(price) ? Math.round(l.quantity * price) : 0
  }),
)
const total = computed(() => lineTotals.value.reduce((a, b) => a + b, 0))
const totalCost = computed(() =>
  lines.value.reduce((sum, l) => {
    const cost = inputToCents(l.cost)
    return cost !== null && !Number.isNaN(cost) ? sum + Math.round(l.quantity * cost) : sum
  }, 0),
)

async function onClientCreated(client: ClientRow) {
  showClientModal.value = false
  await refreshClients()
  form.clientId = String(client.id)
}

async function submit() {
  const payloadLines = []
  for (const [index, l] of lines.value.entries()) {
    const price = inputToCents(l.price)
    const cost = inputToCents(l.cost)
    if (price === null || Number.isNaN(price)) return toast.error(`Ligne ${index + 1} : prix invalide`)
    if (cost !== null && Number.isNaN(cost)) return toast.error(`Ligne ${index + 1} : coût invalide`)
    if (!(l.quantity > 0)) return toast.error(`Ligne ${index + 1} : quantité invalide`)
    payloadLines.push({
      serviceId: l.serviceId ? Number(l.serviceId) : null,
      label: l.label,
      quantity: Number(l.quantity),
      unitPriceCents: price,
      unitCostCents: cost,
    })
  }
  const body = {
    clientId: Number(form.clientId),
    title: form.title,
    notes: form.notes || null,
    lines: payloadLines,
    createExpenses: !props.initial && form.createExpenses,
    expenseSupplier: form.expenseSupplier || null,
  }
  const result = props.initial
    ? await run<{ id: number }>('PUT', `/api/invoices/${props.initial.invoice.id}`, body, 'Facture enregistrée')
    : await run<{ id: number }>('POST', '/api/invoices', body, 'Facture créée')
  if (result) emit('saved', result.id)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <div class="card grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="inv-client">Client *</label>
        <div class="flex gap-2">
          <select id="inv-client" v-model="form.clientId" class="input" required>
            <option value="" disabled>Choisir un client</option>
            <option v-for="c in clients ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </select>
          <button type="button" class="btn-secondary shrink-0" title="Nouveau client" @click="showClientModal = true">
            <UserPlus class="size-4" />
            <span class="hidden sm:inline">Nouveau</span>
          </button>
        </div>
      </div>
      <div>
        <label class="label" for="inv-title">Titre de la facture *</label>
        <input id="inv-title" v-model="form.title" class="input" required maxlength="255" placeholder="ex. Site web 2026 – hébergement & domaine" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="inv-notes">Notes internes</label>
        <textarea id="inv-notes" v-model="form.notes" class="input" rows="2" maxlength="2000" />
      </div>
    </div>

    <div class="card">
      <h2 class="mb-4">Lignes</h2>
      <div class="space-y-3">
        <div class="hidden grid-cols-12 gap-2 text-xs text-muted md:grid">
          <span class="col-span-3">Service</span>
          <span class="col-span-3">Libellé *</span>
          <span class="col-span-1">Qté *</span>
          <span class="col-span-2">Prix unitaire CHF *</span>
          <span class="col-span-2">Coût unitaire CHF</span>
          <span class="col-span-1 text-right">Total</span>
        </div>
        <div v-for="(line, index) in lines" :key="line.key" class="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 md:grid-cols-12 md:border-0 md:p-0">
          <select v-model="line.serviceId" class="input col-span-2 md:col-span-3" :aria-label="`Service ligne ${index + 1}`" @change="onServiceChange(line)">
            <option value="">— Aucun —</option>
            <option v-for="s in services ?? []" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
          <input v-model="line.label" class="input col-span-2 md:col-span-3" required maxlength="255" placeholder="Libellé" :aria-label="`Libellé ligne ${index + 1}`" />
          <input v-model.number="line.quantity" class="input md:col-span-1" type="number" min="0.01" step="0.01" required :aria-label="`Quantité ligne ${index + 1}`" />
          <input v-model="line.price" class="input md:col-span-2" inputmode="decimal" required placeholder="0.00" :aria-label="`Prix ligne ${index + 1}`" />
          <input v-model="line.cost" class="input md:col-span-2" inputmode="decimal" placeholder="coût" :aria-label="`Coût ligne ${index + 1}`" />
          <div class="flex items-center justify-end gap-2 md:col-span-1">
            <span class="text-sm whitespace-nowrap">{{ formatAmount(lineTotals[index] ?? 0) }}</span>
            <button v-if="lines.length > 1" type="button" class="btn-ghost btn-sm" :aria-label="`Supprimer la ligne ${index + 1}`" @click="lines.splice(index, 1)">
              <Trash2 class="size-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>
      <button type="button" class="btn-secondary btn-sm mt-3" @click="lines.push(newLine())"><Plus class="size-4" /> Ajouter une ligne</button>

      <div class="mt-5 flex flex-col items-end gap-1 border-t border-line pt-4">
        <p class="text-lg font-semibold">Total : {{ formatChf(total) }}</p>
        <p v-if="totalCost > 0" class="text-sm text-muted">Coûts : {{ formatChf(totalCost) }} · marge {{ formatChf(total - totalCost) }}</p>
      </div>
    </div>

    <div v-if="!initial" class="card space-y-3">
      <label class="flex items-start gap-3">
        <input v-model="form.createExpenses" type="checkbox" class="mt-1 size-4 accent-white" />
        <span>
          <span class="font-medium">Créer les dépenses des coûts (charge payée par MDev)</span>
          <span class="block text-sm text-muted">Une dépense est créée pour chaque ligne qui a un coût ; elle sera rapprochée automatiquement du débit bancaire.</span>
        </span>
      </label>
      <div v-if="form.createExpenses" class="max-w-xs">
        <label class="label" for="inv-supplier">Fournisseur</label>
        <input id="inv-supplier" v-model="form.expenseSupplier" class="input" maxlength="100" />
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <NuxtLink :to="initial ? `/invoices/${initial.invoice.id}` : '/invoices'" class="btn-secondary">Annuler</NuxtLink>
      <button type="submit" class="btn-primary" :disabled="pending">{{ initial ? 'Enregistrer' : 'Créer la facture' }}</button>
    </div>

    <ClientFormModal :open="showClientModal" @close="showClientModal = false" @saved="onClientCreated" />
  </form>
</template>
