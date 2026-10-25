<script setup lang="ts">
import { AlertTriangle, Plus } from 'lucide-vue-next'
import type { SubscriptionListItem } from '~/types/api'

useHead({ title: 'Abonnements – MPortal' })

const status = ref<'ACTIVE' | 'ENDED' | ''>('ACTIVE')
const { data, pending } = await useApiFetch<SubscriptionListItem[]>('/api/subscriptions', { query: () => ({ status: status.value || undefined }) })

const totals = computed(() => {
  const active = (data.value ?? []).filter((s) => s.status === 'ACTIVE')
  return {
    yearly: active.reduce((sum, s) => sum + s.yearlyPriceCents, 0),
    margin: active.reduce((sum, s) => sum + s.yearlyMarginCents, 0),
    late: active.filter((s) => s.isLate).length,
  }
})
</script>

<template>
  <div>
    <PageHeader title="Abonnements" :subtitle="`Revenu annuel ${formatChf(totals.yearly)} · marge ${formatChf(totals.margin)}`">
      <NuxtLink to="/subscriptions/new" class="btn-primary"><Plus class="size-4" /> Nouvel abonnement</NuxtLink>
    </PageHeader>

    <div class="mb-4 flex gap-2">
      <button v-for="opt in [{ v: 'ACTIVE', l: 'Actifs' }, { v: 'ENDED', l: 'Terminés' }, { v: '', l: 'Tous' }] as const" :key="opt.v" class="btn-sm" :class="status === opt.v ? 'btn-primary' : 'btn-secondary'" @click="status = opt.v">
        {{ opt.l }}
      </button>
    </div>

    <p v-if="totals.late > 0" class="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/70 px-4 py-3 text-sm text-red-100">
      <AlertTriangle class="size-5 shrink-0 text-red-400" />
      {{ totals.late }} renouvellement{{ totals.late > 1 ? 's' : '' }} en retard : la facture n’a pas été générée à l’échéance.
    </p>

    <div class="card overflow-x-auto" :class="{ 'opacity-60': pending }">
      <EmptyState v-if="data && data.length === 0" text="Aucun abonnement" />
      <table v-else>
        <thead>
          <tr>
            <th>Client</th>
            <th>Abonnement</th>
            <th>Lignes</th>
            <th>Périodicité</th>
            <th>Prochaine facture</th>
            <th class="text-right">Prix / période</th>
            <th class="text-right">Marge / an</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="sub in data ?? []"
            :key="sub.id"
            class="cursor-pointer hover:bg-card-2"
            :class="{ 'bg-red-950/40': sub.isLate }"
            @click="navigateTo(`/subscriptions/${sub.id}`)"
          >
            <td class="font-medium">{{ sub.clientName }}</td>
            <td>
              <NuxtLink :to="`/subscriptions/${sub.id}`" class="hover:underline" @click.stop>{{ sub.name }}</NuxtLink>
            </td>
            <td class="max-w-64 text-xs text-muted">{{ sub.lines.map((l) => (l.label ? `${l.serviceName} (${l.label})` : l.serviceName)).join(', ') }}</td>
            <td>{{ periodLabels[sub.period] }}</td>
            <td class="whitespace-nowrap">
              <template v-if="sub.status === 'ACTIVE'">
                <span :class="sub.isLate ? 'font-semibold text-red-400' : ''">{{ formatDateCh(sub.nextBillingDate) }}</span>
                <span v-if="sub.isLate" class="block text-xs font-medium text-red-400">
                  Renouvellement en retard de {{ -sub.daysUntilBilling }} jour{{ -sub.daysUntilBilling > 1 ? 's' : '' }} — facture non générée
                </span>
                <span v-else-if="sub.isDueSoon" class="block text-xs text-amber-300">dans {{ sub.daysUntilBilling }} jour(s)</span>
              </template>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="text-right whitespace-nowrap">{{ formatChf(sub.periodPriceCents) }}</td>
            <td class="text-right whitespace-nowrap">{{ formatChf(sub.yearlyMarginCents) }}</td>
            <td>
              <span class="rounded-full px-2 py-0.5 text-xs" :class="sub.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-800 text-neutral-400'">
                {{ sub.status === 'ACTIVE' ? (sub.endDate ? `fin ${formatDateCh(sub.endDate)}` : 'Actif') : 'Terminé' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
