import { getContractDetail } from '../../domain/contracts'

export default defineEventHandler(async (event) => getContractDetail(useDb(), parseId(event)))
