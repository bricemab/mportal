<script setup lang="ts">
useHead({ title: 'Nouvel abonnement – MPortal' })

const route = useRoute()
const presetClientId = typeof route.query.clientId === 'string' ? Number(route.query.clientId) || null : null
</script>

<template>
  <div>
    <PageHeader
      title="Nouvel abonnement"
      subtitle="Toutes les lignes sont facturées ensemble, sur une seule facture, à chaque échéance. La facture est créée en brouillon 30 jours avant (réglable)."
      back="/subscriptions"
    />
    <SubscriptionForm :preset-client-id="presetClientId" @saved="(id) => navigateTo(`/subscriptions/${id}`)" />
  </div>
</template>
