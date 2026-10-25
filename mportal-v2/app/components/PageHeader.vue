<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'

defineProps<{ title: string; subtitle?: string; back?: string }>()
</script>

<template>
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-3">
      <NuxtLink v-if="back" :to="back" class="btn-ghost btn-sm" aria-label="Retour"><ArrowLeft class="size-4" /></NuxtLink>
      <div class="min-w-0">
        <h1 class="truncate">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 text-sm text-muted">{{ subtitle }}</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
