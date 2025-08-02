<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch } from 'vue'
import { toast } from 'vue3-toastify'
import dayjs from 'dayjs'
import Utils from '@/utils/Utils.ts'

const props = defineProps<{
  open: boolean
  contractId: number
}>()
const emit = defineEmits(['close', 'submit'])

const hour = ref({
  description: '',
  hours: 0,
  date: dayjs().format('YYYY-MM-DD'),
})

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      // Reset form
      hour.value = {
        description: '',
        hours: 0,
        date: dayjs().format('YYYY-MM-DD'),
      }
    }
  },
  { immediate: true },
)

const onClose = () => emit('close')

const onSubmit = async () => {
  const payload = {
    contractId: props.contractId,
    description: hour.value.description,
    hours: Number(hour.value.hours),
    date: hour.value.date,
  }

  const response = await Utils.postEncodedToBackend('/maintenance-contracts/add-hours', payload)
  if (!response.success) {
    return toast.error(
      "Erreur lors de la création d'heures de maintenance : " + response.error.message,
    )
  }

  emit('submit')
  toast.success('Les heures de maintenance ont été ajoutées avec succès !')
}
</script>

<template>
  <BaseModal :open="open" title="Ajouter des heures de maintenance" @close="onClose" size="lg">
    <form @submit.prevent="onSubmit" class="p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Description du travail effectué</label>
        <textarea
          v-model="hour.description"
          required
          placeholder="Ex: Mise à jour Apache pour correction de sécurité"
          rows="3"
          class="custom-input w-full resize-none"
        ></textarea>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">Nombre d'heures</label>
          <input
            v-model.number="hour.hours"
            type="number"
            min="0.5"
            step="0.5"
            required
            placeholder="Ex: 4"
            class="custom-input w-full"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">Date du travail</label>
          <input v-model="hour.date" type="date" required class="custom-input w-full" />
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Ajouter les heures</button>
      </div>
    </form>
  </BaseModal>
</template>
