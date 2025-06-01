<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import type { InvoiceType } from '@/types/InvoiceType.ts'

const props = defineProps<{ open: boolean; data: InvoiceType }>()
const emit = defineEmits(['close'])

const onClose = () => emit('close')
</script>

<template>
  <BaseModal :open="open" title="Informations complètes de la facture" @close="onClose">
    <div class="space-y-2">
      <p><strong>Nom :</strong> {{ data.name }}</p>
      <p><strong>ID Client :</strong> {{ data.clientId }}</p>
      <p><strong>ID Service :</strong> {{ data.serviceId }}</p>
      <p><strong>Quantité :</strong> {{ data.quantity }}</p>
      <p><strong>Montant :</strong> {{ data.amount }}</p>
      <p><strong>État :</strong> {{ data.state }}</p>
      <p><strong>Créée le :</strong> {{ data.createdAt }}</p>
      <p><strong>Modifiée le :</strong> {{ data.updatedAt }}</p>
    </div>

    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Fermer</button>
    </template>
  </BaseModal>
</template>
