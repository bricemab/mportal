<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'

const props = defineProps<{
  open: boolean
  data: ClientType
}>()

const emit = defineEmits(['close', 'confirm'])

const onClose = () => emit('close')
const onConfirm = async () => {
  const response = await Utils.postEncodedToBackend<{ success: boolean }>('/clients/delete', {
    id: props.data.id,
  })
  if (!response.success) {
    return toast.error('Erreur lors de la suppression du client : ' + response.error.message)
  }
  emit('confirm')
  toast.success('Le client a été supprimé avec succès !')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="'Êtes-vous sûr de vouloir supprimer ' + data.name + ' ?'"
    description="Cette action est irréversible !"
    @close="onClose"
  >
    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Annuler</button>
      <button @click="onConfirm" class="btn btn-danger">Supprimer</button>
    </template>
  </BaseModal>
</template>
