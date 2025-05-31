<script setup lang="ts">
import BaseModal from '../BaseModal.vue'

defineProps<{
    open: boolean
    data: {
        nom: string
        email: string
        tel: string
        company: string
    }
}>()

const emit = defineEmits(['close'])
const onClose = () => emit('close')
</script>


<template>
    <BaseModal :open="open" title="Informations complète du client" @close="onClose">
        <div class="space-y-2">
            <p><strong>Nom :</strong> {{ data.nom }}</p>
            <p><strong>Entreprise :</strong> {{ data.company }}</p>
            <p><strong>Email :</strong> {{ data.email }}</p>
            <p><strong>Téléphone :</strong> {{ data.tel }}</p>
        </div>

        <template #footer>
            <button @click="onClose" class="btn btn-secondary">Fermer</button>
        </template>
    </BaseModal>
</template>
