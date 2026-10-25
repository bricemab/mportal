import { getContract } from '../../../domain/contracts'
import { notFound } from '../../../domain/errors'

export default defineEventHandler(async (event) => {
  const contract = await getContract(useDb(), parseId(event))
  if (!contract.fileName) throw notFound('Aucun fichier pour ce contrat')
  const content = await useFileStorage().read('contracts', contract.fileName)
  return sendPdf(event, content, contract.fileOriginalName ?? `contrat-${contract.id}.pdf`)
})
