export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown> | FormData
  query?: Record<string, string | number | boolean | null | undefined>
}

/** Client HTTP typé simplement (les types de réponse sont fournis par l'appelant via ~/types/api). */
export type ApiClient = <T = unknown>(url: string, options?: ApiRequestOptions) => Promise<T>

/**
 * Client HTTP de l'application : transmet le cookie de session lors du rendu serveur
 * et renvoie vers la page de connexion dès que l'API répond 401.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const raw = $fetch.create({
    headers,
    async onResponseError({ response }) {
      if (response.status === 401 && import.meta.client) {
        const { clear } = useUserSession()
        await clear()
        await nuxtApp.runWithContext(() => navigateTo('/login'))
      }
    },
  }) as unknown as (url: string, options?: ApiRequestOptions) => Promise<unknown>

  const api: ApiClient = <T,>(url: string, options?: ApiRequestOptions) => raw(url, options) as Promise<T>

  return { provide: { api } }
})
