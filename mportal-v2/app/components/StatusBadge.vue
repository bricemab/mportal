<script setup lang="ts">
const props = defineProps<{ status: string; label?: string }>()

const text = computed(() => props.label ?? invoiceStatusLabels[props.status as keyof typeof invoiceStatusLabels] ?? props.status)
const classes = computed(() => statusBadgeClasses[props.status] ?? 'bg-neutral-800 text-neutral-300')
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" :class="classes">{{ text }}</span>
</template>
