<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ open: boolean; title: string; size?: 'sm' | 'md' | 'lg' | 'xl' }>(), { size: 'md' })
const emit = defineEmits<{ close: [] }>()

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center" @mousedown.self="emit('close')">
      <div role="dialog" aria-modal="true" :aria-label="title" class="my-8 w-full rounded-xl border border-line bg-card shadow-2xl" :class="widths[size]">
        <div class="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 class="text-base">{{ title }}</h2>
          <button class="btn-ghost btn-sm" aria-label="Fermer" @click="emit('close')"><X class="size-4" /></button>
        </div>
        <div class="p-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
