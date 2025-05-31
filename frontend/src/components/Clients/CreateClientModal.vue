<script setup lang="ts">
import BaseModal from '../BaseModal.vue'
import { reactive, watch } from 'vue'

const props = defineProps<{
    open: boolean
    data: {
        nom: ''
        email: ''
        tel: ''
        company: ''
    }
}>()

const emit = defineEmits(['close', 'submit'])

const client = reactive({ ...props.data })

watch(() => props.data, (val) => Object.assign(client, val))

const onClose = () => emit('close')
const onSubmit = () => emit('submit', { ...client })
</script>

<template>
    <BaseModal :open="open" title="Créer un nouveau client" @close="onClose">
        <form @submit.prevent="onSubmit" class="space-y-3">
            <input v-model="client.nom" placeholder="Nom" class="custum-input" />
            <input v-model="client.company" placeholder="Entreprise" class="custum-input" />
            <input v-model="client.email" placeholder="Email" class="custum-input" />
            <input v-model="client.tel" placeholder="Téléphone" class="custum-input" />

            <div class="flex justify-end space-x-3 pt-4">
                <button @click="onClose" type="button" class="btn btn-secondary">
                    Annuler
                </button>
                <button type="submit" class="btn btn-primary">
                    Sauvegarder
                </button>
            </div>
        </form>
    </BaseModal>
</template>
