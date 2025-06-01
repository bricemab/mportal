<script lang="ts">
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import TheNavigation from '@/components/TheNavigation.vue'
import UserProfile from '@/components/UserProfile.vue'
import { useUserStore } from '../../stores/user.ts'
import Utils from '@/utils/Utils.ts'

export default defineComponent({
  name: 'DefaultLayout',
  methods: { useUserStore },
  components: {
    TheNavigation,
    UserProfile,
  },
  setup() {
    const route = useRoute()
    setInterval(() => {
      Utils.checkServerHealth()
    }, 5000)
    return { route }
  },
})
</script>

<template>
  <div class="flex min-h-screen">
    <TheNavigation />
    <div class="flex flex-col flex-1 space-y-6">
      <div class="flex justify-between items-center px-9 pt-3">
        <h2 v-if="route.path === '/'" class="text-2xl font-semibold text-white flex items-center">
          Bonjour {{ useUserStore().getUser()!.firstname }}
          <img src="../../assets/ressources/wave-hand.png" alt="👋" class="ml-2 w-6 h-6" />
        </h2>
        <div v-else></div>
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
