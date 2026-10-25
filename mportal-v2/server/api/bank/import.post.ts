import { importStatement } from '../../domain/bank/bank'

export default defineEventHandler(async (event) => {
  const actor = requireActor(event)
  const { file } = await readSingleFile(event, 10_000_000)
  return importStatement(useDb(), actor, file.name, file.data)
})
