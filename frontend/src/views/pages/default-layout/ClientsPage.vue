<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteClientModal from '@/components/Clients/DeleteClientModal.vue'
import EditClientModal from '@/components/Clients/EditClientModal.vue'
import MoreInfoClientModal from '@/components/Clients/MoreInfoClientModal.vue'
import CreateClientModal from '@/components/Clients/CreateClientModal.vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'

const clients = ref<ClientType[]>([])

const currentPage = ref(1)
const paginatedItems = ref<ClientType[]>([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isMoreInfoOpen = ref(false)
const isCreateOpen = ref(false)

const selectedClient = ref<ClientType | null>(null)

function openCreateModal() {
  selectedClient.value = null
  isCreateOpen.value = true
}

function openDeleteModal(client: ClientType) {
  selectedClient.value = client
  isDeleteOpen.value = true
}

function openEditModal(client: ClientType) {
  selectedClient.value = client
  isEditOpen.value = true
}

function openMoreInfoModal(client: ClientType) {
  selectedClient.value = client
  isMoreInfoOpen.value = true
}

function handleDeleteConfirm() {
  if (selectedClient.value) {
    clients.value = clients.value.filter((c) => c.id !== selectedClient.value!.id)
  }
  isDeleteOpen.value = false
  selectedClient.value = null
}

function handleEditSubmit(updatedClient: ClientType) {
  if (!updatedClient) return
  const index = clients.value.findIndex((c) => c.id === updatedClient.id)
  if (index !== -1) {
    clients.value[index] = { ...updatedClient }
  }
  isEditOpen.value = false
  selectedClient.value = null
}

function handleCreateSubmit(newClient: ClientType) {
  if (!newClient) return
  clients.value.push(newClient)
  isCreateOpen.value = false
}

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{ clients: ClientType[] }>('/clients/list', {})
  if (response.success) {
    clients.value = response.data.clients as ClientType[]
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
        <h3 class="font-semibold mb-1">Tous les clients</h3>
        <p class="text-sm">Clients actifs</p>
      </div>
      <button class="btn btn-primary flex items-center" @click="openCreateModal">
        <i class="bx bx-plus pr-2"></i>
        Ajouter un client
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-white">
          <th class="py-5">Entreprise</th>
          <th>Nom du client</th>
          <th>Numéro de tél.</th>
          <th>E-mail</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="client in paginatedItems as ClientType[]"
          :key="client.id"
          class="border-b border-white py-2"
        >
          <td>{{ client.name }}</td>
          <td class="py-5">{{ client.firstname + ' ' + client.lastname }}</td>
          <td>{{ client.phoneNumber }}</td>
          <td>{{ client.email }}</td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-blue-500"
              title="Voir les détails"
              @click="openMoreInfoModal(client)"
            >
              <i class="bx bx-info-circle"></i>
            </button>
            <button
              class="text-white hover:text-yellow-500"
              title="Modifier"
              @click="openEditModal(client)"
            >
              <i class="bx bxs-pencil"></i>
            </button>
            <button
              class="text-white hover:text-red-500"
              title="Supprimer"
              @click="openDeleteModal(client)"
            >
              <i class="bx bx-trash-alt"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination
      :items="clients"
      v-model:modelValue="currentPage"
      :itemsPerPage="8"
      @update:pageItems="(items: ClientType[]) => (paginatedItems = items)"
    />

    <DeleteClientModal
      :open="isDeleteOpen"
      :data="selectedClient!"
      @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm"
    />

    <EditClientModal
      :open="isEditOpen"
      :data="selectedClient!"
      @close="isEditOpen = false"
      @submit="handleEditSubmit"
    />

    <MoreInfoClientModal
      :open="isMoreInfoOpen"
      :data="selectedClient!"
      @close="isMoreInfoOpen = false"
    />

    <CreateClientModal
      :open="isCreateOpen"
      @close="isCreateOpen = false"
      @submit="handleCreateSubmit"
    />
  </div>
</template>
