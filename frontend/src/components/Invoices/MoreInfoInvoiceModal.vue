<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch, computed } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoicePage } from '@/types/InvoiceType.ts'
import type { ServiceType } from '@/types/ServiceType.ts'

const props = defineProps<{
  open: boolean
  data: InvoicePage
}>()

const emit = defineEmits(['close'])
const onClose = () => emit('close')

// Liste des services chargée depuis backend
const services = ref<ServiceType[]>([])

// Fonction pour charger les services
const fetchServices = async () => {
  const res = await Utils.postEncodedToBackend<{ services: ServiceType[] }>('/services/list')
  if (res.success && res.data) {
    services.value = res.data.services
  } else {
    toast.error('Erreur lors du chargement des services.')
  }
}

// Charger les services à l'ouverture de la modal
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) fetchServices()
  },
  { immediate: true }
)

// Fonction utilitaire pour retrouver le nom du service via son id
const getServiceName = (serviceId: number) => {
  const service = services.value.find(s => s.id === serviceId)
  return service ? service.name : 'Service inconnu'
}

// Calculer le total si data.total est null ou indéfini
const computedTotal = computed(() => {
  if (props.data.total != null) {
    return props.data.total
  }
  if (!props.data.services) return 0
  return props.data.services.reduce((acc, s) => acc + s.amount * s.quantity, 0)
})
</script>

<template>
  <BaseModal :open="open" title="Informations complète de la facture" @close="onClose" size="lg">
    <div class="space-y-3">
      <p><strong>Nom de la facture :</strong> {{ data.name }}</p>

      <p>
        <strong>Client :</strong>
        {{ data.client ? (data.client.name + ' (' + data.client.firstname + ' ' + data.client.lastname + ')') : 'Non renseigné' }}
      </p>

      <p><strong>Date de création :</strong> {{ new Date(data.createdAt).toLocaleDateString() }}</p>
      <p><strong>Date d'échéance :</strong> {{ data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'Non renseignée' }}</p>

      <div>
        <strong>Services facturés :</strong>
        <ul class="list-inside max-h-48 overflow-auto">
          <li v-for="(serviceLine, index) in data.services" :key="index">
            {{ getServiceName(serviceLine.serviceId) }} - Quantité : {{ serviceLine.quantity }} - Prix unitaire : {{ serviceLine.amount.toFixed(2) }} CHF
          </li>
          <li v-if="!data.services || data.services.length === 0">Aucun service facturé.</li>
        </ul>
      </div>

      <p><strong>Total :</strong> {{ computedTotal.toFixed(2) }} CHF</p>
    </div>

    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Fermer</button>
    </template>
  </BaseModal>
</template>