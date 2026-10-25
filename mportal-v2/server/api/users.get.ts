import { users } from '../db/schema'

/** Liste des associés (pour le classement des prélèvements). */
export default defineEventHandler(async () =>
  useDb().select({ id: users.id, firstname: users.firstname, lastname: users.lastname }).from(users),
)
