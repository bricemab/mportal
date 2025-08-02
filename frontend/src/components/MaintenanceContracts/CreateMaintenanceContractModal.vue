<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { ClientType } from '@/types/ClientType.ts'
import dayjs from 'dayjs'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['close', 'submit'])

const contract = ref({
  name: '',
  clientId: 0,
  totalHours: 0,
  price: 0,
  contractPath: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
})

const clients = ref<ClientType[]>([])

const fetchClients = async () => {
  const response = await Utils.postEncodedToBackend<{ clients: ClientType[] }>('/clients/list', {})
  if (response.success) {
    clients.value = response.data.clients as ClientType[]
  } else {
    Utils.handlerError(response.error)
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      fetchClients()
      // Reset form
      contract.value = {
        name: '',
        clientId: 0,
        totalHours: 0,
        price: 0,
        contractPath: '',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
      }
    }
  },
  { immediate: true },
)

const onClose = () => emit('close')

const onSubmit = async () => {
  const payload = {
    name: contract.value.name,
    clientId: Number(contract.value.clientId),
    totalHours: Number(contract.value.totalHours),
    price: Number(contract.value.price),
    contractPath: contract.value.contractPath,
    startDate: contract.value.startDate,
    endDate: contract.value.endDate,
  }

  const response = await Utils.postEncodedToBackend('/maintenance-contracts/create', payload)
  if (response.success) {
    toast.success('Le contrat de maintenance a été créé avec succès !')
  } else {
    Utils.handlerError(response.error)
  }

  emit('submit')
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Créer un nouveau contrat de maintenance"
    @close="onClose"
    size="xl"
  >
    <form
      @submit.prevent="onSubmit"
      class="max-h-[90vh] overflow-hidden p-4 space-y-4 flex flex-col"
    >
      <input
        v-model="contract.name"
        required
        placeholder="Nom du contrat"
        class="custom-input w-full"
      />

      <select v-model="contract.clientId" required class="custom-input w-full">
        <option disabled value="0">Sélectionnez un client</option>
        <option v-if="clients.length === 0" disabled>Aucun client disponible</option>
        <option v-for="client in clients" :key="client.id" :value="client.id">
          {{ client.name }} ({{ client.firstname }} {{ client.lastname }})
        </option>
      </select>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Nombre d'heures total</label>
          <input
            v-model.number="contract.totalHours"
            type="number"
            min="1"
            required
            placeholder="Ex: 40"
            class="custom-input w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Prix (CHF)</label>
          <input
            v-model.number="contract.price"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="Ex: 4000.00"
            class="custom-input w-full"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium mb-2">Chemin vers le contrat</label>
        <input
          v-model="contract.contractPath"
          placeholder="Ex: C:\contrats\contrat_client.pdf"
          class="custom-input w-full"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Date de début</label>
          <input v-model="contract.startDate" type="date" required class="custom-input w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Date de fin</label>
          <input v-model="contract.endDate" type="date" required class="custom-input w-full" />
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer le contrat</button>
      </div>
    </form>
  </BaseModal>
</template>
