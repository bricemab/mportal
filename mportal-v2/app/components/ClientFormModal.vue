<script setup lang="ts">
import type { ClientRow } from '~/types/api'

const props = defineProps<{ open: boolean; client?: ClientRow | null }>()
const emit = defineEmits<{ close: []; saved: [client: ClientRow] }>()

const empty = () => ({
  name: '',
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  street: '',
  streetNumber: '',
  postalCode: '',
  city: '',
  country: 'CH',
  remark: '',
})
const form = reactive(empty())
const { pending, run } = useAction()

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const c = props.client
    Object.assign(form, empty())
    if (c) {
      Object.assign(form, {
        name: c.name,
        firstname: c.firstname ?? '',
        lastname: c.lastname ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        street: c.street ?? '',
        streetNumber: c.streetNumber ?? '',
        postalCode: c.postalCode ?? '',
        city: c.city ?? '',
        country: c.country,
        remark: c.remark ?? '',
      })
    }
  },
  { immediate: true },
)

async function submit() {
  const body = { ...form }
  const saved = props.client
    ? await run<ClientRow>('PUT', `/api/clients/${props.client.id}`, body, 'Client enregistré')
    : await run<ClientRow>('POST', '/api/clients', body, 'Client créé')
  if (saved) emit('saved', saved)
}
</script>

<template>
  <BaseModal :open="open" :title="client ? 'Modifier le client' : 'Nouveau client'" size="lg" @close="emit('close')">
    <form class="grid grid-cols-1 gap-4 sm:grid-cols-6" @submit.prevent="submit">
      <div class="sm:col-span-6">
        <label class="label" for="c-name">Nom / raison sociale *</label>
        <input id="c-name" v-model="form.name" class="input" required maxlength="190" />
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="c-first">Prénom du contact</label>
        <input id="c-first" v-model="form.firstname" class="input" maxlength="100" />
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="c-last">Nom du contact</label>
        <input id="c-last" v-model="form.lastname" class="input" maxlength="100" />
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="c-email">Email</label>
        <input id="c-email" v-model="form.email" class="input" type="email" maxlength="190" />
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="c-phone">Téléphone</label>
        <input id="c-phone" v-model="form.phone" class="input" maxlength="40" />
      </div>
      <div class="sm:col-span-4">
        <label class="label" for="c-street">Rue</label>
        <input id="c-street" v-model="form.street" class="input" maxlength="190" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="c-nr">N°</label>
        <input id="c-nr" v-model="form.streetNumber" class="input" maxlength="16" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="c-npa">NPA</label>
        <input id="c-npa" v-model="form.postalCode" class="input" maxlength="16" />
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="c-city">Localité</label>
        <input id="c-city" v-model="form.city" class="input" maxlength="100" />
      </div>
      <div class="sm:col-span-1">
        <label class="label" for="c-country">Pays</label>
        <input id="c-country" v-model="form.country" class="input uppercase" maxlength="2" />
      </div>
      <div class="sm:col-span-6">
        <label class="label" for="c-remark">Remarque</label>
        <textarea id="c-remark" v-model="form.remark" class="input" rows="2" maxlength="5000" />
      </div>
      <p class="text-xs text-muted sm:col-span-6">L’adresse complète (rue, NPA, localité) est nécessaire pour qu’elle figure sur le bulletin QR.</p>
      <div class="flex justify-end gap-2 sm:col-span-6">
        <button type="button" class="btn-secondary" @click="emit('close')">Annuler</button>
        <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
      </div>
    </form>
  </BaseModal>
</template>
