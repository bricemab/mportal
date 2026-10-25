<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [value: number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <div v-if="pages > 1" class="mt-4 flex items-center justify-between text-sm text-muted">
    <span>{{ total }} élément{{ total > 1 ? 's' : '' }}</span>
    <div class="flex items-center gap-2">
      <button class="btn-secondary btn-sm" :disabled="page <= 1" aria-label="Page précédente" @click="emit('update:page', page - 1)">
        <ChevronLeft class="size-4" />
      </button>
      <span>Page {{ page }} / {{ pages }}</span>
      <button class="btn-secondary btn-sm" :disabled="page >= pages" aria-label="Page suivante" @click="emit('update:page', page + 1)">
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
</template>
