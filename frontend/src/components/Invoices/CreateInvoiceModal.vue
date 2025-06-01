<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoiceType } from '@/types/InvoiceType.ts'
import type { ClientType } from '@/types/ClientType.ts'
import type { ServiceType } from '@/types/ServiceType.ts'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['close', 'submit'])

const invoice = ref({
  name: '',
  clientId: 0,
  serviceId: 0,
  quantity: 1,
  amount: 0,
})

const clients = ref<ClientType[]>([])
const services = ref<ServiceType[]>([])

const fetchOptions = async () => {
  const [clientRes, serviceRes] = await Promise.all([
    Utils.postEncodedToBackend<ClientType[]>('/clients'),
    Utils.postEncodedToBackend<ServiceType[]>('/services'),
  ])

  if (clientRes.success) {
    clients.value = clientRes.data
  } else {
    toast.error('Erreur lors du chargement des clients.')
  }

  if (serviceRes.success) {
    services.value = serviceRes.data
  } else {
    toast.error('Erreur lors du chargement des services.')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) fetchOptions()
  },
  { immediate: true }
)

const onClose = () => emit('close')

const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ invoice: InvoiceType }>(
    '/invoices/create',
    invoice.value
  )
  if (!response.success) {
    toast.error('Erreur lors de la création de la facture : ' + response.error.message)
    return
  }
  emit('submit', response.data.invoice)
  toast.success('La facture a été créée avec succès !')
}
</script>

<template>
  <BaseModal :open="open" title="Créer une nouvelle facture" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="invoice.name" required placeholder="Nom de la facture" class="custom-input" />

      <select v-model="invoice.clientId" required class="custom-input">
        <option disabled value="0">Sélectionnez un client</option>
        <option v-if="clients.length === 0" disabled>Aucun client disponible</option>
        <option v-for="client in clients" :key="client.id" :value="client.id">
          {{ client.firstname }} {{ client.lastname }} ({{ client.name }})
        </option>
      </select>

      <select v-model="invoice.serviceId" required class="custom-input">
        <option disabled value="0">Sélectionnez un service</option>
        <option v-if="services.length === 0" disabled>Aucun service disponible</option>
        <option v-for="service in services" :key="service.id" :value="service.id">
          {{ service.name }}
        </option>
      </select>

      <input v-model.number="invoice.quantity" type="number" min="1" required placeholder="Quantité"
        class="custom-input" />

      <input v-model.number="invoice.amount" type="number" min="0" step="0.01" required placeholder="Montant"
        class="custom-input" />

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Sauvegarder</button>
      </div>
    </form>
  </BaseModal>
</template>
