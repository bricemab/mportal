export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let counter = 0

/** Notifications éphémères affichées par <AppToasts /> dans le layout. */
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function remove(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(kind: ToastKind, message: string, duration = 4500) {
    const id = ++counter
    toasts.value = [...toasts.value, { id, kind, message }]
    if (import.meta.client) setTimeout(() => remove(id), duration)
  }

  return {
    toasts,
    remove,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 7000),
    info: (message: string) => push('info', message),
  }
}

/** Extrait le message lisible d'une erreur d'API (h3 createError → data.message). */
export function errorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (typeof error === 'object' && error !== null) {
    const data = 'data' in error ? (error as { data: unknown }).data : null
    if (typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message: unknown }).message === 'string') {
      return (data as { message: string }).message
    }
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      const message = (error as { message: string }).message
      if (!message.startsWith('[')) return message
    }
  }
  return fallback
}
