<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { MaintenanceContractType } from '@/types/MaintenanceContractType.ts'

const props = defineProps<{ open: boolean; data: MaintenanceContractType }>()
const emit = defineEmits(['close', 'confirm'])

const onClose = () => emit('close')

const onConfirm = async () => {
  const response = await Utils.postEncodedToBackend<{
    maintenanceContracts: MaintenanceContractType[]
  }>('/maintenance-contracts/delete', { id: props.data.id })
  if (response.success) {
    toast.success('Le contrat de maintenance a été supprimé avec succès !')
  } else {
    Utils.handlerError(response.error)
  }
  emit('confirm')
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="'Êtes-vous sûr de vouloir supprimer le contrat ' + data?.name + ' ?'"
    description="Cette action est irréversible !"
    @close="onClose"
  >
    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Annuler</button>
      <button @click="onConfirm" class="btn btn-danger">Supprimer</button>
    </template>
  </BaseModal>
</template>
