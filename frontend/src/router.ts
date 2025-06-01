import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import App from '@/App.vue'

import NoLayout from './views/layouts/NoLayout.vue'
import DefaultLayout from './views/layouts/DefaultLayout.vue'
import LoginPage from '@/views/pages/no-layout/LoginPage.vue'
import IndexPage from '@/views/pages/default-layout/IndexPage.vue'
import AclManager from '@/AclManager.ts'
import UI from './views/pages/default-layout/UI.vue'
import ClientsPage from './views/pages/default-layout/ClientsPage.vue'
import ServicesPage from './views/pages/default-layout/ServicesPage.vue'
import BillingPage from './views/pages/default-layout/BillingPage.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'root',
    component: App,
    children: [
      {
        path: '/login',
        name: 'no-layout',
        component: NoLayout,
        children: [
          {
            path: '',
            name: 'login-page',
            component: LoginPage,
            meta: { logged: false },
          },
        ],
      },
      {
        path: '',
        name: 'default-layout',
        component: DefaultLayout,
        redirect() {
          return { name: 'index-page' }
        },
        children: [
          {
            path: '',
            name: 'index-page',
            component: IndexPage,
            meta: { logged: true },
          },
          {
            path: 'UI',
            name: 'ui-page',
            component: UI,
            meta: { logged: true },
          },
          {
            path: 'clients',
            name: 'client-page',
            component: ClientsPage,
            meta: { logged: true },
          },
          {
            path: 'services',
            name: 'service-page',
            component: ServicesPage,
            meta: { logged: true },
          },
          {
            path: 'billings',
            name: 'billing-page',
            component: BillingPage,
            meta: { logged: true },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    meta: {
      logged: true,
    },
    redirect() {
      return { name: 'login-page' }
    },
  },
]

const router = createRouter({
  linkActiveClass: 'router-active',
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  // @ts-ignore
  const { isAllow, redirectRouteName, params } = AclManager.hasPermission(to.meta.logged)
  console.log('ACL Check:', to.name, isAllow, redirectRouteName, params)
  if (isAllow) {
    next()
  } else {
    if (params) {
      // @ts-ignore
      next({ name: redirectRouteName, params: params })
    } else {
      next({ name: redirectRouteName })
    }
  }
})

export default router
