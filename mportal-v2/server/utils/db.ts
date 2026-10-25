import { createDb, type Db, type DbHandle } from '../db/client'

let handle: DbHandle | null = null

export function useDbHandle(): DbHandle {
  if (!handle) {
    const config = useRuntimeConfig()
    handle = createDb(config.databaseUrl)
  }
  return handle
}

export function useDb(): Db {
  return useDbHandle().db
}
