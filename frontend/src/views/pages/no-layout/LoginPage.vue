<script setup lang="ts">
import { ref } from 'vue'

const email = ref('')
const password = ref('')

function handleLogin() {
  console.log('Connexion avec :', email.value, password.value)
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
          <input v-model="email" type="email" required
            class="w-full px-4 py-2 bg-lightBlack text-white rounded-md border border-white placeholder-white-200 focus:outline-none"
            placeholder="exemple@mail.com" />
        </div>

        <div>
          <label class="block text-sm mb-1 text-gray-300">Mot de passe</label>
          <input v-model="password" type="password" required
            class="w-full px-4 py-2 bg-lightBlack text-white rounded-md border border-white placeholder-white-200 focus:outline-none "
            placeholder="••••••••" />
        </div>
        <button type="submit" class="btn btn-primary w-full">
          Se connecter
        </button>
      </form>
    </div>
  </div>
</template>