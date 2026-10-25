import { getSettings } from '../../domain/settings'

export default defineEventHandler(async () => getSettings(useDb()))
