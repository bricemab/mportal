<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteInvoiceModal from '@/components/Invoices/DeleteInvoiceModal.vue'
import EditInvoiceModal from '@/components/Invoices/EditInvoiceModal.vue'
import MoreInfoInvoiceModal from '@/components/Invoices/MoreInfoInvoiceModal.vue'
import CreateInvoiceModal from '@/components/Invoices/CreateInvoiceModal.vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'
import type { InvoiceServiceType } from '@/types/InvoiceServiceType.ts'
import type { InvoiceLogType } from '@/types/InvoiceLogType.ts'

interface Invoice {
  id: number
  name: string
  amount: number
  logs: InvoiceLogType[]
  services: InvoiceServiceType[]
  client: ClientType
  createdAt: string
  updatedAt: string
}

const invoices = ref<Invoice[]>([])

const currentPage = ref(1)
const paginatedItems = ref<Invoice[]>([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isMoreInfoOpen = ref(false)
const isCreateOpen = ref(false)

const selectedInvoice = ref<Invoice | null>(null)

function openCreateModal() {
  selectedInvoice.value = null
  isCreateOpen.value = true
}

function openDeleteModal(invoice: Invoice) {
  selectedInvoice.value = invoice
  isDeleteOpen.value = true
}

function openEditModal(invoice: Invoice) {
  selectedInvoice.value = invoice
  isEditOpen.value = true
}

function openMoreInfoModal(invoice: Invoice) {
  selectedInvoice.value = invoice
  isMoreInfoOpen.value = true
}

function handleDeleteConfirm() {
  if (selectedInvoice.value) {
    invoices.value = invoices.value.filter((c) => c.id !== selectedInvoice.value!.id)
  }
  isDeleteOpen.value = false
  selectedInvoice.value = null
}

function handleEditSubmit(updatedClient: ClientType) {
  if (!updatedClient) return
  const index = invoices.value.findIndex((c) => c.id === updatedClient.id)
  if (index !== -1) {
    invoices.value[index] = { ...updatedClient }
  }
  isEditOpen.value = false
  selectedInvoice.value = null
}

function handleCreateSubmit(newClient: ClientType) {
  if (!newClient) return
  invoices.value.push(newClient)
  isCreateOpen.value = false
}

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{ invoices: Invoice[] }>('/invoices/list', {})
  if (response.success) {
    invoices.value = response.data.invoices as Invoice[]
  } else {
    Utils.handlerError(response.error)
  }
}

onMounted(async () => {
  await fetchList()
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

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-white">
          <th class="py-5">Client</th>
          <th>Nom</th>
          <th>Montant</th>
          <th>Date</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="invoice in paginatedItems as Invoice[]"
          :key="invoice.id"
          class="border-b border-white py-2"
        >
          <td>{{ invoice.client.name }}</td>
          <td class="py-5">{{ invoice.name }}</td>
          <td>{{ invoice.amount }}</td>
          <td>{{ invoice.logs[invoice.logs.length - 1].createdAt }}</td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-blue-500"
              title="Voir les détails"
              @click="openMoreInfoModal(invoice)"
            >
              <i class="bx bx-info-circle"></i>
            </button>
            <button
              class="text-white hover:text-yellow-500"
              title="Modifier"
              @click="openEditModal(invoice)"
            >
              <i class="bx bxs-pencil"></i>
            </button>
            <button
              class="text-white hover:text-red-500"
              title="Supprimer"
              @click="openDeleteModal(invoice)"
            >
              <i class="bx bx-trash-alt"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination
      :items="invoices"
      v-model:modelValue="currentPage"
      :itemsPerPage="8"
      @update:pageItems="(items: ClientType[]) => (paginatedItems = items)"
    />

    <DeleteInvoiceModal
      :open="isDeleteOpen"
      :data="selectedInvoice!"
      @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm"
    />

    <EditInvoiceModal
      :open="isEditOpen"
      :data="selectedInvoice!"
      @close="isEditOpen = false"
      @submit="handleEditSubmit"
    />

    <MoreInfoInvoiceModal
      :open="isMoreInfoOpen"
      :data="selectedInvoice!"
      @close="isMoreInfoOpen = false"
    />

    <CreateInvoiceModal
      :open="isCreateOpen"
      @close="isCreateOpen = false"
      @submit="handleCreateSubmit"
    />
  </div>
</template>
