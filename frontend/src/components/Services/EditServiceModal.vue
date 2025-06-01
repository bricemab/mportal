<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { reactive, watch } from 'vue'
import { ServiceType } from '@/types/ServiceType'
import Utils from '@/utils/Utils.ts'

const props = defineProps<{
  open: boolean
  data: ServiceType
}>()

const emit = defineEmits(['close', 'submit'])

const service = reactive({ ...props.data })

watch(
  () => props.data,
  (val) => Object.assign(service, val),
)

const serviceTypes = [
  { value: ServiceType.YEARLY, label: 'Annuel' },
  { value: ServiceType.MONTHLY, label: 'Mensuel' },
  { value: ServiceType.UNIQUE, label: 'Unique' },
]

const onClose = () => emit('close')

const onSubmit = async () => {
  const response = await Utils.postEncodedToBackend<{ service: ServiceType }>(
    '/services/edit',
    service,
  )
  if (!response.success) {
    return alert('Erreur lors de la modification du service : ' + response.error.message)
  }
  emit('submit', response.data.service)
}
</script>

<template>
  <BaseModal :open="open" title="Modifier le service" @close="onClose">
    <form @submit.prevent="onSubmit" class="space-y-3">
      <input v-model="service.name" required placeholder="Nom" class="custom-input" />
      <input v-model="service.description" required placeholder="Description" class="custom-input" />

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
