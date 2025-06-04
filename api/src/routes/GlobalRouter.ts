import { Response, Router } from "express";
import { ApplicationRequest } from "../utils/Types";
import RequestManager from "../utils/RequestManager";
import { ClientEntity } from "../entities/Client/ClientEntity";
import { ServiceEntity } from "../entities/Service/ServiceEntity";
import { InvoiceEntity } from "../entities/Invoice/InvoiceEntity";
import {
  getBestClientOverall,
  getBestMonthOverall,
  getBestYearOverall,
  getCumulativeRevenueForYear,
} from "../entities/Invoice/InvoiceManager";
import { GeneralErrors } from "../utils/BackendErrors";
import { InvoiceState } from "../entities/Invoice/InvoiceState";

const GlobalRouter = Router();

RequestManager.post(
  GlobalRouter,
  "/load",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          year: number;
        };
      }>,
      response: Response,
    ) => {
      if (!request.body.data || !request.body.data.year) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { year } = request.body.data;

      const clientsNumber = await ClientEntity.count({
        where: {
          archived: false,
        },
      });
      const servicesNumber = await ServiceEntity.count({
        where: {
          archived: false,
        },
      });
      const invoicesNumber = await InvoiceEntity.count({
        where: {
          archived: false,
          state: InvoiceState.SENT,
        },
      });

      const totalCA = await getCumulativeRevenueForYear(year);
      const bestMonth = await getBestMonthOverall();
      const bestYear = await getBestYearOverall();
      const bestClient = await getBestClientOverall();

      const invoices = await InvoiceEntity.find({
        where: {
          archived: false,
        },
        take: 3,
        relations: {
          client: true,
          invoiceServices: {
            service: true,
          },
        },
        order: {
          createdAt: "DESC",
        },
      });

      const invoicesData = invoices.map((invoice) => ({
        id: invoice.id,
        name: invoice.name,
        number: invoice.number,
        reference: invoice.reference,
        amount: invoice.invoiceServices.reduce(
          (sum, service) => sum + service.amount * service.quantity,
          0,
        ),
        state: invoice.state,
        client: {
          id: invoice.client.id,
          name: invoice.client.name,
        },
        dueAt: invoice.dueAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      }));

      const result = await InvoiceEntity.createQueryBuilder("invoice")
        .select("DISTINCT YEAR(invoice.createdAt)", "year")
        .orderBy("year", "ASC")
        .getRawMany();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          clientsNumber,
          servicesNumber,
          invoicesNumber,
          totalCA,
          bestMonth,
          bestYear,
          bestClient,
          years: result.map((row) => parseInt(row.year)),
          invoices: invoicesData,
        },
      });
    },
  ),
);

export default GlobalRouter;
