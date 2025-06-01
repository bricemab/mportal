<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, DialogDescription } from '@headlessui/vue'
defineProps<{
    open: boolean
    title: string
    description?: string
}>()

const emit = defineEmits(['close'])
function onClose() {
    emit('close')
}

</script>

<template>
        <Dialog :open="open" @close="onClose" class="relative z-50">
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
            <div class="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel class="w-full max-w-lg rounded-xl bg-lightBlack p-6 text-white space-y-2 shadow-lg">
                    <DialogTitle class="text-lg font-semibold mb-3">{{ title }}</DialogTitle>
                    <DialogDescription v-if="description" class="text-md text-gray-400">
                        {{ description }}
                    </DialogDescription>

                    <div>
                        <slot />
                    </div>

                    <div v-if="$slots.footer" class="mt-4 flex justify-end space-x-2">
                        <slot name="footer" />
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
</template>
