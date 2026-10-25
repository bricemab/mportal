<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import type { ContractListItem } from '~/types/api'

useHead({ title: 'Contrats de maintenance – MPortal' })

const { data, pending } = await useApiFetch<ContractListItem[]>('/api/contracts')
const modalOpen = ref(false)
</script>

<template>
  <div>
    <PageHeader title="Contrats de maintenance" subtitle="Quota d’heures par période, suivi des interventions">
      <button class="btn-primary" @click="modalOpen = true"><Plus class="size-4" /> Nouveau contrat</button>
    </PageHeader>

    <EmptyState v-if="data && data.length === 0" text="Aucun contrat" />
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" :class="{ 'opacity-60': pending }">
      <NuxtLink v-for="contract in data ?? []" :key="contract.id" :to="`/contracts/${contract.id}`" class="card block space-y-3 hover:bg-card-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ contract.name }}</p>
            <p class="text-sm text-muted">{{ contract.clientName }}</p>
          </div>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-xs" :class="contract.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-800 text-neutral-400'">
            {{ contract.status === 'ACTIVE' ? 'Actif' : 'Terminé' }}
          </span>
        </div>
        <template v-if="contract.currentPeriod">
          <HoursBar :used="contract.currentPeriod.usedHours" :quota="contract.currentPeriod.hoursQuota" />
          <div class="flex justify-between text-sm">
            <span class="text-muted">{{ formatHours(contract.currentPeriod.usedHours) }} / {{ formatHours(contract.currentPeriod.hoursQuota) }}</span>
            <span :class="contract.currentPeriod.remainingHours <= 0 ? 'text-red-400' : ''">{{ formatHours(contract.currentPeriod.remainingHours) }} restantes</span>
          </div>
          <p class="text-xs text-muted">
            Période {{ formatDateCh(contract.currentPeriod.startDate) }} – {{ formatDateCh(contract.currentPeriod.endDate) }}
            <span v-if="contract.currentPeriod.daysLeft >= 0">({{ contract.currentPeriod.daysLeft }} j restants)</span>
            <span v-else class="text-amber-300">(échue)</span>
          </p>
        </template>
        <p v-else class="text-sm text-muted">Aucune période</p>
      </NuxtLink>
    </div>

    <ContractFormModal :open="modalOpen" @close="modalOpen = false" @saved="(id) => navigateTo(`/contracts/${id}`)" />
  </div>
</template>
