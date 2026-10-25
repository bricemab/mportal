import { getClientDetail } from '../../domain/clients'

export default defineEventHandler(async (event) => getClientDetail(useDb(), parseId(event)))
