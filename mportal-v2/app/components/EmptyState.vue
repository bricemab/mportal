<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <p class="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{{ text }}</p>
</template>
