<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import type { InvoicePage } from '@/types/InvoiceType.ts'
import { reactive, watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{ open: boolean; data: InvoicePage }>()

const invoice = reactive({
  ...props.data,
})

const descriptions: Record<string, string> = {
  CREATED: 'La facture a été créée',
  UPDATED: 'La facture a été modifiée',
  GENERATED: 'La facture a été générée',
  SENT: 'La facture a été envoyée',
  PAID: 'La facture a été marquée comme payée',
  CANCELLED: 'La facture a été annulée',
  UNPAID: 'La facture a été marquée comme impayée',
}

const iconStyles: Record<string, { icon: string; text: string; bg: string }> = {
  CREATED: { icon: 'bx-plus-circle', text: 'text-blue-600', bg: 'bg-blue-100' },
  UPDATED: { icon: 'bx-edit', text: 'text-yellow-600', bg: 'bg-yellow-100' },
  GENERATED: { icon: 'bx-receipt', text: 'text-indigo-600', bg: 'bg-indigo-100' },
  SENT: { icon: 'bx-send', text: 'text-teal-600', bg: 'bg-teal-100' },
  PAID: { icon: 'bx-check-circle', text: 'text-green-600', bg: 'bg-green-100' },
  CANCELLED: { icon: 'bx-x-circle', text: 'text-red-600', bg: 'bg-red-100' },
  UNPAID: { icon: 'bx-error-circle', text: 'text-orange-600', bg: 'bg-orange-100' },
}

watch(
  () => props.data,
  (val) => {
    Object.assign(invoice, JSON.parse(JSON.stringify(val)))
    if (!invoice.clientId && invoice.client && invoice.client.id) {
      invoice.clientId = invoice.client.id
    }
  },
  { immediate: true },
)

const emit = defineEmits(['close'])

const onClose = () => emit('close')
</script>

<template>
  <BaseModal :open="open" title="Informations complètes de la facture" @close="onClose">
    <div class="space-y-2">
      <div class="space-y-4">
        <div v-for="log in invoice.logs" :key="log.id" class="flex items-start space-x-3">
<<<<<<< Updated upstream
          <div class="rounded-full p-2 flex" :class="iconStyles[log.code].bg">
=======
          <div class="rounded-full p-2 flex items-center justify-center" :class="iconStyles[log.code].bg">
>>>>>>> Stashed changes
            <i :class="['bx', iconStyles[log.code].icon, iconStyles[log.code].text, 'text-xl']"></i>
          </div>

          <div class="flex flex-col">
            <div class="font-semibold" v-text="descriptions[log.code]"></div>
            <div class="text-sm text-gray-400">
              {{ dayjs(log.createdAt).format('DD.MM.YYYY HH:mm:ss') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button @click="onClose" class="btn btn-secondary">Fermer</button>
    </template>
  </BaseModal>
</template>
