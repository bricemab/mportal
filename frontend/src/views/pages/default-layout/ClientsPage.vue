<script setup lang="ts">
import { ref } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteClientModal from '@/components/Clients/DeleteClientModal.vue'
import EditClientModal from '@/components/Clients/EditClientModal.vue'
import MoreInfoClientModal from '@/components/Clients/MoreInfoClientModal.vue'
import CreateClientModal from '@/components/Clients/CreateClientModal.vue'

const factures = ref([
  { id: 1, nom: '1', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 2, nom: '2', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 3, nom: '3', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 4, nom: '4', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 5, nom: '5', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 6, nom: '6', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 7, nom: '7', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 8, nom: '8', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 9, nom: '9', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
  { id: 10, nom: '10', company: 'Maxime Burri', tel: '+41', email: 'test@gmail.com' },
])

const currentPage = ref(1)
const paginatedItems = ref([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isMoreInfoOpen = ref(false)
const isCreateOpen = ref(false)

const selectedClient = ref(null)

function openCreateModal() {
  selectedClient.value = null
  isCreateOpen.value = true
}

function openDeleteModal(client) {
  selectedClient.value = client
  isDeleteOpen.value = true
}

function openEditModal(client) {
  selectedClient.value = client
  isEditOpen.value = true
}

function openMoreInfoModal(client) {
  selectedClient.value = client
  isMoreInfoOpen.value = true
}

function handleDeleteConfirm() {
  if (selectedClient.value) {
    factures.value = factures.value.filter(c => c.id !== selectedClient.value.id)
  }
  isDeleteOpen.value = false
  selectedClient.value = null
}

function handleEditSubmit(updatedClient) {
  if (!updatedClient) return
  const index = factures.value.findIndex(c => c.id === updatedClient.id)
  if (index !== -1) {
    factures.value[index] = { ...updatedClient }
  }
  isEditOpen.value = false
  selectedClient.value = null
}

function handleCreateSubmit(newClient) {
  if (!newClient) return
  newClient.id = factures.value.length + 1
  factures.value.push(newClient)
  isCreateOpen.value = false
}

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
          <th class="py-5">Nom du client</th>
          <th>Entreprise</th>
          <th>Numéro de tél.</th>
          <th>E-mail</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="facture in paginatedItems" :key="facture.id" class="border-b border-white py-2">
          <td class="py-5">{{ facture.nom }}</td>
          <td>{{ facture.company }}</td>
          <td>{{ facture.tel }}</td>
          <td>{{ facture.email }}</td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-blue-500"
              title="Voir les détails"
              @click="openMoreInfoModal(facture)"
            >
              <i class="bx bx-info-circle"></i>
            </button>
            <button
              class="text-white hover:text-yellow-500"
              title="Modifier"
              @click="openEditModal(facture)"
            >
              <i class="bx bxs-pencil"></i>
            </button>
            <button
              class="text-white hover:text-red-500"
              title="Supprimer"
              @click="openDeleteModal(facture)"
            >
              <i class="bx bx-trash-alt"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination
      :items="factures"
      v-model:modelValue="currentPage"
      :itemsPerPage="8"
      @update:pageItems="paginatedItems = $event"
    />

    <!-- Modals -->
    <DeleteClientModal
      :open="isDeleteOpen"
      @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm"
    />

    <EditClientModal
      :open="isEditOpen"
      :data="selectedClient"
      @close="isEditOpen = false"
      @submit="handleEditSubmit"
    />

    <MoreInfoClientModal
      :open="isMoreInfoOpen"
      :data="selectedClient"
      @close="isMoreInfoOpen = false"
    />

    <CreateClientModal
      :open="isCreateOpen"
      @close="isCreateOpen = false"
      @submit="handleCreateSubmit"
    />
  </div>
</template>
