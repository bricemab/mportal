<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { ref, watch } from 'vue'
import Utils from '@/utils/Utils.ts'
import { toast } from 'vue3-toastify'
import type { InvoiceType } from '@/types/InvoiceType.ts'
import type { ClientType } from '@/types/ClientType.ts'
import type { ServiceType } from '@/types/ServiceType.ts'
import { Switch } from '@headlessui/vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['close', 'submit'])

const mustCreateMdevInvoice = ref(false)
const invoice = ref({
  name: '',
  clientId: 0,
  services: [{ serviceId: 0, quantity: 1, amount: 0, mdevAmount: 0 }],
})

const clients = ref<ClientType[]>([])
const services = ref<ServiceType[]>([])

const fetchOptions = async () => {
  const [clientRes, serviceRes] = await Promise.all([
    Utils.postEncodedToBackend<{ clients: ClientType[] }>('/clients/list', {}),
    Utils.postEncodedToBackend<{ services: ServiceType[] }>('/services/list', {}),
  ])

  if (clientRes.success && clientRes.data) {
    clients.value = clientRes.data.clients
  } else {
    toast.error('Erreur lors du chargement des clients.')
  }

  if (serviceRes.success && serviceRes.data) {
    services.value = serviceRes.data.services
  } else {
    return toast.error('Erreur lors du chargement des services.')
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) fetchOptions()
  },
  { immediate: true },
)

const onClose = () => emit('close')

const onSubmit = async () => {
  const payload = {
    name: invoice.value.name,
    clientId: Number(invoice.value.clientId),
    mustCreateMdevInvoice: mustCreateMdevInvoice.value,
    services: invoice.value.services.map((s) => ({
      serviceId: Number(s.serviceId),
      quantity: Number(s.quantity),
      amount: Number(s.amount),
      mdevAmount: mustCreateMdevInvoice.value ? Number(s.mdevAmount) : 0,
    })),
  }

  const response = await Utils.postEncodedToBackend<{ invoice: InvoiceType }>(
    '/invoices/create',
    payload,
  )

  if (!response.success) {
    toast.error('Erreur lors de la création de la facture : ' + response.error.message)
    return
  }

  emit('submit', response.data.invoice)
  toast.success('La facture a été créée avec succès !')
}

const addServiceLine = () => {
  invoice.value.services.push({ serviceId: 0, quantity: 1, amount: 0 })
}

const removeServiceLine = (index: number) => {
  invoice.value.services.splice(index, 1)
}
</script>

<template>
  <BaseModal :open="open" title="Créer une nouvelle facture" @close="onClose" size="xl">
    <form
      @submit.prevent="onSubmit"
      class="max-h-[90vh] overflow-hidden p-4 space-y-4 flex flex-col"
    >
      <input
        v-model="invoice.name"
        required
        placeholder="Nom de la facture"
        class="custom-input w-full"
      />

      <select v-model="invoice.clientId" required class="custom-input w-full">
        <option disabled value="0">Sélectionnez un client</option>
        <option v-if="clients.length === 0" disabled>Aucun client disponible</option>
        <option v-for="client in clients" :key="client.id" :value="client.id">
          {{ client.name }} ({{ client.firstname }} {{ client.lastname }})
        </option>
      </select>

      <div class="max-h-64 overflow-y-auto overflow-x-hidden space-y-3 py-1">
        <div class="flex items-center space-x-2 mb-4">
          <Switch
            id="mustCreateMdevInvoice"
            v-model="mustCreateMdevInvoice"
            :class="mustCreateMdevInvoice ? 'bg-black' : 'bg-gray-200'"
            class="relative inline-flex h-6 w-11 items-center rounded-full"
          >
            <span class="sr-only">Enable notifications</span>
            <span
              :class="mustCreateMdevInvoice ? 'translate-x-6' : 'translate-x-1'"
              class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            />
          </Switch>
          <label for="mustCreateMdevInvoice">Charge payé par MDev</label>
        </div>
        <div
          v-for="(line, index) in invoice.services"
          :key="index"
          class="grid grid-cols-12 gap-3 items-center"
        >
          <select v-model="line.serviceId" required class="custom-input col-span-6">
            <option disabled value="0">Service</option>
            <option v-if="services.length === 0" disabled>Aucun service disponible</option>
            <option v-for="service in services" :key="service.id" :value="service.id">
              {{ service.name }}
            </option>
          </select>

          <input
            v-model.number="line.quantity"
            type="text"
            min="1"
            required
            placeholder="Q."
            class="custom-input !px-0 text-center col-span-1"
          />

          <input
            v-model.number="line.amount"
            type="text"
            min="0"
            step="0.01"
            required
            placeholder="P."
            class="custom-input col-span-2"
          />

          <input
            v-if="mustCreateMdevInvoice"
            v-model.number="line.mdevAmount"
            type="text"
            min="0"
            step="0.01"
            required
            placeholder="P. MDev"
            class="custom-input col-span-2 border border-[#1c73b4] focus:ring-1"
          />

          <button
            type="button"
            @click="removeServiceLine(index)"
            v-if="invoice.services.length > 1"
          >
            <i class="text-red-500 hover:text-red-700 col-span-1 bx bx-trash-alt bx-sm"></i>
          </button>
        </div>
      </div>

      <div class="flex justify-center">
        <button type="button" @click="addServiceLine" class="flex items-center">
          <i class="bx bx-plus pr-2"></i>
          Ajouter un service supplémentaire à facturer
        </button>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <button @click="onClose" type="button" class="btn btn-secondary">Annuler</button>
        <button type="submit" class="btn btn-primary">Générer la facture</button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped></style>
