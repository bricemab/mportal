<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref } from 'vue'
import type { ClientType } from '@/types/ClientType.ts'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'submit'])

const client = ref({
  name: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
  email: '',
  remark: '',
  address: '',
  addressNumber: '',
  postalCode: '',
  city: '',
})

const onClose = () => emit('close')
const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ client: ClientType }>(
    '/clients/create',
    client.value,
  )
  if (!response.success) {
    return toast.error('Erreur lors de la création du client : ' + response.error.message)
  }
  emit('submit', response.data.client)
  toast.success('Le client a été créé avec succès !')
}
</script>

<template>
  <BaseModal :open="open" title="Créer un nouveau client" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="client.lastname" required placeholder="Nom" class="custom-input" />
      <input v-model="client.firstname" required placeholder="Prénom" class="custom-input" />
      <input v-model="client.name" required placeholder="Entreprise" class="custom-input" />
      <div class="w-full flex space-x-3">
        <input v-model="client.address" placeholder="Adresse" class="custom-input w-3/4" />
        <input v-model="client.addressNumber" placeholder="Numéro" class="custom-input w-1/4" />
      </div>
      <div class="w-full flex space-x-3">
        <input v-model="client.postalCode" placeholder="NPA" class="custom-input w-1/2" />
        <input v-model="client.city" placeholder="Localité" class="custom-input w-1/2" />
      </div>
      <input v-model="client.email" placeholder="Email" class="custom-input" />
      <input v-model="client.phoneNumber" placeholder="Téléphone" class="custom-input" />
      <textarea v-model="client.remark" placeholder="Remarque" class="custom-input h-24"></textarea>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Sauvegarder</button>
      </div>
    </form>
  </BaseModal>
</template>
