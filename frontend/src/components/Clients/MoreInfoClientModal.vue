<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import type { ClientType } from '@/types/ClientType.ts'

defineProps<{
  open: boolean
  data: ClientType
}>()

const emit = defineEmits(['close'])
const onClose = () => emit('close')
</script>

<template>
  <BaseModal :open="open" title="Informations complète du client" @close="onClose">
    <div class="space-y-2">
      <p><strong>Nom :</strong> {{ data.firstname + ' ' + data.lastname }}</p>
      <p><strong>Entreprise :</strong> {{ data.name }}</p>
      <p><strong>Email :</strong> {{ data.email }}</p>
      <p>
        <strong>Adresse :</strong>
        {{ data.address + ' ' + data.addressNumber + ', ' + data.postalCode + ', ' + data.city }}
      </p>
      <p><strong>Téléphone :</strong> {{ data.phoneNumber }}</p>
      <p>
        <strong>Remarque :</strong><br /><span v-html="data.remark?.replace(/\n/g, '<br>')"></span>
      </p>
    </div>

    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Fermer</button>
    </template>
  </BaseModal>
</template>
