<script setup lang="ts">
import { useRoute } from 'vue-router'

const menuItems = [
    { icon: 'bx bx-home-alt-2', label: 'Dashboard', to: '/' },
    { icon: 'bx bx-group', label: 'Clients', to: '/clients' },
    { icon: 'bx bxs-component', label: 'Services', to: '/services' },
    { icon: 'bx bxs-bank', label: 'Facturations', to: '/invoices' },
]

const route = useRoute()

</script>

<template>
    <aside class="h-screen bg-black text-white transition-all duration-300 flex flex-col p-4 relative w-64">

        <div class="flex items-center  mb-9 px-2">
            <img src="../assets/ressources/logo.svg" class="w-10 h-10" />
            <span class="text-2xl font-bold">MPortal</span>
        </div>

        <ul class="space-y-6 flex-1">
            <li v-for="item in menuItems" :key="item.label">
                <router-link :to="item.to" class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
                    :class="[
                        route.path === item.to
                            ? 'bg-white text-black'
                            : 'hover:text-black hover:bg-white',
                    ]">
                    <i :class="item.icon + ' text-xl'"></i>
                    <span>{{ item.label }}</span>
                    <i class="ml-auto text-sm bx bx-chevron-right" />
                </router-link>
            </li>
        </ul>
    </aside>
</template>
