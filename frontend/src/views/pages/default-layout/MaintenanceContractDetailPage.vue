<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AddMaintenanceHourModal from '@/components/MaintenanceContracts/AddMaintenanceHourModal.vue'
import type { MaintenanceContractType } from '@/types/MaintenanceContractType.ts'
import Utils from '@/utils/Utils.ts'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const contract = ref<MaintenanceContractType | null>(null)
const isAddHourOpen = ref(false)
const selectedYear = ref<number>(new Date().getFullYear())
const contractId = Number(route.params.id)

function openAddHourModal() {
  isAddHourOpen.value = true
}

async function handleAddHourSubmit() {
  isAddHourOpen.value = false
  await fetchContract()
}

const fetchContract = async () => {
  const response = await Utils.postEncodedToBackend<{ contract: MaintenanceContractType }>(
    '/maintenance-contracts/details',
    { id: contractId },
  )
  if (response.success) {
    contract.value = response.data.contract
  } else {
    Utils.handlerError(response.error)
  }
}

const availableYears = computed(() => {
  if (!contract.value?.contractHours) return []
  const years = [...new Set(contract.value.contractHours.map((h) => dayjs(h.date).year()))]
  return years.sort((a, b) => b - a)
})

const hoursForSelectedYear = computed(() => {
  if (!contract.value?.contractHours) return []
  return contract.value.contractHours
    .filter((h) => dayjs(h.date).year() === selectedYear.value)
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))
})

const totalHoursForYear = computed(() => {
  return hoursForSelectedYear.value.reduce((sum: number, hour: number) => sum + hour.hours, 0)
})

const getRemainingHoursClass = (contract: MaintenanceContractType) => {
  const percentage = contract.remainingHours / contract.totalHours
  if (percentage <= 0) return 'text-red-500'
  if (percentage <= 0.2) return 'text-orange-500'
  return 'text-green-400'
}

const goBack = () => {
  router.push({ name: 'maintenance-contracts-page' })
}

onMounted(fetchContract)
</script>

<template>
  <div v-if="contract" class="space-y-6">
    <!-- En-tête avec bouton retour -->
    <div class="bg-lightBlack p-6 rounded-xl">
      <div class="flex items-center justify-between mb-4">
        <button @click="goBack" class="flex items-center hover:text-gray-300">
          <i class="bx bx-arrow-left-stroke"></i>
          Retour aux contrats
        </button>
        <button class="btn btn-primary flex items-center" @click="openAddHourModal">
          <i class="bx bx-plus pr-2"></i>
          Ajouter des heures
        </button>
      </div>

      <h1 class="text-2xl font-bold mb-2">{{ contract.name }}</h1>
      <p class="text-gray-400">Détails du contrat de maintenance</p>
    </div>

    <!-- Informations de base -->
    <div class="bg-lightBlack p-6 rounded-xl">
      <h2 class="text-xl font-semibold mb-4">Informations générales</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-3">
          <div>
            <span class="text-gray-400">Client :</span>
            <span class="ml-2 font-medium">
              {{ contract.client.name }} ({{ contract.client.firstname }}
              {{ contract.client.lastname }})
            </span>
          </div>

          <div>
            <span class="text-gray-400">Heures :</span>
            <span class="ml-2">
              <span class="font-medium">{{ contract.totalHours }}h total</span> /
              <span class="font-medium" :class="getRemainingHoursClass(contract)"
                >{{ contract.remainingHours }}h restantes</span
              >
            </span>
          </div>

          <div>
            <span class="text-gray-400">Prix :</span>
            <span class="ml-2 font-medium"
              >{{ Utils.formatAmountWithApostrophes(contract.price) }} CHF</span
            >
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <span class="text-gray-400">Période :</span>
            <span
              class="ml-2 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-red-600/10 ring-inset text-sm"
              :class="{
                'bg-red-500/20 text-red-700 ring-red-600/10':
                  Utils.diffBetweenToday(contract.endAt)[0] === '-',
                'bg-green-500/20 text-green-700 ring-green-600/10':
                  Utils.diffBetweenToday(contract.endAt)[0] !== '-',
              }"
              >{{ Utils.diffBetweenToday(contract.endAt) }}</span
            >
            <span class="ml-2 font-medium">
              {{ dayjs(contract.startAt).format('DD.MM.YYYY') }} -
              {{ dayjs(contract.endAt).format('DD.MM.YYYY') }}
            </span>
          </div>

          <div>
            <span class="text-gray-400">Chemin contrat :</span>
            <span class="ml-2 text-sm text-gray-300 break-all">{{ contract.contractPath }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Heures effectuées -->
    <div class="bg-lightBlack p-6 rounded-xl">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Heures effectuées</h2>
        <div v-if="availableYears.length > 0" class="flex items-center space-x-3">
          <select
            v-model="selectedYear"
            class="custom-input bg-lightBlack border-gray-600 text-white"
          >
            <option v-for="year in availableYears" :key="'year-' + year" :value="year">
              {{ year }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="availableYears.length === 0" class="text-center text-gray-400 py-8">
        <i class="bx bx-time text-4xl mb-3"></i>
        <p>Aucune heure effectuée pour le moment</p>
      </div>

      <div v-else>
        <div class="mb-4 p-3 bg-gray-800 rounded-lg">
          <span class="text-gray-400">Total pour {{ selectedYear }} : </span>
          <span class="font-medium">{{ totalHoursForYear }}h restantes</span>
        </div>

        <div class="space-y-3">
          <div
            v-for="hour in hoursForSelectedYear"
            :key="hour.id"
            class="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-medium">{{ hour.description }}</h3>
              <span class="text-blue-400 font-semibold">{{ hour.hours }}h</span>
            </div>
            <div class="text-sm text-gray-400">
              {{ dayjs(hour.date).format('DD.MM.YYYY') }}
            </div>
          </div>
        </div>

        <div v-if="hoursForSelectedYear.length === 0" class="text-center text-gray-400 py-6">
          <p>Aucune heure effectuée pour l'année {{ selectedYear }}</p>
        </div>
      </div>
    </div>

    <AddMaintenanceHourModal
      :open="isAddHourOpen"
      :contractId="contractId"
      @close="isAddHourOpen = false"
      @submit="handleAddHourSubmit"
    />
  </div>

  <div v-else class="text-center py-8">
    <p class="text-gray-400">Chargement...</p>
  </div>
</template>
