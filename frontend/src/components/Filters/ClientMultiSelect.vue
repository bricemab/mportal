<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const { clients, modelValue } = defineProps<{
  clients: { id: string, name: string }[],
  modelValue: string[]
}>()

const emit = defineEmits(['update:modelValue', 'apply'])

const isOpen = ref(false)
const search = ref('')
const selected = ref<string[]>([])
const root = ref<HTMLElement | null>(null)

// Clients uniques par ID
const uniqueClients = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  clients.forEach(client => {
    if (!map.has(client.id)) {
      map.set(client.id, client)
    }
  })
  return Array.from(map.values())
})

// Sync selected avec modelValue
watch(() => modelValue, () => {
  selected.value = [...modelValue]
}, { immediate: true })

// Filtrage par nom
const filteredClients = computed(() =>
  uniqueClients.value.filter(client =>
    client.name.toLowerCase().includes(search.value.toLowerCase())
  )
)

// Toggle d'un client
const toggleSelect = (id: string) => {
  if (selected.value.includes(id)) {
    selected.value = selected.value.filter(sid => sid !== id)
  } else {
    selected.value.push(id)
  }
}

const reset = () => {
  selected.value = []
  search.value = ''
  emit('update:modelValue', [])  // important pour vider le filtre appliqué
  isOpen.value = false
}

// Appliquer la sélection
const apply = () => {
  emit('update:modelValue', [...selected.value])
  emit('apply')
  search.value = ''
  isOpen.value = false
}

const openDropdown = () => {
  search.value = ''
  isOpen.value = true
}

// Fermer si clic hors composant
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

// Computed pour savoir si le filtre est actif (au moins un client sélectionné)
const isActive = computed(() => {
  return modelValue.length > 0
})
</script>

<template>
  <div ref="root" class="relative inline-block w-64">
    <button @click="openDropdown" :class="[
      'p-2 rounded bg-dark text-white w-full text-center',
      isActive ? 'border-2 border-white' : 'border border-gray-600'
    ]">
      <i class='bx bx-group pr-2'></i> Trier par client
    </button>

    <div v-if="isOpen" class="absolute z-10 bg-lightBlack border border-white/20 mt-2 w-full p-4 rounded shadow-lg">
      <input v-model="search" type="text" placeholder="Rechercher un client..."
        class="w-full mb-2 p-1 text-sm rounded bg-lightBlack text-white border border-gray-600" autocomplete="off" />
      <div class="max-h-40 overflow-y-auto">
        <div v-for="client in filteredClients" :key="client.id"
          class="flex justify-between items-center cursor-pointer hover:bg-gray-700 rounded px-2 py-1 select-none"
          @click="toggleSelect(client.id)">
          <span class="text-white">{{ client.name }}</span>
          <i v-if="selected.includes(client.id)" class="bx bx-check text-white"></i>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-3">
        <button class="text-sm text-white" @click="apply">Enregistrer</button>
        <button class="text-sm text-red-700" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
