import { listContracts } from '../../domain/contracts'

export default defineEventHandler(async () => listContracts(useDb()))
