<script setup lang="ts">
useHead({ title: 'Nouvelle facture – MPortal' })

const route = useRoute()
const presetClientId = typeof route.query.clientId === 'string' ? Number(route.query.clientId) || null : null
</script>

<template>
  <div>
    <PageHeader title="Nouvelle facture" subtitle="La facture est créée en brouillon ; le numéro et la référence QR sont attribués automatiquement." back="/invoices" />
    <InvoiceForm :preset-client-id="presetClientId" @saved="(id) => navigateTo(`/invoices/${id}`)" />
  </div>
</template>
