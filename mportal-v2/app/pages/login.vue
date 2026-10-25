<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Connexion – MPortal' })

const { fetch: refreshSession } = useUserSession()
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    error.value = errorMessage(e, 'Connexion impossible')
    password.value = ''
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm">
    <div class="mb-8 flex flex-col items-center gap-3">
      <img src="/logo.svg" alt="" class="size-14" />
      <h1 class="text-2xl">MPortal</h1>
      <p class="text-sm text-muted">Gestion MDevelopment</p>
    </div>
    <form class="card space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="email" class="input" type="email" autocomplete="username" required autofocus />
      </div>
      <div>
        <label class="label" for="password">Mot de passe</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="current-password" required />
      </div>
      <p v-if="error" class="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200" role="alert">{{ error }}</p>
      <button class="btn-primary w-full" type="submit" :disabled="pending">
        <LogIn class="size-4" />
        {{ pending ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </div>
</template>
