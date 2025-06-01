<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user.ts'
import { GeneralErrors } from '@/types/BackendErrors.ts'
import router from '@/router.ts'

const email = ref('bricemabi@gmail.com')
const password = ref('1')

async function handleLogin() {
  const userStore = useUserStore()
  const response = await userStore.auth({ email: email.value, password: password.value })
  if (!response.success) {
    switch (response.error.code) {
      case GeneralErrors.INVALID_CREDENTIALS:
        alert('Identifiants incorrects')
        email.value = ''
        password.value = ''
        break
      case GeneralErrors.TOO_MANY_ATTEMPTS:
        alert('Compte bloqué pendant encore ' + response.error.details + ' minutes')
        email.value = ''
        password.value = ''
        break
      default:
        alert('Une erreur est survenue, veuillez réessayer plus tard.')
        console.error('Erreur lors de la connexion:', response.error)
        break
    }
  }

  router.push({ name: 'index-page' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-black text-white px-4">
    <div class="w-full max-w-sm bg-lightBlack p-6 rounded-2xl shadow-lg space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-1">Connexion</h2>
        <p class="text-sm text-gray-400">Accédez au portail MDev.</p>
      </div>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm mb-1 text-gray-300">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-2 bg-lightBlack text-white rounded-md border border-white placeholder-white-200 focus:outline-none"
            placeholder="exemple@mail.com"
          />
        </div>

        <div>
          <label class="block text-sm mb-1 text-gray-300">Mot de passe</label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-4 py-2 bg-lightBlack text-white rounded-md border border-white placeholder-white-200 focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" class="btn btn-primary w-full">Se connecter</button>
      </form>
    </div>
  </div>
</template>
