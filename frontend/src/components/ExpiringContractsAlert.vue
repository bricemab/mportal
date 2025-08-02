<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'

interface ExpiringContract {
  id: number
  name: string
  client: {
    id: number
    name: string
    firstname: string
    lastname: string
  }
  endAt: string
  daysRemaining: number
  remainingHours: number
  totalHours: number
}

const props = defineProps<{
  contracts: ExpiringContract[]
}>()

const router = useRouter()
const isMinimized = ref(false)

const sortedContracts = computed(() => {
  return [...props.contracts].sort((a, b) => a.daysRemaining - b.daysRemaining)
})

const urgencyClass = (daysRemaining: number) => {
  if (daysRemaining < 0) return 'bg-red-600/20 border-red-600 text-red-500'
  if (daysRemaining <= 7) return 'bg-red-500/20 border-red-500 text-red-400'
  if (daysRemaining <= 14) return 'bg-orange-500/20 border-orange-500 text-orange-400'
  return 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
}

const urgencyIcon = (daysRemaining: number) => {
  if (daysRemaining < 0) return 'bx-x-circle'
  if (daysRemaining <= 7) return 'bx-error-circle'
  if (daysRemaining <= 14) return 'bx-error'
  return 'bx-info-circle'
}

const formatDaysRemaining = (days: number) => {
  if (days < 0) {
    return `Expiré depuis ${Math.abs(days)} jour(s)`
  }
  return `${days} jour(s) restant(s)`
}

const navigateToContracts = () => {
  router.push('/maintenance-contracts')
}

const navigateToContract = (id: number) => {
  router.push(`/maintenance-contracts/${id}`)
}
</script>

<template>
  <div
    v-if="contracts.length > 0"
    class="fixed top-4 right-64 z-50 transition-all duration-300"
    :class="isMinimized ? 'w-auto' : 'w-96'"
  >
    <!-- Version minimisée -->
    <div
      v-if="isMinimized"
      class="bg-lightBlack border rounded-lg p-3 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
      :class="
        contracts.some((c) => c.daysRemaining < 0) ? 'border-red-500/50' : 'border-yellow-500/50'
      "
      @click="isMinimized = false"
    >
      <div class="flex items-center gap-2">
        <i
          class="bx text-xl animate-pulse"
          :class="
            contracts.some((c) => c.daysRemaining < 0)
              ? 'bx-x-circle text-red-500'
              : 'bx-error text-yellow-500'
          "
        ></i>
        <span class="text-sm font-medium">
          {{
            contracts.filter((c) => c.daysRemaining < 0).length > 0
              ? `${contracts.filter((c) => c.daysRemaining < 0).length} contrat(s) expiré(s)`
              : `${contracts.length} contrat(s) à renouveler`
          }}
        </span>
      </div>
    </div>

    <!-- Version complète -->
    <div
      v-else
      class="bg-lightBlack border rounded-lg shadow-lg overflow-hidden"
      :class="
        contracts.some((c) => c.daysRemaining < 0) ? 'border-red-500/50' : 'border-yellow-500/50'
      "
    >
      <!-- En-tête -->
      <div
        class="p-4 border-b"
        :class="
          contracts.some((c) => c.daysRemaining < 0)
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
        "
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i
              class="bx text-xl animate-pulse"
              :class="
                contracts.some((c) => c.daysRemaining < 0)
                  ? 'bx-x-circle text-red-500'
                  : 'bx-error text-yellow-500'
              "
            ></i>
            <h3
              class="font-semibold"
              :class="
                contracts.some((c) => c.daysRemaining < 0) ? 'text-red-400' : 'text-yellow-400'
              "
            >
              Contrats à renouveler
            </h3>
          </div>
          <button
            @click="isMinimized = true"
            class="text-gray-400 hover:text-white transition-colors"
            title="Minimiser"
          >
            <i class="bx bx-minus text-xl"></i>
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-1">
          <span v-if="contracts.filter((c) => c.daysRemaining < 0).length > 0">
            {{ contracts.filter((c) => c.daysRemaining < 0).length }} expiré(s),
          </span>
          {{ contracts.filter((c) => c.daysRemaining >= 0).length }} expire(nt) dans le prochain
          mois
        </p>
      </div>

      <!-- Liste des contrats -->
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="contract in sortedContracts"
          :key="contract.id"
          class="p-3 border-b border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer"
          @click="navigateToContract(contract.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <i
                  :class="['bx', urgencyIcon(contract.daysRemaining), 'text-sm']"
                  :style="{
                    color:
                      contract.daysRemaining < 0
                        ? '#dc2626'
                        : contract.daysRemaining <= 7
                          ? '#ef4444'
                          : contract.daysRemaining <= 14
                            ? '#f97316'
                            : '#eab308',
                  }"
                ></i>
                <h4 class="font-medium text-sm truncate">{{ contract.name }}</h4>
              </div>
              <p class="text-xs text-gray-400 truncate">
                {{ contract.client.name }} - {{ contract.client.firstname }}
                {{ contract.client.lastname }}
              </p>
              <div class="flex items-center gap-3 mt-2 text-xs">
                <span class="px-2 py-1 rounded-full" :class="urgencyClass(contract.daysRemaining)">
                  <i
                    :class="[
                      'bx mr-1',
                      contract.daysRemaining < 0 ? 'bx-x-circle' : 'bx-calendar-exclamation',
                    ]"
                  ></i>
                  {{ formatDaysRemaining(contract.daysRemaining) }}
                </span>
                <span class="text-gray-400">
                  Expire le {{ dayjs(contract.endAt).format('DD/MM/YYYY') }}
                </span>
              </div>
              <div class="mt-1 text-xs text-gray-400">
                <i class="bx bx-time-five mr-1"></i>
                {{ contract.remainingHours }}h / {{ contract.totalHours }}h restantes
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pied de page -->
      <div class="p-3 bg-gray-800/30 border-t border-gray-700">
        <button
          @click="navigateToContracts"
          class="w-full btn btn-primary btn-sm flex items-center justify-center gap-2"
        >
          <i class="bx bx-list-ul"></i>
          Voir tous les contrats
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
