<script setup lang="ts">
import BaseModal from '../BaseModal.vue'

defineProps<{
    open: boolean
}>()

const emit = defineEmits(['close', 'confirm'])

const onClose = () => emit('close')
const onConfirm = () => emit('confirm')
</script>


<template>
    <BaseModal :open="open" title="Êtes-vous sûr de vouloir supprimer ce client ?"
        description="Cette action est irréversible !" @close="onClose">
        <template #footer>
            <button @click="onClose" class="btn btn-secondary">Annuler</button>
            <button @click="onConfirm" class="btn btn-danger">Supprimer</button>
        </template>
    </BaseModal>
</template>
