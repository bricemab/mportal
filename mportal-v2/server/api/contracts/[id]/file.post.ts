import { getContract, setContractFile } from '../../../domain/contracts'
import { badRequest } from '../../../domain/errors'
import { isPdf } from '../../../domain/storage'

/** Upload du PDF du contrat (remplace le précédent). */
export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const id = parseId(event)
  await getContract(useDb(), id)
  const { file } = await readSingleFile(event, 10_000_000)
  if (!isPdf(file.data)) throw badRequest('Seuls les fichiers PDF sont acceptés')
  const storage = useFileStorage()
  const stored = await storage.save('contracts', `contrat-${id}`, 'pdf', file.data)
  const previous = await useDb().transaction((tx) => setContractFile(tx, actor, id, stored, file.name))
  if (previous) await storage.remove('contracts', previous)
  return { ok: true }
})
