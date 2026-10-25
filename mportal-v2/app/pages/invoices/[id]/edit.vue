<script setup lang="ts">
import type { InvoiceDetail } from '~/types/api'

const route = useRoute()
const id = Number(route.params.id)
const { data } = await useApiFetch<InvoiceDetail>(`/api/invoices/${id}`)
useHead({ title: () => `Modifier la facture ${data.value?.invoice.number ?? ''} – MPortal` })
</script>

<template>
  <div>
    <PageHeader :title="`Modifier la facture ${data?.invoice.number ?? ''}`" :back="`/invoices/${id}`" />
    <template v-if="data">
      <InvoiceForm v-if="data.invoice.editable" :initial="data" @saved="navigateTo(`/invoices/${id}`)" />
      <EmptyState v-else text="Cette facture ne peut plus être modifiée (envoyée, payée ou close)." />
    </template>
  </div>
</template>
