<script setup lang="ts">
import { AlertTriangle, Banknote, CircleDollarSign, Landmark, Receipt, RefreshCw, TrendingUp, Wallet } from 'lucide-vue-next'
import type { DashboardData } from '~/types/api'

useHead({ title: 'Tableau de bord – MPortal' })

const { user } = useUserSession()
const year = ref(Number(todayIso().slice(0, 4)))
const { data, pending } = await useApiFetch<DashboardData>('/api/dashboard', { query: () => ({ year: year.value }) })

const resultTone = computed(() => ((data.value?.totals.resultCents ?? 0) >= 0 ? 'positive' : 'negative'))
</script>

<template>
  <div>
    <PageHeader :title="`Bonjour ${user?.firstname ?? ''} 👋`" subtitle="Vue d’ensemble de l’activité">
      <label class="sr-only" for="year">Année</label>
      <select id="year" v-model.number="year" class="input w-auto">
        <option v-for="y in data?.years ?? [year]" :key="y" :value="y">{{ y }}</option>
      </select>
    </PageHeader>

    <div v-if="!data && pending" class="text-muted">Chargement…</div>

    <div v-if="data" class="space-y-6">
      <!-- Alertes prioritaires -->
      <div v-if="data.upcomingRenewals.some((r) => r.isLate) || data.receivables.overdueCount > 0 || data.pendingBankCount > 0" class="space-y-2">
        <NuxtLink
          v-for="renewal in data.upcomingRenewals.filter((r) => r.isLate)"
          :key="`late-${renewal.id}`"
          :to="`/subscriptions/${renewal.id}`"
          class="flex items-center gap-3 rounded-lg border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-100 hover:bg-red-950"
        >
          <AlertTriangle class="size-5 shrink-0 text-red-400" />
          <span>
            <strong>Renouvellement en retard de {{ -renewal.daysUntilBilling }} jour{{ -renewal.daysUntilBilling > 1 ? 's' : '' }}</strong>
            — {{ renewal.clientName }} · {{ renewal.name }} (échéance du {{ formatDateCh(renewal.nextBillingDate) }})
          </span>
        </NuxtLink>
        <NuxtLink
          v-if="data.receivables.overdueCount > 0"
          to="/invoices?status=OVERDUE"
          class="flex items-center gap-3 rounded-lg border border-amber-800 bg-amber-950/60 px-4 py-3 text-sm text-amber-100 hover:bg-amber-950"
        >
          <AlertTriangle class="size-5 shrink-0 text-amber-400" />
          {{ data.receivables.overdueCount }} facture{{ data.receivables.overdueCount > 1 ? 's' : '' }} en retard de paiement ({{ formatChf(data.receivables.overdueCents) }})
        </NuxtLink>
        <NuxtLink
          v-if="data.pendingBankCount > 0"
          to="/bank"
          class="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-sm hover:bg-card-2"
        >
          <Landmark class="size-5 shrink-0" />
          {{ data.pendingBankCount }} mouvement{{ data.pendingBankCount > 1 ? 's' : '' }} bancaire{{ data.pendingBankCount > 1 ? 's' : '' }} à traiter
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facturé" :value="formatChf(data.totals.invoicedCents)" :hint="`Factures émises en ${data.year}`" :icon="CircleDollarSign" />
        <StatCard label="Encaissé" :value="formatChf(data.totals.collectedCents)" :hint="`Paiements reçus en ${data.year}`" :icon="Wallet" />
        <StatCard label="Dépenses" :value="formatChf(data.totals.expensesCents)" :hint="`Charges ${data.year}`" :icon="Receipt" />
        <StatCard label="Résultat" :value="formatChf(data.totals.resultCents)" hint="Encaissé − dépenses" :icon="TrendingUp" :tone="resultTone" />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="À encaisser"
          :value="formatChf(data.receivables.openCents)"
          :hint="`${data.receivables.openCount} facture(s) ouverte(s) · dont ${formatChf(data.receivables.overdueCents)} en retard`"
          :icon="Banknote"
          :tone="data.receivables.overdueCount > 0 ? 'warning' : 'default'"
        />
        <StatCard
          label="Revenu récurrent annuel"
          :value="formatChf(data.recurring.yearlyCents)"
          :hint="`${data.recurring.activeCount} abonnement(s) · marge ${formatChf(data.recurring.yearlyMarginCents)}`"
          :icon="RefreshCw"
        />
        <div class="card">
          <p class="text-sm text-muted">Prélèvements associés {{ data.year }}</p>
          <ul class="mt-2 space-y-1">
            <li v-for="w in data.totals.withdrawals" :key="w.firstname" class="flex justify-between text-sm">
              <span>{{ w.firstname }}</span>
              <span class="font-medium">{{ formatChf(w.totalCents) }}</span>
            </li>
            <li v-if="data.totals.withdrawals.length === 0" class="text-sm text-muted">Aucun (importez un relevé bancaire)</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <h2 class="mb-4">Évolution mensuelle {{ data.year }}</h2>
        <ClientOnly>
          <MonthlyChart :labels="data.months" :invoiced="data.series.invoiced" :collected="data.series.collected" :expenses="data.series.expenses" />
        </ClientOnly>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div class="card">
          <div class="mb-3 flex items-center justify-between">
            <h2>Brouillons à valider</h2>
            <NuxtLink to="/invoices?status=DRAFT" class="text-sm text-muted hover:text-white">Tout voir</NuxtLink>
          </div>
          <EmptyState v-if="data.drafts.length === 0" text="Aucun brouillon en attente" />
          <ul v-else class="divide-y divide-line">
            <li v-for="draft in data.drafts" :key="draft.id">
              <NuxtLink :to="`/invoices/${draft.id}`" class="flex items-center justify-between gap-3 py-2.5 hover:text-neutral-300">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ draft.clientName }} — {{ draft.title }}</p>
                  <p class="text-xs text-muted">N° {{ draft.number }}<span v-if="draft.subscriptionId"> · abonnement</span></p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span v-if="draft.generatedLate" class="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-300">générée en retard</span>
                  <span class="text-sm">{{ formatChf(draft.totalCents) }}</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="card">
          <div class="mb-3 flex items-center justify-between">
            <h2>Renouvellements (45 jours)</h2>
            <NuxtLink to="/subscriptions" class="text-sm text-muted hover:text-white">Abonnements</NuxtLink>
          </div>
          <EmptyState v-if="data.upcomingRenewals.length === 0" text="Aucun renouvellement proche" />
          <ul v-else class="divide-y divide-line">
            <li v-for="renewal in data.upcomingRenewals" :key="renewal.id">
              <NuxtLink :to="`/subscriptions/${renewal.id}`" class="flex items-center justify-between gap-3 py-2.5 hover:text-neutral-300">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ renewal.clientName }} — {{ renewal.name }}</p>
                  <p class="text-xs" :class="renewal.isLate ? 'font-medium text-red-400' : 'text-muted'">
                    {{ formatDateCh(renewal.nextBillingDate) }} ·
                    <template v-if="renewal.isLate">en retard de {{ -renewal.daysUntilBilling }} jour(s)</template>
                    <template v-else>dans {{ renewal.daysUntilBilling }} jour(s)</template>
                  </p>
                </div>
                <span class="shrink-0 text-sm">{{ formatChf(renewal.periodPriceCents) }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="card">
          <h2 class="mb-3">Contrats de maintenance à surveiller</h2>
          <EmptyState v-if="data.contractAlerts.length === 0" text="Rien à signaler" />
          <ul v-else class="divide-y divide-line">
            <li v-for="alert in data.contractAlerts" :key="alert.id">
              <NuxtLink :to="`/contracts/${alert.id}`" class="flex items-center justify-between gap-3 py-2.5 hover:text-neutral-300">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ alert.clientName }} — {{ alert.name }}</p>
                  <p v-if="alert.period" class="text-xs text-muted">
                    Fin de période le {{ formatDateCh(alert.period.endDate) }} ({{ alert.period.daysLeft }} j)
                  </p>
                </div>
                <span v-if="alert.period" class="shrink-0 text-sm" :class="alert.period.remainingHours <= 0 ? 'text-red-400' : ''">
                  {{ formatHours(alert.period.remainingHours) }} restantes
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="card">
          <h2 class="mb-3">Meilleurs clients {{ data.year }}</h2>
          <EmptyState v-if="data.topClients.length === 0" text="Pas encore de facture émise cette année" />
          <ol v-else class="space-y-2">
            <li v-for="(client, index) in data.topClients" :key="client.clientId" class="flex items-center justify-between text-sm">
              <NuxtLink :to="`/clients/${client.clientId}`" class="hover:underline">{{ index + 1 }}. {{ client.name }}</NuxtLink>
              <span class="font-medium">{{ formatChf(client.totalCents) }}</span>
            </li>
          </ol>
        </div>
      </div>

      <div class="card overflow-x-auto">
        <div class="mb-3 flex items-center justify-between">
          <h2>Dernières factures</h2>
          <NuxtLink to="/invoices" class="text-sm text-muted hover:text-white">Toutes les factures</NuxtLink>
        </div>
        <table>
          <thead>
            <tr><th>N°</th><th>Client</th><th>Titre</th><th>Échéance</th><th class="text-right">Montant</th><th>Statut</th></tr>
          </thead>
          <tbody>
            <tr v-for="invoice in data.recentInvoices" :key="invoice.id" class="cursor-pointer hover:bg-card-2" @click="navigateTo(`/invoices/${invoice.id}`)">
              <td class="whitespace-nowrap">{{ invoice.number }}</td>
              <td>{{ invoice.clientName }}</td>
              <td class="max-w-72 truncate">{{ invoice.title }}</td>
              <td class="whitespace-nowrap">{{ formatDateCh(invoice.dueDate) }}</td>
              <td class="text-right whitespace-nowrap">{{ formatChf(invoice.totalCents) }}</td>
              <td><StatusBadge :status="invoice.displayStatus" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
