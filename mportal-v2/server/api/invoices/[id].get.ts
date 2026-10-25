import { getInvoiceDetail } from '../../domain/invoices'

export default defineEventHandler(async (event) => getInvoiceDetail(useDb(), parseId(event)))
