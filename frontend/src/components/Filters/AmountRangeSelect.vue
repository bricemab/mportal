<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

const { min, max } = defineProps<{ min: number | null, max: number | null }>()
const emit = defineEmits(['update:min', 'update:max', 'apply'])

const internalMin = ref<number | string | null>(min)
const internalMax = ref<number | string | null>(max)
const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

// Sync internal values when props change
watch(() => [min, max], () => {
  internalMin.value = min
  internalMax.value = max
}, { immediate: true })

// Ensure max is always >= min if both are numbers
watch(internalMin, (newMin) => {
  const minVal = newMin !== '' ? Number(newMin) : null
  const maxVal = internalMax.value !== '' ? Number(internalMax.value) : null
  if (minVal !== null && maxVal !== null && maxVal < minVal) {
    internalMax.value = minVal
  }
})
watch(internalMax, (newMax) => {
  const minVal = internalMin.value !== '' ? Number(internalMin.value) : null
  const maxVal = newMax !== '' ? Number(newMax) : null
  if (minVal !== null && maxVal !== null && maxVal < minVal) {
    internalMin.value = maxVal
  }
})

const apply = () => {
  const parsedMin = internalMin.value === '' || internalMin.value === null ? null : Number(internalMin.value)
  const parsedMax = internalMax.value === '' || internalMax.value === null ? null : Number(internalMax.value)

  emit('update:min', parsedMin)
  emit('update:max', parsedMax)
  emit('apply')
  isOpen.value = false
}

const reset = () => {
  internalMin.value = null
  internalMax.value = null
  emit('update:min', null)
  emit('update:max', null)
  emit('apply')
  isOpen.value = false
}

// Close and apply on outside click
const onClickOutside = (event: MouseEvent) => {
  if (isOpen.value && root.value && !root.value.contains(event.target as Node)) {
    apply()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

// Le filtre est actif si min ou max sont définis
const isActive = computed(() => {
  return (internalMin.value !== null && internalMin.value !== '') || (internalMax.value !== null && internalMax.value !== '')
})
</script>

<template>
  <div ref="root" class="relative inline-block w-60">
    <button @click="isOpen = !isOpen" :class="[ 
      'p-2 rounded bg-dark text-white w-full text-center flex items-center justify-center',
      isActive ? 'border-2 border-white' : 'border border-gray-600'
    ]">
      <i class='bx bx-wallet pr-2'></i>Filtrer par montant
    </button>

    <div v-if="isOpen" class="absolute bg-lightBlack z-10 mt-2 border border-white/20 p-4 rounded w-full shadow-lg">
      <div class="flex justify-between gap-2 mb-2">
        <input v-model="internalMin" type="number"
          class="w-1/2 p-1 text-sm rounded bg-dark text-white border border-gray-600" placeholder="Min" />
        <input v-model="internalMax" type="number"
          class="w-1/2 p-1 text-sm rounded bg-dark text-white border border-gray-600" placeholder="Max" />
      </div>
      <div class="flex justify-end gap-2">
        <button class="text-sm text-white" @click="apply">Enregistrer</button>
        <button class="text-sm text-red-700" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
