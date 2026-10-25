import type { ApiClient } from '~/plugins/api'

/** Client HTTP de l'application (cookie de session + gestion du 401). */
export function useApi(): ApiClient {
  return useNuxtApp().$api as ApiClient
}

type QueryValue = string | number | boolean | undefined | null

interface ApiFetchOptions {
  query?: MaybeRefOrGetter<Record<string, QueryValue>>
}

/**
 * Chargement de données typé, branché sur le client de l'application.
 * La clé dépend de l'URL et des paramètres : tout changement relance la requête.
 */
export function useApiFetch<T>(url: MaybeRefOrGetter<string>, options: ApiFetchOptions = {}) {
  const api = useApi()
  return useAsyncData<T>(
    () => `${toValue(url)}?${JSON.stringify(toValue(options.query) ?? {})}`,
    () => api<T>(toValue(url), { query: toValue(options.query) }),
    { deep: false },
  )
}

type Method = 'POST' | 'PUT' | 'DELETE'

/**
 * Exécute une action (création, modification…) avec indicateur de chargement
 * et toast de succès / d'erreur. Retourne le résultat ou null en cas d'échec.
 */
export function useAction() {
  const pending = ref(false)
  const toast = useToast()

  async function run<T = unknown>(method: Method, url: string, body?: Record<string, unknown> | FormData, successMessage?: string): Promise<T | null> {
    pending.value = true
    try {
      const result = await useApi()<T>(url, { method, body })
      if (successMessage) toast.success(successMessage)
      return result
    } catch (error) {
      toast.error(errorMessage(error))
      return null
    } finally {
      pending.value = false
    }
  }

  return { pending, run }
}
