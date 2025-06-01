<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Image from '@/assets/ressources/avatar.jpg'
import { useUserStore } from '@/stores/user.ts'

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const user = {
  fullName: useUserStore().getFullName(),
  position: 'CEO',
  avatar: Image,
}

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

const logout = async () => {
  const store = useUserStore()
  await store.logout()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <div class="flex items-center gap-3 cursor-pointer" @click="showDropdown = !showDropdown">
      <img :src="user.avatar" class="w-10 h-10 rounded-full object-cover" />
      <div class="hidden sm:block">
        <p class="font-semibold text-sm">{{ user.fullName }}</p>
        <p class="text-xs text-white/70">{{ user.position }}</p>
      </div>
      <i class="bx bx-chevron-down ml-1"></i>
    </div>

    <div
      v-show="showDropdown"
      class="absolute right-0 mt-2 w-44 bg-white text-black rounded-md shadow-lg z-10 origin-top-right transition-all duration-200 ease-out"
      :class="[showDropdown ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none']"
    >
      <router-link
        to="/settings"
        class="flex items-center block px-4 py-2 hover:bg-gray-100 hover:rounded-md"
      >
        <i class="bx bx-cog pr-2"></i>Paramètres
      </router-link>
      <button
        @click="logout"
        class="flex items-center w-full text-left px-4 py-2 hover:bg-gray-100 hover:rounded-md text-red-600"
      >
        <i class="bx bx-log-out pr-2"></i>Se déconnecter
      </button>
    </div>
  </div>
</template>
