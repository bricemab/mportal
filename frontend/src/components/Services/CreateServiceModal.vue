<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref } from 'vue'
import { ServiceTypeType } from '@/types/ServiceType.ts'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify';

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'submit'])

const service = ref({
  name: '',
  description: '',
  type: '',
})

const serviceTypes = [
  { value: ServiceTypeType.YEARLY, label: 'Annuel' },
  { value: ServiceTypeType.MONTHLY, label: 'Mensuel' },
  { value: ServiceTypeType.UNIQUE, label: 'Unique' },
]

const onClose = () => emit('close')

const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ service: ServiceType }>(
    '/services/create',
    service.value,
  )
  if (!response.success) {
    toast.error("Erreur lors de la création du service : " + response.error.message);
  }
  emit('submit', response.data.service)
  toast.success("Le service a été créé avec succès !");
}
</script>

<template>
  <BaseModal :open="open" title="Créer un nouveau service" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="service.name" required placeholder="Nom" class="custom-input" />
      <input
        v-model="service.description"
        required
        placeholder="Description"
        class="custom-input"
      />

      <select v-model="service.type" required class="custom-input">
        <option disabled value="">Sélectionnez un type</option>
        <option v-for="option in serviceTypes" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Sauvegarder</button>
      </div>
    </form>
  </BaseModal>
</template>
