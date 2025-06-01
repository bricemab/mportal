<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteInvoiceModal from '@/components/Invoices/DeleteInvoiceModal.vue'
import EditInvoiceModal from '@/components/Invoices/EditInvoiceModal.vue'
import MoreInfoInvoiceModal from '@/components/Invoices/MoreInfoInvoiceModal.vue'
import CreateInvoiceModal from '@/components/Invoices/CreateInvoiceModal.vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoicePage } from '@/types/InvoiceType.ts'
import dayjs from 'dayjs'

const invoices = ref<InvoicePage[]>([])

const currentPage = ref(1)
const paginatedItems = ref<InvoicePage[]>([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isMoreInfoOpen = ref(false)
const isCreateOpen = ref(false)

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

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{ invoices: InvoicePage[] }>(
    '/invoices/list',
    {},
  )
  if (response.success) {
    invoices.value = response.data.invoices as InvoicePage[]
  } else {
    toast.error('Erreur lors du chargement des factures.')
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
          <th>N°</th>
          <th>Nom</th>
          <th>Montant</th>
          <th>Date dernière action</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="invoice in paginatedItems as InvoicePage[]"
          :key="invoice.id"
          class="border-b border-white py-2"
        >
          <td>{{ invoice.client.name }}</td>
          <td class="py-5">{{ invoice.number }}</td>
          <td>{{ invoice.name }}</td>
          <td>{{ invoice.amount }}</td>
          <td>
            {{
              dayjs(invoice.logs[invoice.logs.length - 1].createdAt).format('DD.MM.YYYY HH:mm:ss')
            }}
          </td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-blue-500"
              title="Voir les détails"
              @click="openMoreInfoModal(invoice)"
            >
              <i class="bx bx-line-chart"></i>
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
