<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const { invoiceNames, modelValue } = defineProps<{
  invoiceNames: string[],
  modelValue: string[]
}>()

const emit = defineEmits(['update:modelValue', 'apply'])

const isOpen = ref(false)
const search = ref('')
const selected = ref<string[]>([])

// Référence au root pour détecter clics extérieurs
const root = ref<HTMLElement | null>(null)

watch(() => modelValue, () => {
  selected.value = [...modelValue]
}, { immediate: true })

const filteredNames = computed(() =>
  invoiceNames.filter(name =>
    name.toLowerCase().includes(search.value.toLowerCase())
  )
)

const toggleSelect = (name: string) => {
  if (selected.value.includes(name)) {
    selected.value = selected.value.filter(n => n !== name)
  } else {
    selected.value.push(name)
  }
}

// ✅ Réinitialiser = vider + appliquer
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

// Fermer au clic hors du menu
const onClickOutside = (event: MouseEvent) => {
  if (isOpen.value && root.value && !root.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

// Computed qui indique si le filtre est actif (au moins un élément sélectionné)
const isActive = computed(() => modelValue.length > 0)
</script>

<template>
  <div ref="root" class="relative inline-block w-64">
    <button @click="isOpen = !isOpen" :class="[
      'p-2 rounded bg-dark text-white w-full text-center flex items-center justify-center',
      isActive ? 'border-2 border-white' : 'border border-gray-600'
    ]">
      <i class='bx bx-receipt pr-2'></i>Trier par nom
    </button>

    <div v-if="isOpen" class="absolute z-10 bg-lightBlack border border-white/20 mt-2 w-full p-4 rounded shadow-lg">
      <input v-model="search" type="text" placeholder="Rechercher un nom..."
        class="w-full mb-2 p-1 text-sm rounded bg-lightBlack text-white border border-gray-600" autocomplete="off" />
      <div class="max-h-40 overflow-y-auto">
        <div v-for="name in filteredNames" :key="name"
          class="flex justify-between items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1 select-none"
          @click="toggleSelect(name)">
          <span class="text-white">{{ name }}</span>
          <i v-if="selected.includes(name)" class='bx bx-check text-white'></i>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button class="text-sm text-white" @click="apply">Enregistrer</button>
        <button class="text-sm text-red-700" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
