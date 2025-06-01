<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { reactive, watch, ref, onMounted } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoiceType } from '@/types/InvoiceType.ts'
import type { ClientType } from '@/types/ClientType.ts'
import type { ServiceType } from '@/types/ServiceType.ts'

const props = defineProps<{ open: boolean; data: InvoiceType }>()
const emit = defineEmits(['close', 'submit'])

const invoice = reactive({ ...props.data })

const clients = ref<ClientType[]>([])
const services = ref<ServiceType[]>([])

const fetchOptions = async () => {}

onMounted(fetchOptions)

watch(
  () => props.data,
  (val) => Object.assign(invoice, val),
)

const onClose = () => emit('close')

const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ invoice: InvoiceType }>(
    '/invoices/edit',
    invoice,
  )
  if (!response.success) {
    toast.error('Erreur lors de la modification de la facture : ' + response.error.message)
    return
  }
  emit('submit', response.data.invoice)
  toast.success('La facture a été modifiée avec succès !')
}
</script>

<template>
  <BaseModal :open="open" title="Modifier la facture" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="invoice.name" required placeholder="Nom de la facture" class="custom-input" />

      <select v-model="invoice.clientId" required class="custom-input">
        <option disabled value="0">Sélectionnez un client</option>
        <option v-for="client in clients" :key="client.id" :value="client.id">
          {{ client.firstname }} {{ client.lastname }} ({{ client.name }})
        </option>
      </select>

      <select v-model="invoice.serviceId" required class="custom-input">
        <option disabled value="0">Sélectionnez un service</option>
        <option v-for="service in services" :key="service.id" :value="service.id">
          {{ service.name }}
        </option>
      </select>

      <input
        v-model.number="invoice.quantity"
        required
        placeholder="Quantité"
        class="custom-input"
      />
      <input v-model.number="invoice.amount" required placeholder="Montant" class="custom-input" />

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Sauvegarder</button>
      </div>
    </form>
  </BaseModal>
</template>
