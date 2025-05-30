<script lang="ts">
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import TheNavigation from '@/components/TheNavigation.vue'
import UserProfile from '@/components/UserProfile.vue'

export default defineComponent({
  name: 'DefaultLayout',
  components: {
    TheNavigation,
    UserProfile
  },
  setup() {
    const route = useRoute()
    return { route }
  }
})
</script>

<template>
  <div class="flex min-h-screen">
    <TheNavigation />
    <div class="flex flex-col flex-1 space-y-6">
      <div class="flex justify-between items-center px-9 pt-3">
        <h2 v-if="route.path === '/'" class="text-2xl font-semibold text-white">Bonjour Théo 👋</h2>
        <div  v-else></div>
        <div class="flex items-center gap-4">
          <UserProfile />
        </div>
      </div>

      <main class="flex-1 px-9 pt-3">
        <router-view />
      </main>
    </div>
  </div>
</template>
