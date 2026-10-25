import { z } from 'zod'
import { getDashboard } from '../domain/dashboard'
import { todayIso } from '../../shared/utils/dates'

export default defineEventHandler(async (event) => {
  const { year } = parseQuery(event, z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }))
  return getDashboard(useDb(), year ?? Number(todayIso().slice(0, 4)))
})
