<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ThePagination from '@/components/ThePagination.vue'

import DeleteServiceModal from '@/components/Services/DeleteServiceModal.vue'
import EditServiceModal from '@/components/Services/EditServiceModal.vue'
import MoreInfoServiceModal from '@/components/Services/MoreInfoServiceModal.vue'
import CreateServiceModal from '@/components/Services/CreateServiceModal.vue'
import type { ServiceType } from '@/types/ServicesType.ts'
import Utils from '@/utils/Utils.ts'

const services = ref<ServiceType[]>([])

const currentPage = ref(1)
const paginatedItems = ref<ServiceType[]>([])

const isDeleteOpen = ref(false)
const isEditOpen = ref(false)
const isMoreInfoOpen = ref(false)
const isCreateOpen = ref(false)

const selectedService = ref<ServiceType | null>(null)

function openCreateModal() {
  selectedService.value = null
  isCreateOpen.value = true
}

function openDeleteModal(service: ServiceType) {
  selectedService.value = service
  isDeleteOpen.value = true
}

function openEditModal(service: ServiceType) {
  selectedService.value = service
  isEditOpen.value = true
}

function openMoreInfoModal(service: ServiceType) {
  selectedService.value = service
  isMoreInfoOpen.value = true
}

function handleDeleteConfirm() {
  if (selectedService.value) {
    services.value = services.value.filter((c) => c.id !== selectedService.value!.id)
  }
  isDeleteOpen.value = false
  selectedService.value = null
}

function handleEditSubmit(updatedService: ServiceType) {
  if (!updatedService) return
  const index = services.value.findIndex((c) => c.id === updatedService.id)
  if (index !== -1) {
    services.value[index] = { ...updatedService }
  }
  isEditOpen.value = false
  selectedService.value = null
}

function handleCreateSubmit(newService: ServiceType) {
  if (!newService) return
  services.value.push(newService)
  isCreateOpen.value = false
}

const fetchList = async () => {
  const response = await Utils.postEncodedToBackend<{ services: ServiceType[] }>('/services/list', {})
  if (response.success) {
    services.value = response.data.services as ServiceType[]
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
        <h3 class="font-semibold mb-1">Tous les services</h3>
        <p class="text-sm">Services actifs</p>
      </div>
      <button class="btn btn-primary flex items-center" @click="openCreateModal">
        <i class="bx bx-plus pr-2"></i>
        Ajouter un service
      </button>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-white">
          <th class="py-5">Nom du service</th>
          <th>Description</th>
          <th>Type de facturation</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="service in paginatedItems as ServiceType[]"
          :key="service.id"
          class="border-b border-white py-2"
        >
          <td>{{ service.name }}</td>
          <td class="py-5">{{ service.description }}</td>
          <td>{{ service.serviceType }}</td>
          <td class="space-x-3 text-lg">
            <button
              class="text-white hover:text-yellow-500"
              title="Modifier"
              @click="openEditModal(service)"
            >
              <i class="bx bxs-pencil"></i>
            </button>
            <button
              class="text-white hover:text-red-500"
              title="Supprimer"
              @click="openDeleteModal(service)"
            >
              <i class="bx bx-trash-alt"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ThePagination
      :items="services"
      v-model:modelValue="currentPage"
      :itemsPerPage="8"
      @update:pageItems="(items: ServiceType[]) => (paginatedItems = items)"
    />

    <DeleteServiceModal
      :open="isDeleteOpen"
      :data="selectedService!"
      @close="isDeleteOpen = false"
      @confirm="handleDeleteConfirm"
    />

    <EditServiceModal
      :open="isEditOpen"
      :data="selectedService!"
      @close="isEditOpen = false"
      @submit="handleEditSubmit"
    />

    <CreateServiceModal
      :open="isCreateOpen"
      @close="isCreateOpen = false"
      @submit="handleCreateSubmit"
    />
  </div>
</template>
