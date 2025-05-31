<script setup lang="ts">
import { defineProps, defineEmits, computed, watch } from 'vue'

const props = defineProps({
    items: { type: Array, required: true },
    itemsPerPage: { type: Number, default: 10 },
    modelValue: { type: Number, default: 1 },
    maxPageButtons: { type: Number, default: 5 }
})

const emits = defineEmits(['update:modelValue', 'update:pageItems'])

const totalPages = computed(() => Math.ceil(props.items.length / props.itemsPerPage))

const paginatedItems = computed(() => {
    const start = (props.modelValue - 1) * props.itemsPerPage
    return props.items.slice(start, start + props.itemsPerPage)
})

watch(paginatedItems, (newItems) => {
    emits('update:pageItems', newItems)
}, { immediate: true })

const pages = computed(() => {
    const total = totalPages.value
    const current = props.modelValue

    if (total <= 4) return [...Array(total).keys()].map(i => i + 1)

    let visiblePages = []
    visiblePages.push(1)

    if (current > 3) visiblePages.push('...')

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        visiblePages.push(i)
    }

    if (current < total - 2) visiblePages.push('...')

    visiblePages.push(total)

    return visiblePages
})

function goToPage(page: number | string) {
    if (typeof page === 'number' && page !== props.modelValue) {
        emits('update:modelValue', page)
    }
}

function goToPrev() {
    if (props.modelValue > 1) emits('update:modelValue', props.modelValue - 1)
}

function goToNext() {
    if (props.modelValue < totalPages.value) emits('update:modelValue', props.modelValue + 1)
}
</script>

<template>
    <div class="flex items-center justify-between mt-4 select-none">
        <p class="text-sm text-gray-300 whitespace-nowrap">
            Éléments {{ (props.modelValue - 1) * props.itemsPerPage + 1 }}
            à {{ Math.min(props.modelValue * props.itemsPerPage, props.items.length) }}
            sur {{ props.items.length }}
        </p>

        <nav class="flex items-center space-x-2">
            <button @click="goToPrev" :disabled="props.modelValue === 1"
                class="w-8 h-8 flex justify-center items-center rounded bg-black text-white hover:bg-white hover:text-black"><i
                    class='bx bx-chevron-left'></i></button>

            <template v-for="(page, index) in pages" :key="index">
                <button v-if="page !== '...'" @click="goToPage(page)"
                    :class="['w-8 h-8 flex justify-center items-center rounded hover:bg-white hover:text-black', page === props.modelValue ? 'bg-white text-black' : 'bg-black text-white']">{{
                        page }}</button>
                <span v-else class="w-8 h-8 flex justify-center items-center text-gray-500">...</span>
            </template>

            <button @click="goToNext" :disabled="props.modelValue === totalPages"
                class="w-8 h-8 flex justify-center items-center rounded bg-black text-white hover:bg-white hover:text-black"><i
                    class='bx bx-chevron-right'></i></button>
        </nav>
    </div>
</template>
