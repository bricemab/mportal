<script setup lang="ts">
import {
  Banknote,
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  RefreshCw,
  ScrollText,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-vue-next'

const { user, clear } = useUserSession()
const route = useRoute()
const mobileOpen = ref(false)

const items = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/invoices', label: 'Factures', icon: FileText },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/subscriptions', label: 'Abonnements', icon: RefreshCw },
  { to: '/contracts', label: 'Contrats', icon: FileClock },
  { to: '/expenses', label: 'Dépenses', icon: Receipt },
  { to: '/bank', label: 'Banque', icon: Banknote },
  { to: '/services', label: 'Services', icon: Package },
  { to: '/settings', label: 'Paramètres', icon: Settings },
  { to: '/audit', label: 'Journal', icon: ScrollText },
]

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

async function logout() {
  try {
    await useApi()('/api/auth/logout', { method: 'POST' })
  } finally {
    await clear()
    await navigateTo('/login')
  }
}
</script>

<template>
  <div class="flex min-h-screen">
    <!-- Barre supérieure mobile -->
    <header class="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink px-4 lg:hidden">
      <NuxtLink to="/" class="flex items-center gap-2 font-semibold"><img src="/logo.svg" alt="" class="size-7" /> MPortal</NuxtLink>
      <button class="btn-ghost btn-sm" aria-label="Ouvrir le menu" @click="mobileOpen = true"><Menu class="size-5" /></button>
    </header>

    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/60 lg:hidden" @click="mobileOpen = false" />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-black p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="mb-8 flex items-center justify-between px-2">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img src="/logo.svg" alt="" class="size-9" />
          <span class="text-xl font-bold">MPortal</span>
        </NuxtLink>
        <button class="btn-ghost btn-sm lg:hidden" aria-label="Fermer le menu" @click="mobileOpen = false"><X class="size-5" /></button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
          :class="isActive(item.to) ? 'bg-white font-medium text-black' : 'text-neutral-300 hover:bg-card-2 hover:text-white'"
        >
          <component :is="item.icon" class="size-4.5" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="mt-4 border-t border-line pt-4">
        <NuxtLink to="/profile" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-card-2 hover:text-white">
          <UserRound class="size-4.5" />
          <span class="truncate">{{ user ? `${user.firstname} ${user.lastname}` : 'Profil' }}</span>
        </NuxtLink>
        <button class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-card-2 hover:text-white" @click="logout">
          <LogOut class="size-4.5" />
          Se déconnecter
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1 px-4 pt-20 pb-10 sm:px-8 lg:pt-8">
      <div class="mx-auto max-w-7xl">
        <slot />
      </div>
    </main>
    <AppToasts />
  </div>
</template>
