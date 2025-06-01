<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoiceType } from '@/types/InvoiceType.ts'

const props = defineProps<{ open: boolean; data: InvoiceType }>()
const emit = defineEmits(['close', 'confirm'])

const onClose = () => emit('close')

const onConfirm = async () => {
  const response = await Utils.postEncodedToBackend<{ success: boolean }>('/invoices/delete', {
    id: props.data.id,
  })
  if (!response.success) {
    toast.error('Erreur lors de la suppression de la facture : ' + response.error.message)
    return
  }
  emit('confirm')
  toast.success('La facture a été supprimée avec succès !')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="'Êtes-vous sûr de vouloir supprimer la facture ' + data.name + ' ?'"
    description="Cette action est irréversible !"
    @close="onClose"
  >
    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Annuler</button>
      <button @click="onConfirm" class="btn btn-danger">Supprimer</button>
    </template>
  </BaseModal>
</template>
