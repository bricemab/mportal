<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { MaintenanceContractType } from '@/types/MaintenanceContractType.ts'
import dayjs from 'dayjs'

const props = defineProps<{
  open: boolean
  data: MaintenanceContractType | null
}>()
const emit = defineEmits(['close', 'submit'])

const renewalData = ref({
  name: '',
  totalHours: 0,
  price: 0,
  contractPath: '',
  startDate: '',
  endDate: '',
})

watch(
  () => [props.open, props.data] as const,
  ([isOpen, contract]) => {
    if (isOpen && contract && contract !== null) {
      // Préremplir avec les données du contrat existant
      renewalData.value = {
        name: contract.name,
        totalHours: contract.totalHours,
        price: contract.price,
        contractPath: contract.path,
        // La date de début est la date de fin du contrat actuel
        startDate: dayjs(contract.endAt).format('YYYY-MM-DD'),
        // La date de fin est un an après la date de début
        endDate: dayjs(contract.endAt).add(1, 'year').format('YYYY-MM-DD'),
      }
    }
  },
  { immediate: true },
)

const onClose = () => emit('close')

const onSubmit = async () => {
  if (!props.data) return

  // Option 1: Utiliser la route /create existante (comme demandé initialement)
  const payload = {
    name: renewalData.value.name,
    clientId: props.data.client.id,
    totalHours: Number(renewalData.value.totalHours),
    price: Number(renewalData.value.price),
    contractPath: renewalData.value.contractPath,
    startDate: renewalData.value.startDate,
    endDate: renewalData.value.endDate,
  }

  const response = await Utils.postEncodedToBackend('/maintenance-contracts/create', payload)

  // Option 2: Utiliser la nouvelle route /renew dédiée (décommenter si préféré)
  // const payload = {
  //   originalContractId: props.data.id,
  //   name: renewalData.value.name,
  //   totalHours: Number(renewalData.value.totalHours),
  //   price: Number(renewalData.value.price),
  //   contractPath: renewalData.value.contractPath,
  //   startDate: renewalData.value.startDate,
  //   endDate: renewalData.value.endDate,
  // }
  // const response = await Utils.postEncodedToBackend('/maintenance-contracts/renew', payload)

  if (response.success) {
    toast.success('Le contrat de maintenance a été renouvelé avec succès !')
  } else {
    Utils.handlerError(response.error)
  }

  emit('submit')
}
</script>

<template>
  <BaseModal :open="open" title="Renouveler le contrat de maintenance" @close="onClose" size="xl">
    <form
      @submit.prevent="onSubmit"
      class="max-h-[90vh] overflow-hidden p-4 space-y-4 flex flex-col"
    >
      <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
        <p class="text-sm text-blue-400">
          <i class="bx bx-info-circle mr-2"></i>
          Renouvellement du contrat pour le client:
          <strong
            >{{ data?.client.name }} ({{ data?.client.firstname }}
            {{ data?.client.lastname }})</strong
          >
        </p>
      </div>

      <input
        v-model="renewalData.name"
        required
        placeholder="Nom du contrat"
        class="custom-input w-full"
      />

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Nombre d'heures total</label>
          <input
            v-model.number="renewalData.totalHours"
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
            v-model.number="renewalData.price"
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
          v-model="renewalData.contractPath"
          required
          placeholder="Ex: C:\contrats\contrat_client_renouvelé.pdf"
          class="custom-input w-full"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Date de début</label>
          <input v-model="renewalData.startDate" type="date" required class="custom-input w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Date de fin</label>
          <input v-model="renewalData.endDate" type="date" required class="custom-input w-full" />
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">
          <i class="bx bx-refresh mr-2"></i>
          Renouveler le contrat
        </button>
      </div>
    </form>
  </BaseModal>
</template>
