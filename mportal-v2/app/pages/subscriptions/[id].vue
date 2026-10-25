<script setup lang="ts">
import { AlertTriangle, CalendarX2, PlayCircle, RotateCcw, Zap } from 'lucide-vue-next'
import type { SubscriptionDetail } from '~/types/api'

const route = useRoute()
const id = Number(route.params.id)
const { data, refresh } = await useApiFetch<SubscriptionDetail>(`/api/subscriptions/${id}`)
useHead({ title: () => `${data.value?.subscription.name ?? 'Abonnement'} – MPortal` })

const { pending, run } = useAction()
const formKey = ref(0)

const sub = computed(() => data.value?.subscription)
const isLate = computed(() => sub.value?.status === 'ACTIVE' && sub.value.daysUntilBilling < 0)

async function generate() {
  if (!window.confirm('Générer maintenant la facture de la prochaine période ?')) return
  const result = await run<{ invoiceId: number; invoiceNumber: number }>('POST', `/api/subscriptions/${id}/generate`, {}, 'Facture générée en brouillon')
  if (result) await navigateTo(`/invoices/${result.invoiceId}`)
}

const endOpen = ref(false)
const endDate = ref(todayIso())
async function submitEnd() {
  const ok = await run('POST', `/api/subscriptions/${id}/end`, { endDate: endDate.value }, 'Date de fin enregistrée')
  if (ok !== null) {
    endOpen.value = false
    await refresh()
  }
}
async function reactivate() {
  const ok = await run('POST', `/api/subscriptions/${id}/reactivate`, {}, 'Abonnement réactivé')
  if (ok !== null) await refresh()
}
async function onSaved() {
  await refresh()
  formKey.value++
}
</script>

<template>
  <div v-if="data && sub">
    <PageHeader :title="sub.name" :subtitle="data.client?.name" back="/subscriptions">
      <button v-if="sub.status === 'ACTIVE'" class="btn-primary" :disabled="pending" @click="generate"><Zap class="size-4" /> Générer maintenant</button>
      <button v-if="sub.status === 'ACTIVE'" class="btn-secondary" @click="endOpen = true"><CalendarX2 class="size-4" /> Terminer</button>
      <button v-if="sub.status === 'ENDED' || sub.endDate" class="btn-secondary" :disabled="pending" @click="reactivate"><RotateCcw class="size-4" /> Réactiver</button>
    </PageHeader>

    <div v-if="isLate" class="mb-6 flex items-start gap-3 rounded-lg border border-red-800 bg-red-950/70 px-4 py-3 text-red-100">
      <AlertTriangle class="mt-0.5 size-5 shrink-0 text-red-400" />
      <div>
        <p class="font-semibold">Renouvellement en retard de {{ -sub.daysUntilBilling }} jour{{ -sub.daysUntilBilling > 1 ? 's' : '' }}</p>
        <p class="text-sm">L’échéance du {{ formatDateCh(sub.nextBillingDate) }} est passée et la facture n’a pas été générée. Cliquez sur « Générer maintenant » (ou elle le sera à la prochaine tâche automatique).</p>
      </div>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="card">
        <p class="text-xs text-muted">Statut</p>
        <p class="mt-1 font-semibold">{{ sub.status === 'ACTIVE' ? 'Actif' : 'Terminé' }}</p>
        <p v-if="sub.endDate" class="text-xs text-muted">fin le {{ formatDateCh(sub.endDate) }}</p>
      </div>
      <div class="card">
        <p class="text-xs text-muted">Périodicité</p>
        <p class="mt-1 font-semibold">{{ periodLabels[sub.period] }}</p>
        <p class="text-xs text-muted">depuis le {{ formatDateCh(sub.startDate) }}</p>
      </div>
      <div class="card">
        <p class="text-xs text-muted">Prochaine facture</p>
        <p class="mt-1 font-semibold" :class="isLate ? 'text-red-400' : ''">{{ sub.status === 'ACTIVE' ? formatDateCh(sub.nextBillingDate) : '—' }}</p>
      </div>
      <div class="card">
        <p class="text-xs text-muted">Factures générées</p>
        <p class="mt-1 font-semibold">{{ data.invoices.length }}</p>
      </div>
    </div>

    <SubscriptionForm :key="formKey" :initial="data" @saved="onSaved" />

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="card overflow-x-auto">
        <h2 class="mb-3">Factures générées</h2>
        <EmptyState v-if="data.invoices.length === 0" text="Aucune facture générée pour l’instant" />
        <table v-else>
          <thead>
            <tr><th>N°</th><th>Période dès</th><th class="text-right">Montant</th><th>Statut</th></tr>
          </thead>
          <tbody>
            <tr v-for="invoice in data.invoices" :key="invoice.id" class="cursor-pointer hover:bg-card-2" @click="navigateTo(`/invoices/${invoice.id}`)">
              <td>{{ invoice.number }}</td>
              <td>{{ formatDateCh(invoice.billingPeriodStart) }}</td>
              <td class="text-right whitespace-nowrap">{{ formatChf(invoice.totalCents) }}</td>
              <td><StatusBadge :status="displayStatus(invoice)" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card space-y-3">
        <h2>Contrats de maintenance liés</h2>
        <EmptyState v-if="data.contracts.length === 0" text="Aucun contrat lié à une ligne de cet abonnement" />
        <ul v-else class="divide-y divide-line">
          <li v-for="c in data.contracts" :key="c.id">
            <NuxtLink :to="`/contracts/${c.id}`" class="flex justify-between py-2 text-sm hover:text-neutral-300">
              <span>{{ c.name }}</span>
              <span class="text-muted">{{ formatHours(c.hoursPerPeriod) }} / période</span>
            </NuxtLink>
          </li>
        </ul>
        <div v-if="data.endedLines.length > 0" class="border-t border-line pt-3">
          <h3 class="mb-2 text-sm font-medium text-muted">Lignes retirées</h3>
          <ul class="space-y-1 text-sm text-muted">
            <li v-for="l in data.endedLines" :key="l.id">{{ l.serviceName }}<span v-if="l.label"> ({{ l.label }})</span> — retirée le {{ formatDateCh(l.endedAt) }}</li>
          </ul>
        </div>
      </div>
    </div>

    <BaseModal :open="endOpen" title="Terminer l’abonnement" size="sm" @close="endOpen = false">
      <form class="space-y-4" @submit.prevent="submitEnd">
        <p class="text-sm text-muted">Aucune facture ne sera générée pour une période qui commence à partir de cette date.</p>
        <div>
          <label class="label" for="end-date">Date de fin</label>
          <input id="end-date" v-model="endDate" class="input" type="date" required />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="endOpen = false">Annuler</button>
          <button type="submit" class="btn-danger" :disabled="pending"><PlayCircle class="size-4 rotate-180" /> Terminer</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
