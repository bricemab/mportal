<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

const { modelValue, states } = defineProps<{
  modelValue: string[],
  states: string[]
}>()

const emit = defineEmits(['update:modelValue', 'apply'])

const isOpen = ref(false)
const selected = ref<string[]>([])
const search = ref('')

watch(() => modelValue, () => {
  selected.value = [...modelValue]
}, { immediate: true })

const filteredStates = computed(() =>
  states.filter(s =>
    s.toLowerCase().includes(search.value.toLowerCase())
  )
)

const toggle = (value: string) => {
  if (selected.value.includes(value)) {
    selected.value = selected.value.filter(v => v !== value)
  } else {
    selected.value.push(value)
  }
}

// Réinitialisation = vide + applique
const reset = () => {
  selected.value = []
  search.value = ''
  emit('update:modelValue', [])
  emit('apply')
  isOpen.value = false
}

const apply = () => {
  emit('update:modelValue', [...selected.value])
  emit('apply')
  isOpen.value = false
}

// Fermer menu si clic en dehors
const root = ref<HTMLElement | null>(null)
const onClickOutside = (e: MouseEvent) => {
  if (isOpen.value && root.value && !root.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

// Computed pour savoir si filtre actif (au moins 1 sélection)
const isActive = computed(() => modelValue.length > 0)
</script>

<template>
  <div ref="root" class="relative inline-block w-50">
    <button @click="isOpen = !isOpen" :class="[
      'p-2 rounded bg-dark text-white w-full text-center flex items-center justify-center',
      isActive ? 'border-2 border-white' : 'border border-gray-600'
    ]">
      <i class='bx bx-purchase-tag pr-2'></i>Filtrer par statut
    </button>

    <div v-if="isOpen" class="absolute z-10 bg-lightBlack border border-white/20 mt-2 w-full p-4 rounded shadow-lg">
      <input v-model="search" type="text" placeholder="Rechercher un statut..."
        class="w-full mb-2 p-1 text-sm rounded bg-lightBlack text-white border border-gray-600" autocomplete="off" />
      <div class="max-h-40 overflow-y-auto">
        <div v-for="state in filteredStates" :key="state"
          class="flex justify-between items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1 select-none"
          @click="toggle(state)">
          <span class="text-white">{{ state }}</span>
          <i v-if="selected.includes(state)" class='bx bx-check text-white'></i>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button class="text-sm text-white" @click="apply">Enregistrer</button>
        <button class="text-sm text-red-700" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
