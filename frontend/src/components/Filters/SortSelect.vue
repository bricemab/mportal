<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

const options = [
    { label: 'Montant croissant', value: 'asc' },
    { label: 'Montant décroissant', value: 'desc' },
    { label: 'Dernière facture', value: 'recent' },
    { label: 'Plus vieille facture', value: 'oldest' }
]

const selectedLabel = computed(() => {
    if (!props.modelValue) return 'Trier'
    const selected = options.find(o => o.value === props.modelValue)
    return selected ? selected.label : 'Trier'
})

const selectOption = (value: string) => {
    emit('update:modelValue', value)
    isOpen.value = false
}

const resetFilter = (event: MouseEvent) => {
    event.stopPropagation()  // empêche l’ouverture/fermeture du dropdown
    emit('update:modelValue', '')
    isOpen.value = false
}

const onClickOutside = (event: MouseEvent) => {
    if (root.value && !root.value.contains(event.target as Node)) {
        isOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', onClickOutside)
})
onBeforeUnmount(() => {
    document.removeEventListener('click', onClickOutside)
})

// Bordure active si filtre sélectionné
const isActive = computed(() => !!props.modelValue)
</script>

<template>
    <div ref="root" class="relative inline-block w-50">
        <button @click="isOpen = !isOpen" :class="[
            'w-full flex items-center justify-center gap-2 p-2 rounded bg-dark text-white relative',
            isActive ? 'border-2 border-white' : 'border border-gray-600'
        ]">
            <span class="flex-1 text-center">
                <i v-if="selectedLabel === 'Trier'" class="bx bx-filter pr-2"></i>
                {{ selectedLabel }}
            </span>
            <button v-if="props.modelValue" @click="resetFilter" aria-label="Réinitialiser le filtre"
                class="text-white flex items-center justify-center text-sm font-bold absolute right-2 top-1/2 -translate-y-1/2"
                title="Réinitialiser le filtre" type="button">
                <i class='bx bx-x'></i>
            </button>
        </button>

        <div v-if="isOpen" class="absolute z-10 w-full mt-2 bg-lightBlack border border-white/20 rounded shadow-lg">
            <div v-for="option in options" :key="option.value" @click="selectOption(option.value)"
                class="px-3 py-2 cursor-pointer hover:bg-gray-700 text-white text-sm select-none"
                :class="{ 'bg-gray-700': modelValue === option.value }">
                {{ option.label }}
            </div>
        </div>
    </div>
</template>
