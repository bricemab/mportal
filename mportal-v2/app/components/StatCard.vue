<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ label: string; value: string; hint?: string; icon?: Component; tone?: 'default' | 'positive' | 'negative' | 'warning' }>()
</script>

<template>
  <div class="card flex items-start gap-4">
    <div v-if="icon" class="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black">
      <component :is="icon" class="size-5" />
    </div>
    <div class="min-w-0">
      <p class="text-sm text-muted">{{ label }}</p>
      <p
        class="mt-1 truncate text-2xl font-semibold"
        :class="{ 'text-emerald-400': tone === 'positive', 'text-red-400': tone === 'negative', 'text-amber-300': tone === 'warning' }"
      >
        {{ value }}
      </p>
      <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
    </div>
  </div>
</template>
