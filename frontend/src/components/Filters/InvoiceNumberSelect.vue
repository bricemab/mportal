<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const { invoiceNumbers, modelValue } = defineProps<{
  invoiceNumbers: string[],
  modelValue: string[]
}>()

const emit = defineEmits(['update:modelValue', 'apply'])

const isOpen = ref(false)
const search = ref('')
const selected = ref<string[]>([])

// Garder ref sur l'élément racine pour gestion clic extérieur
const root = ref<HTMLElement | null>(null)

// Mettre à jour selected si modelValue change (utile à l'initialisation)
watch(() => modelValue, () => {
  selected.value = [...modelValue]
}, { immediate: true })

// Liste filtrée par recherche
const filteredNumbers = computed(() =>
  invoiceNumbers.filter(num =>
    num.toLowerCase().includes(search.value.toLowerCase())
  )
)

// Sélectionner ou désélectionner un numéro
const toggleSelect = (num: string) => {
  if (selected.value.includes(num)) {
    selected.value = selected.value.filter(n => n !== num)
  } else {
    selected.value.push(num)
  }
}

const reset = () => {
  selected.value = []
  search.value = ''
  emit('update:modelValue', [])
  emit('apply')
  isOpen.value = false
}

// Appliquer la sélection
const apply = () => {
  emit('update:modelValue', [...selected.value])
  emit('apply')
  search.value = ''
  isOpen.value = false
}

// Gérer ouverture (sans réinitialiser avec modelValue)
const openDropdown = () => {
  // selected.value = []   <-- ici je supprime la réinitialisation pour garder la sélection
  search.value = ''
  isOpen.value = true
}

// Fermeture au clic en dehors
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

// Computed pour savoir si filtre actif (au moins 1 sélection)
const isActive = computed(() => modelValue.length > 0)
</script>

<template>
  <div ref="root" class="relative inline-block w-74">
    <button @click="openDropdown" :class="[
      'p-2 rounded bg-dark text-white w-full text-center flex items-center justify-center',
      isActive ? 'border-2 border-white' : 'border border-gray-600'
    ]">
      <i class='bx bxs-barcode pr-2'></i>Trier par n° de facture
    </button>

    <div v-if="isOpen" class="absolute z-10 bg-lightBlack border border-white/20 mt-2 w-full p-4 rounded shadow-lg">
      <input v-model="search" type="text" placeholder="Rechercher un numéro..."
        class="w-full mb-2 p-1 text-sm rounded bg-dark text-white border border-gray-600" autocomplete="off" />
      <div class="max-h-40 overflow-y-auto">
        <div v-for="num in filteredNumbers" :key="num"
          class="flex justify-between items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1 select-none"
          @click="toggleSelect(num)">
          <span class="text-white text-sm">{{ num }}</span>
          <i v-if="selected.includes(num)" class='bx bx-check text-white'></i>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button class="text-sm text-white" @click="apply">Enregistrer</button>
        <button class="text-sm text-red-700" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
