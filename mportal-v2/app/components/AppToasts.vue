<script setup lang="ts">
import { CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl"
        :class="{
          'border-emerald-800 bg-emerald-950 text-emerald-100': toast.kind === 'success',
          'border-red-800 bg-red-950 text-red-100': toast.kind === 'error',
          'border-line bg-card-2 text-white': toast.kind === 'info',
        }"
      >
        <CheckCircle2 v-if="toast.kind === 'success'" class="mt-0.5 size-4 shrink-0" />
        <XCircle v-else-if="toast.kind === 'error'" class="mt-0.5 size-4 shrink-0" />
        <Info v-else class="mt-0.5 size-4 shrink-0" />
        <span class="flex-1">{{ toast.message }}</span>
        <button class="opacity-60 hover:opacity-100" aria-label="Fermer" @click="remove(toast.id)">
          <X class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
