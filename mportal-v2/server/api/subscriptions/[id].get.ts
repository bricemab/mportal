import { getSubscriptionDetail } from '../../domain/subscriptions'

export default defineEventHandler(async (event) => getSubscriptionDetail(useDb(), parseId(event)))
