<script setup lang="ts">
const props = defineProps<{ used: number; quota: number }>()
const ratio = computed(() => (props.quota > 0 ? Math.min(1, props.used / props.quota) : 1))
const color = computed(() => (ratio.value >= 1 ? 'bg-red-500' : ratio.value >= 0.8 ? 'bg-amber-400' : 'bg-emerald-500'))
</script>

<template>
  <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-800" role="progressbar" :aria-valuenow="used" :aria-valuemax="quota">
    <div class="h-full rounded-full transition-all" :class="color" :style="{ width: `${ratio * 100}%` }" />
  </div>
</template>
