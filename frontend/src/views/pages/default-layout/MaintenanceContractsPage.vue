<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThePagination from '@/components/ThePagination.vue'
import CreateMaintenanceContractModal from '@/components/MaintenanceContracts/CreateMaintenanceContractModal.vue'
import DeleteMaintenanceContractModal from '@/components/MaintenanceContracts/DeleteMaintenanceContractModal.vue'
import RenewMaintenanceContractModal from '@/components/MaintenanceContracts/RenewMaintenanceContractModal.vue'
import type { MaintenanceContractType } from '@/types/MaintenanceContractType.ts'
import dayjs from 'dayjs'
import Utils from '@/utils/Utils'

const router = useRouter()
const route = useRoute()

const isMainRoute = computed(() => route.name === 'maintenance-contracts-page')

const contracts = ref<MaintenanceContractType[]>([])
const currentPage = ref(1)
const paginatedItems = ref<MaintenanceContractType[]>([])

const isCreateOpen = ref(false)
const isDeleteOpen = ref(false)
const isRenewOpen = ref(false)
const selectedContract = ref<MaintenanceContractType | null>(null)

function openCreateModal() {
  selectedContract.value = null
  isCreateOpen.value = true
}

function openDeleteModal(contract: MaintenanceContractType) {
  selectedContract.value = contract
  isDeleteOpen.value = true
}

function openRenewModal(contract: MaintenanceContractType) {
  selectedContract.value = contract
  isRenewOpen.value = true
}

function viewContractDetails(contract: MaintenanceContractType) {
  router.push({ name: 'maintenance-contracts-detail-page', params: { id: contract.id.toString() } })
}

async function handleDeleteConfirm() {
  await fetchList()
  isDeleteOpen.value = false
  selectedContract.value = null
}

async function handleCreateSubmit() {
  isCreateOpen.value = false
  await fetchList()
}

async function handleRenewSubmit() {
  isRenewOpen.value = false
  selectedContract.value = null
  await fetchList()
}

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{
    maintenanceContracts: MaintenanceContractType[]
  }>('/maintenance-contracts/list', {})
  if (response.success) {
    contracts.value = response.data.maintenanceContracts as MaintenanceContractType[]
  } else {
    Utils.handlerError(response.error)
  }
}

// Fonction pour déterminer la couleur d'affichage selon la proximité de fin de contrat
const getContractRowClass = (contract: MaintenanceContractType) => {
  const now = dayjs()
  const endAt = dayjs(contract.endAt)
  const monthsRemaining = endAt.diff(now, 'month', true)

  if (monthsRemaining <= 1) {
    return 'text-red-500'
  } else if (monthsRemaining <= 3) {
    return 'text-yellow-500'
  }
  return ''
}

const getRemainingHoursClass = (contract: MaintenanceContractType) => {
  const percentage = contract.remainingHours / contract.totalHours
  if (percentage <= 0) return 'text-red-500'
  if (percentage <= 0.2) return 'text-orange-500'
  return 'text-green-400'
}

onMounted(async () => {
  await fetchList()
})
</script>

<template>
  <div v-if="isMainRoute" class="bg-lightBlack p-6 rounded-xl mb-5">
    <div class="mb-5 flex justify-between items-center">
      <div>
        <h3 class="font-semibold mb-1">Contrats de maintenance</h3>
        <p class="text-sm">Gestion des contrats de maintenance actifs</p>
      </div>
      <button class="btn btn-primary flex items-center" @click="openCreateModal">
        <i class="bx bx-plus pr-2"></i>
        Ajouter un contrat
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-white">
          <th class="py-5">Client</th>
          <th>Nom du contrat</th>
          <th>Heures (Total/Restantes)</th>
          <th>Prix</th>
          <th>Fin de contrat</th>
          <th>Chemin contrat</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="contract in paginatedItems as MaintenanceContractType[]"
          :key="contract.id"
          class="border-b border-white py-2"
          :class="getContractRowClass(contract)"
        >
          <td class="py-5">{{ contract.client.name }}</td>
          <td>{{ contract.name }}</td>
          <td class="text-white">
            <span>{{ contract.totalHours }}h</span> /
            <span :class="getRemainingHoursClass(contract)">{{ contract.remainingHours }}h</span>
          </td>
          <td>{{ Utils.formatAmountWithApostrophes(contract.price) }} CHF</td>
          <td>
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
            {{ dayjs(contract.endAt).format('DD.MM.YYYY') }}
          </td>
          <td class="text-xs text-gray-400 max-w-48 truncate" :title="contract.path">
            {{ contract.path }}
          </td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-blue-500"
              title="Voir les détails"
              @click="viewContractDetails(contract)"
            >
              <i class="bx bx-info-circle"></i>
            </button>
            <button
              class="text-white hover:text-blue-500"
              title="Renouveler le contrat"
              @click="openRenewModal(contract)"
            >
              <i class="bxr bx-refresh-cw"></i>
            </button>
            <button
              class="text-white hover:text-red-500"
              title="Supprimer"
              @click="openDeleteModal(contract)"
            >
              <i class="bx bx-trash-alt"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination
      :items="contracts"
      v-model:modelValue="currentPage"
      :itemsPerPage="8"
      @update:pageItems="(items: MaintenanceContractType[]) => (paginatedItems = items)"
    />

    <CreateMaintenanceContractModal
      :open="isCreateOpen"
      @close="isCreateOpen = false"
      @submit="handleCreateSubmit"
    />

    <DeleteMaintenanceContractModal
      :open="isDeleteOpen"
      :data="selectedContract!"
      @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm"
    />

    <RenewMaintenanceContractModal
      :open="isRenewOpen"
      :data="selectedContract"
      @close="isRenewOpen = false"
      @submit="handleRenewSubmit"
    />
  </div>

  <!-- Router view pour les sous-routes (page de détail) -->
  <router-view />
</template>
