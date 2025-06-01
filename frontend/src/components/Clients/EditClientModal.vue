<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { reactive, watch } from 'vue'
import type { ClientType } from '@/types/ClientType'
import Utils from '@/utils/Utils.ts'

const props = defineProps<{
  open: boolean
  data: ClientType
}>()

const emit = defineEmits(['close', 'submit'])

const client = reactive({ ...props.data })

watch(
  () => props.data,
  (val) => Object.assign(client, val),
)

const onClose = () => emit('close')
const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ client: ClientType }>('/clients/edit', client)
  if (!response.success) {
    return alert('Erreur lors de la modification du client : ' + response.error.message)
  }
  emit('submit', response.data.client)
}
</script>

<template>
  <BaseModal :open="open" title="Créer un nouveau client" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="client.lastname" required placeholder="Nom" class="custom-input" />
      <input v-model="client.firstname" required placeholder="Prénom" class="custom-input" />
      <input v-model="client.name" required placeholder="Entreprise" class="custom-input" />
      <input v-model="client.email" placeholder="Email" class="custom-input" />
      <input v-model="client.phoneNumber" placeholder="Téléphone" class="custom-input" />
      <input v-model="client.remark" placeholder="Remarque" class="custom-input" />

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Sauvegarder</button>
      </div>
    </form>
  </BaseModal>
</template>
