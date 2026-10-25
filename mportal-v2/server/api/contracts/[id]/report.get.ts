import { z } from 'zod'
import { buildContractReport } from '../../../domain/pdf/contract-report'

export default defineEventHandler(async (event) => {
  const id = parseId(event)
  const { periodId } = parseQuery(event, z.object({ periodId: z.coerce.number().int().positive() }))
  const { content, fileName } = await buildContractReport(useDb(), id, periodId, await usePdfAssets())
  return sendPdf(event, content, fileName)
})
