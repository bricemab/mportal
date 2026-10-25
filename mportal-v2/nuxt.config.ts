import tailwindcss from '@tailwindcss/vite'

const isDev = process.env.NODE_ENV !== 'production'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['nuxt-auth-utils', 'nuxt-security'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['chart.js', 'vue-chartjs', 'lucide-vue-next'],
    },
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'MPortal',
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
  runtimeConfig: {
    // Toutes ces valeurs sont surchargées par les variables d'environnement NUXT_*
    databaseUrl: '',
    storageDir: './storage',
    cronSecret: '',
    migrateOnStart: true,
    schedulerEnabled: true,
    session: {
      name: 'mportal-session',
      password: '',
      maxAge: 60 * 60 * 12,
      cookie: {
        sameSite: 'strict',
        httpOnly: true,
        secure: !isDev,
      },
    },
  },
  nitro: {
    preset: 'node-server',
    serverAssets: [
      { baseName: 'migrations', dir: './db/migrations' },
      { baseName: 'pdf', dir: './assets' },
    ],
  },
  security: {
    strict: false,
    nonce: true,
    sri: true,
    headers: {
      crossOriginEmbedderPolicy: isDev ? 'unsafe-none' : 'credentialless',
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'base-uri': ["'none'"],
        'connect-src': ["'self'"],
        'font-src': ["'self'", 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'object-src': ["'none'"],
        'script-src': ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'worker-src': ["'self'", 'blob:'],
        'upgrade-insecure-requests': !isDev,
      },
      referrerPolicy: 'no-referrer',
      strictTransportSecurity: isDev ? false : { maxAge: 31536000, includeSubdomains: true },
      xFrameOptions: 'DENY',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        'display-capture': [],
        fullscreen: [],
        payment: [],
      },
    },
    // Validation stricte faite par Zod sur chaque route ; le rendu Vue échappe tout.
    xssValidator: false,
    rateLimiter: {
      tokensPerInterval: 300,
      interval: 300000,
      headers: false,
      // Derrière le proxy Infomaniak, l'IP réelle du client est dans X-Forwarded-For
      ipHeader: isDev ? undefined : 'x-forwarded-for',
    },
    requestSizeLimiter: {
      maxRequestSizeInBytes: 1_000_000,
      maxUploadFileRequestInBytes: 10_000_000,
    },
    corsHandler: false,
    hidePoweredBy: true,
    removeLoggers: !isDev,
  },
  routeRules: {
    '/api/auth/login': {
      security: {
        rateLimiter: { tokensPerInterval: 10, interval: 60000 },
      },
    },
  },
})
