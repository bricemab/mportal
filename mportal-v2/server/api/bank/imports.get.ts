import { listImports } from '../../domain/bank/bank'

export default defineEventHandler(async () => listImports(useDb()))
