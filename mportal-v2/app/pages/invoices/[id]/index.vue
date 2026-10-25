<script setup lang="ts">
import { Ban, CheckCheck, Download, FileCheck2, Pencil, RotateCcw, Send, Trash2, Wallet } from 'lucide-vue-next'
import type { InvoiceDetail } from '~/types/api'

const route = useRoute()
const id = Number(route.params.id)
const { data, refresh } = await useApiFetch<InvoiceDetail>(`/api/invoices/${id}`)
useHead({ title: () => `Facture ${data.value?.invoice.number ?? ''} – MPortal` })

const { pending, run } = useAction()
const toast = useToast()

const inv = computed(() => data.value?.invoice)
const remaining = computed(() => (inv.value ? remainingCents(inv.value) : 0))
const isOpen = computed(() => inv.value && ['DRAFT', 'ISSUED', 'SENT'].includes(inv.value.status))
const canPay = computed(() => isOpen.value && remaining.value > 0)
const canWriteOff = computed(() => inv.value && ['ISSUED', 'SENT'].includes(inv.value.status) && remaining.value > 0)
const lineTotal = (q: number, p: number) => Math.round(q * p)

async function action(path: string, message: string, confirmText?: string) {
  if (confirmText && !window.confirm(confirmText)) return
  const ok = await run('POST', `/api/invoices/${id}/${path}`, {}, message)
  if (ok !== null) await refresh()
}

async function remove() {
  if (!window.confirm('Supprimer définitivement ce brouillon ?')) return
  const ok = await run('DELETE', `/api/invoices/${id}`, undefined, 'Brouillon supprimé')
  if (ok !== null) await navigateTo('/invoices')
}

// Paiement
const paymentOpen = ref(false)
const payment = reactive({ amount: '', paidAt: todayIso(), note: '' })
function openPayment() {
  payment.amount = centsToInput(remaining.value)
  payment.paidAt = todayIso()
  payment.note = ''
  paymentOpen.value = true
}
async function submitPayment() {
  const cents = inputToCents(payment.amount)
  if (cents === null || Number.isNaN(cents) || cents <= 0) return toast.error('Montant invalide')
  const ok = await run('POST', `/api/invoices/${id}/payments`, { amountCents: cents, paidAt: payment.paidAt, note: payment.note || null }, 'Paiement enregistré')
  if (ok !== null) {
    paymentOpen.value = false
    await refresh()
  }
}
async function deletePayment(paymentId: number) {
  if (!window.confirm('Supprimer ce paiement ?')) return
  const ok = await run('DELETE', `/api/invoices/${id}/payments/${paymentId}`, undefined, 'Paiement supprimé')
  if (ok !== null) await refresh()
}

// Solde
const writeOffOpen = ref(false)
const writeOffReason = ref('')
async function submitWriteOff() {
  const ok = await run('POST', `/api/invoices/${id}/write-off`, { reason: writeOffReason.value }, 'Facture soldée')
  if (ok !== null) {
    writeOffOpen.value = false
    await refresh()
  }
}
</script>

<template>
  <div v-if="data && inv">
    <PageHeader :title="`Facture ${inv.number}`" :subtitle="`${data.client?.name ?? ''} — ${inv.title}`" back="/invoices">
      <StatusBadge :status="inv.displayStatus" />
    </PageHeader>

    <!-- Actions -->
    <div class="mb-6 flex flex-wrap gap-2">
      <NuxtLink v-if="inv.editable" :to="`/invoices/${id}/edit`" class="btn-secondary"><Pencil class="size-4" /> Modifier</NuxtLink>
      <button v-if="inv.status === 'DRAFT'" class="btn-primary" :disabled="pending" @click="action('issue', 'Facture émise')">
        <FileCheck2 class="size-4" /> Émettre
      </button>
      <a v-if="inv.issueDate" :href="`/api/invoices/${id}/pdf`" class="btn-secondary" download><Download class="size-4" /> PDF</a>
      <button
        v-if="inv.status === 'DRAFT' || inv.status === 'ISSUED'"
        class="btn-secondary"
        :disabled="pending"
        @click="action('send', 'Facture marquée comme envoyée', 'Marquer comme envoyée ? Le PDF sera archivé et la facture ne sera plus modifiable.')"
      >
        <Send class="size-4" /> Marquer envoyée
      </button>
      <button v-if="canPay" class="btn-secondary" @click="openPayment"><Wallet class="size-4" /> Ajouter un paiement</button>
      <button v-if="canWriteOff" class="btn-secondary" @click="writeOffOpen = true"><CheckCheck class="size-4" /> Solder</button>
      <button
        v-if="isOpen && inv.paidCents === 0"
        class="btn-danger"
        :disabled="pending"
        @click="action('cancel', 'Facture annulée', 'Annuler cette facture ? Elle restera visible avec le statut « Annulée ».')"
      >
        <Ban class="size-4" /> Annuler
      </button>
      <button v-if="inv.status === 'CANCELLED' || inv.status === 'WRITTEN_OFF'" class="btn-secondary" :disabled="pending" @click="action('reopen', 'Facture rouverte')">
        <RotateCcw class="size-4" /> Rouvrir
      </button>
      <button v-if="inv.status === 'DRAFT' && inv.paidCents === 0" class="btn-danger" :disabled="pending" @click="remove"><Trash2 class="size-4" /> Supprimer</button>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <div class="card overflow-x-auto">
          <h2 class="mb-3">Lignes</h2>
          <table>
            <thead>
              <tr><th>Libellé</th><th class="text-right">Qté</th><th class="text-right">Prix</th><th class="text-right">Coût</th><th class="text-right">Total</th></tr>
            </thead>
            <tbody>
              <tr v-for="line in data.lines" :key="line.id">
                <td>
                  {{ line.label }}
                  <span v-if="line.serviceName && line.serviceName !== line.label" class="block text-xs text-muted">{{ line.serviceName }}</span>
                </td>
                <td class="text-right">{{ formatQuantity(line.quantity) }}</td>
                <td class="text-right whitespace-nowrap">{{ formatAmount(line.unitPriceCents) }}</td>
                <td class="text-right whitespace-nowrap text-muted">{{ line.unitCostCents !== null ? formatAmount(line.unitCostCents) : '—' }}</td>
                <td class="text-right whitespace-nowrap">{{ formatAmount(lineTotal(line.quantity, line.unitPriceCents)) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right font-semibold">Total</td>
                <td class="text-right font-semibold whitespace-nowrap">{{ formatChf(inv.totalCents) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="card">
          <h2 class="mb-3">Paiements</h2>
          <EmptyState v-if="data.payments.length === 0" text="Aucun paiement" />
          <ul v-else class="divide-y divide-line">
            <li v-for="p in data.payments" :key="p.id" class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p class="font-medium">{{ formatChf(p.amountCents) }} le {{ formatDateCh(p.paidAt) }}</p>
                <p class="text-xs text-muted">{{ p.note ?? '' }}<span v-if="p.bankTransactionId"> · rapproché du relevé bancaire</span></p>
              </div>
              <button v-if="inv.status !== 'CANCELLED' && inv.status !== 'WRITTEN_OFF'" class="btn-ghost btn-sm" aria-label="Supprimer le paiement" @click="deletePayment(p.id)">
                <Trash2 class="size-4 text-red-400" />
              </button>
            </li>
          </ul>
          <div class="mt-3 flex justify-between border-t border-line pt-3 text-sm">
            <span class="text-muted">Payé {{ formatChf(inv.paidCents) }}</span>
            <span class="font-medium">Reste dû {{ formatChf(remaining) }}</span>
          </div>
          <p v-if="inv.status === 'WRITTEN_OFF'" class="mt-2 text-sm text-purple-300">Soldée : {{ inv.writeOffReason }}</p>
        </div>

        <div v-if="data.expenses.length > 0" class="card">
          <h2 class="mb-3">Dépenses liées</h2>
          <ul class="divide-y divide-line text-sm">
            <li v-for="e in data.expenses" :key="e.id" class="flex justify-between gap-3 py-2">
              <span>{{ e.label }} <span class="text-xs text-muted">({{ formatDateCh(e.date) }})</span></span>
              <span class="flex items-center gap-2 whitespace-nowrap">
                <span v-if="e.bankTransactionId" class="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">rapprochée banque</span>
                {{ formatChf(e.amountCents) }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div class="space-y-6">
        <div class="card space-y-2 text-sm">
          <h2 class="mb-2">Informations</h2>
          <p><span class="text-muted">Client :</span> <NuxtLink v-if="data.client" :to="`/clients/${data.client.id}`" class="link">{{ data.client.name }}</NuxtLink></p>
          <p><span class="text-muted">Émise le :</span> {{ formatDateCh(inv.issueDate) }}</p>
          <p><span class="text-muted">Échéance :</span> {{ formatDateCh(inv.dueDate) }}</p>
          <p><span class="text-muted">Référence QR :</span> <span class="font-mono text-xs">{{ formatQrReference(inv.qrReference) }}</span></p>
          <p v-if="data.subscription">
            <span class="text-muted">Abonnement :</span>
            <NuxtLink :to="`/subscriptions/${data.subscription.id}`" class="link">{{ data.subscription.name }}</NuxtLink>
          </p>
          <p v-if="inv.notes" class="whitespace-pre-line"><span class="text-muted">Notes :</span> {{ inv.notes }}</p>
        </div>

        <div class="card">
          <h2 class="mb-3">Historique</h2>
          <ol class="space-y-3 border-l border-line pl-4">
            <li v-for="event in data.events" :key="event.id" class="relative text-sm">
              <span class="absolute top-1.5 -left-[21px] size-2.5 rounded-full" :class="event.type === 'LATE' ? 'bg-red-500' : 'bg-white'" />
              <p :class="event.type === 'LATE' ? 'text-red-300' : ''">{{ event.message }}</p>
              <p class="text-xs text-muted">{{ formatDateTimeCh(event.createdAt) }}<span v-if="event.userFirstname"> · {{ event.userFirstname }}</span></p>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <BaseModal :open="paymentOpen" title="Ajouter un paiement" size="sm" @close="paymentOpen = false">
      <form class="space-y-4" @submit.prevent="submitPayment">
        <div>
          <label class="label" for="pay-amount">Montant CHF (reste dû {{ formatChf(remaining) }})</label>
          <input id="pay-amount" v-model="payment.amount" class="input" inputmode="decimal" required />
        </div>
        <div>
          <label class="label" for="pay-date">Date du paiement</label>
          <input id="pay-date" v-model="payment.paidAt" class="input" type="date" required />
        </div>
        <div>
          <label class="label" for="pay-note">Note</label>
          <input id="pay-note" v-model="payment.note" class="input" maxlength="255" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="paymentOpen = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="writeOffOpen" title="Solder la facture" size="sm" @close="writeOffOpen = false">
      <form class="space-y-4" @submit.prevent="submitWriteOff">
        <p class="text-sm text-muted">Le reste dû de {{ formatChf(remaining) }} sera abandonné et la facture close. Seul le montant encaissé compte dans le chiffre d’affaires.</p>
        <div>
          <label class="label" for="wo-reason">Motif *</label>
          <input id="wo-reason" v-model="writeOffReason" class="input" required minlength="3" maxlength="255" placeholder="ex. Client parti, payé au prorata jusqu’au 31.12" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="writeOffOpen = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="pending">Solder</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
