<script setup lang="ts">
import type { SettingsData } from '~/types/api'

useHead({ title: 'Paramètres – MPortal' })

const { data, refresh } = await useApiFetch<SettingsData>('/api/settings')

const form = reactive({
  COMPANY_NAME: '',
  COMPANY_HOLDER: '',
  COMPANY_STREET: '',
  COMPANY_STREET_NUMBER: '',
  COMPANY_POSTAL_CODE: '',
  COMPANY_CITY: '',
  COMPANY_COUNTRY: 'CH',
  COMPANY_EMAIL: '',
  QR_IBAN: '',
  BANK_IBAN: '',
  INVOICE_DUE_DAYS: '30',
  SUBSCRIPTION_LEAD_DAYS: '30',
})

watch(
  data,
  (value) => {
    if (!value) return
    for (const key of Object.keys(form) as Array<keyof typeof form>) form[key] = value[key]
  },
  { immediate: true },
)

const { pending, run } = useAction()
async function submit() {
  const ok = await run('PUT', '/api/settings', { ...form }, 'Paramètres enregistrés')
  if (ok !== null) await refresh()
}

const fields: Array<{ key: keyof typeof form; label: string; span?: string; hint?: string }> = [
  { key: 'COMPANY_NAME', label: 'Nom commercial', span: 'sm:col-span-2' },
  { key: 'COMPANY_HOLDER', label: 'Titulaire du compte (bulletin QR)', span: 'sm:col-span-2' },
  { key: 'COMPANY_STREET', label: 'Rue' },
  { key: 'COMPANY_STREET_NUMBER', label: 'N°' },
  { key: 'COMPANY_POSTAL_CODE', label: 'NPA' },
  { key: 'COMPANY_CITY', label: 'Localité' },
  { key: 'COMPANY_COUNTRY', label: 'Pays (2 lettres)' },
  { key: 'COMPANY_EMAIL', label: 'Email affiché sur les factures' },
  { key: 'QR_IBAN', label: 'QR-IBAN (factures)', hint: 'IBAN spécial QR (CH.. 30xxx / 31xxx), utilisé avec les références QR' },
  { key: 'BANK_IBAN', label: 'IBAN du compte (relevés)', hint: 'Vérifie que les relevés importés concernent ce compte' },
  { key: 'INVOICE_DUE_DAYS', label: 'Délai de paiement (jours)' },
  { key: 'SUBSCRIPTION_LEAD_DAYS', label: 'Génération des abonnements (jours avant l’échéance)' },
]
</script>

<template>
  <div>
    <PageHeader title="Paramètres" subtitle="Coordonnées de la société, comptes bancaires et délais" />
    <form v-if="data" class="card grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <div v-for="field in fields" :key="field.key" :class="field.span">
        <label class="label" :for="`set-${field.key}`">{{ field.label }}</label>
        <input :id="`set-${field.key}`" v-model="form[field.key]" class="input" required />
        <p v-if="field.hint" class="mt-1 text-xs text-muted">{{ field.hint }}</p>
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="set-number">Dernier numéro de facture attribué</label>
        <input id="set-number" :value="data.INVOICE_NUMBER" class="input max-w-xs opacity-70" readonly />
        <p class="mt-1 text-xs text-muted">Lecture seule : la suite est gérée automatiquement (la prochaine facture prend +1).</p>
      </div>
      <div class="flex justify-end sm:col-span-2">
        <button type="submit" class="btn-primary" :disabled="pending">Enregistrer</button>
      </div>
    </form>
  </div>
</template>
