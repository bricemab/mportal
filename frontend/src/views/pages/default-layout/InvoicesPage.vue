<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteInvoiceModal from '@/components/Invoices/DeleteInvoiceModal.vue'
import EditInvoiceModal from '@/components/Invoices/EditInvoiceModal.vue'
import StatusHistoryInvoiceModal from '@/components/Invoices/StatusHistoryInvoiceModal.vue'
import MoreInfoInvoiceModal from '@/components/Invoices/MoreInfoInvoiceModal.vue'

import CreateInvoiceModal from '@/components/Invoices/CreateInvoiceModal.vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoicePage } from '@/types/InvoiceType.ts'
import dayjs from 'dayjs'
import { InvoiceState } from '@/types/InvoiceType.ts'
import type { InvoiceLogType } from '@/types/InvoiceLogType.ts'

import SortSelect from '@/components/Filters/SortSelect.vue'
import ClientMultiSelect from '@/components/Filters/ClientMultiSelect.vue'
import InvoiceNumberSelect from '@/components/Filters/InvoiceNumberSelect.vue'
import InvoiceNameSelect from '@/components/Filters/InvoiceNameSelect.vue'
import AmountRangeSelect from '@/components/Filters/AmountRangeSelect.vue'
import InvoiceStateSelect from '@/components/Filters/InvoiceStateSelect.vue'

const invoices = ref<InvoicePage[]>([])
const currentPage = ref(1)
const paginatedItems = ref<InvoicePage[]>([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isStatusHistoryOpen = ref(false)
const isCreateOpen = ref(false)
const isMoreInfoOpen = ref(false)

const stateStyles: Record<string, string> = {
  CREATED: 'text-blue-600',
  UPDATED: 'text-yellow-600',
  GENERATED: 'text-indigo-600',
  SENT: 'text-teal-600',
  PAID: 'text-green-600',
  CANCELLED: 'text-red-600',
  UNPAID: 'text-orange-600',
}

const invoiceStateLabels: Record<string, string> = {
  CREATED: 'Créé',
  UPDATED: 'Mis à jour',
  GENERATED: 'Généré',
  SENT: 'Envoyé',
  PAID: 'Payé',
  CANCELLED: 'Annulé',
  UNPAID: 'Impayé',
}

const invoiceStates = Object.values(InvoiceState)
const selectedInvoice = ref<InvoicePage | null>(null)

function openCreateModal() {
  selectedInvoice.value = null
  isCreateOpen.value = true
}

function openDeleteModal(invoice: InvoicePage) {
  selectedInvoice.value = invoice
  isDeleteOpen.value = true
}

function openEditModal(invoice: InvoicePage) {
  selectedInvoice.value = invoice
  isEditOpen.value = true
}

function openStatusHistory(invoice: InvoicePage) {
  selectedInvoice.value = invoice
  isStatusHistoryOpen.value = true
}

function openMoreInfoModal(invoice: InvoicePage) {
  selectedInvoice.value = invoice
  isMoreInfoOpen.value = true
}

async function handleDeleteConfirm() {
  await fetchList()
  isDeleteOpen.value = false
  selectedInvoice.value = null
}

async function handleEditSubmit(updatedClient: ClientType) {
  await fetchList()
  isEditOpen.value = false
  selectedInvoice.value = null
}

async function handleCreateSubmit(newClient: ClientType) {
  isCreateOpen.value = false
  await fetchList()
}

const updateInvoiceState = async (invoice: InvoicePage, newState: string) => {
  const response = await Utils.postEncodedToBackend<{ log: InvoiceLogType }>(
    '/invoices/change-state',
    {
      id: invoice.id,
      state: newState,
    }
  )

  if (!response.success) {
    toast.error('Erreur lors de la mise à jour du statut.')
    return
  }

  await fetchList()
  toast.success('Statut mis à jour avec succès.')
}

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{ invoices: InvoicePage[] }>(
    '/invoices/list',
    {}
  )
  if (response.success) {
    invoices.value = response.data.invoices
  } else {
    toast.error('Erreur lors du chargement des factures.')
  }
}

onMounted(async () => {
  await fetchList()
})

// Filtres
const selectedSort = ref('')
const selectedClients = ref<string[]>([])
const selectedInvoiceNumbers = ref<string[]>([])
const selectedInvoiceNames = ref<string[]>([])
const selectedInvoiceStates = ref<string[]>([])
const amountMin = ref<number | null>(null)
const amountMax = ref<number | null>(null)

const allClients = computed(() => [...new Set(invoices.value.map(i => i.client))])
const invoiceNumbers = computed(() => [...new Set(invoices.value.map(i => i.number))])
const invoiceNames = computed(() => [...new Set(invoices.value.map(i => i.name))])

const applyClientFilter = () => { }
const applyAmountFilter = () => { }
const applyInvoiceStateFilter = () => { }
const applyInvoiceNumberFilter = () => { }
const applyInvoiceNameFilter = () => { }

const filteredInvoices = computed(() => {
  return invoices.value
    .filter((i) => {
      if (selectedClients.value.length > 0 && !selectedClients.value.includes(i.client.id)) return false
      if (selectedInvoiceNumbers.value.length > 0 && !selectedInvoiceNumbers.value.includes(i.number)) return false
      if (selectedInvoiceNames.value.length > 0 && !selectedInvoiceNames.value.includes(i.name)) return false
      if (selectedInvoiceStates.value.length > 0 && !selectedInvoiceStates.value.includes(i.state)) return false
      if (amountMin.value !== null && i.amount < amountMin.value) return false
      if (amountMax.value !== null && i.amount > amountMax.value) return false
      return true
    })
    .sort((a, b) => {
      if (selectedSort.value === 'asc') return a.amount - b.amount
      if (selectedSort.value === 'desc') return b.amount - a.amount
      if (selectedSort.value === 'recent') return new Date(b.logs.at(-1)?.createdAt || 0).getTime() - new Date(a.logs.at(-1)?.createdAt || 0).getTime()
      if (selectedSort.value === 'oldest') return new Date(a.logs.at(-1)?.createdAt || 0).getTime() - new Date(b.logs.at(-1)?.createdAt || 0).getTime()
      return 0
    })
})
</script>

<template>
  <div class="bg-lightBlack p-6 rounded-xl mb-5">
    <div class="mb-5 flex justify-between items-center">
      <div>
        <h3 class="font-semibold mb-1">Dernières factures générées</h3>
        <p class="text-sm">Factures ouvertes & fermées</p>
      </div>
      <button class="btn btn-primary flex items-center" @click="openCreateModal">
        <i class="bx bx-plus pr-2"></i>
        Ajouter une facture
      </button>
    </div>

    <div class="flex flex-wrap gap-4 mt-6 mb-4">
      <SortSelect v-model="selectedSort" />
      <ClientMultiSelect :clients="allClients" v-model="selectedClients" @apply="applyClientFilter" />
      <InvoiceNumberSelect :invoiceNumbers="invoiceNumbers" v-model="selectedInvoiceNumbers"
        @apply="applyInvoiceNumberFilter" />
      <InvoiceNameSelect :invoiceNames="invoiceNames" v-model="selectedInvoiceNames" @apply="applyInvoiceNameFilter" />
      <AmountRangeSelect v-model:min="amountMin" v-model:max="amountMax" @apply="applyAmountFilter" />
      <InvoiceStateSelect :states="invoiceStates" v-model="selectedInvoiceStates" @apply="applyInvoiceStateFilter" />
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-white">
          <th class="py-5">Client</th>
          <th>N°</th>
          <th>Nom</th>
          <th>Montant</th>
          <th>Date dernière action</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="invoice in paginatedItems" :key="invoice.id" class="border-b border-white py-2">
          <td>{{ invoice.client.name }}</td>
          <td class="py-5">{{ invoice.number }}</td>
          <td>{{ invoice.name }}</td>
          <td>{{ invoice.amount }}</td>
          <td>{{ dayjs(invoice.logs.at(-1)?.createdAt).format('DD.MM.YYYY HH:mm:ss') }}</td>
          <td>
            <select v-model="invoice.state" class="rounded px-0 py-1 text-sm font-medium text-gray-100 bg-lightBlack"
              @change="updateInvoiceState(invoice, invoice.state)">
              <option v-for="state in invoiceStates" :key="'state-' + state" :value="state"
                :disabled="state === 'CREATED' || state === 'UPDATED'">
                {{ invoiceStateLabels[state] || state }}
              </option>
            </select>
          </td>
          <td class="space-x-3 text-lg">
            <button class="text-white hover:text-blue-500" title="Voir les détails" @click="openMoreInfoModal(invoice)">
              <i class="bx bx-info-circle"></i>
            </button>
            <button class="text-white hover:text-amber-500" title="Historique des actions"
              @click="openStatusHistory(invoice)">
              <i class="bx bx-line-chart"></i>
            </button>
            <button class="text-white hover:text-yellow-500" title="Modifier" @click="openEditModal(invoice)">
              <i class="bx bxs-pencil"></i>
            </button>
            <button class="text-white hover:text-red-500" title="Supprimer" @click="openDeleteModal(invoice)">
              <i class="bx bx-trash-alt"></i>
            </button>
            <button class="text-white hover:text-red-800" title="Générer un pdf">
              <i class='bx bxs-file-pdf'></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination :items="filteredInvoices" v-model:modelValue="currentPage" :itemsPerPage="8"
      @update:pageItems="(items: InvoicePage[]) => (paginatedItems = items)" />

    <DeleteInvoiceModal :open="isDeleteOpen" :data="selectedInvoice!" @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm" />
    <EditInvoiceModal :open="isEditOpen" :data="selectedInvoice!" @close="isEditOpen = false"
      @submit="handleEditSubmit" />
    <StatusHistoryInvoiceModal :open="isStatusHistoryOpen" :data="selectedInvoice!"
      @close="isStatusHistoryOpen = false" />
    <CreateInvoiceModal :open="isCreateOpen" @close="isCreateOpen = false" @submit="handleCreateSubmit" />
    <MoreInfoInvoiceModal :open="isMoreInfoOpen" :data="selectedInvoice!" @close="isMoreInfoOpen = false" />

  </div>
</template>
