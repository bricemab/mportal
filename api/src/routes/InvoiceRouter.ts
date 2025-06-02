import { Response, Router } from "express";
import { ApplicationRequest } from "../utils/Types";
import RequestManager from "../utils/RequestManager";
import { GeneralErrors } from "../utils/BackendErrors";
import { ClientEntity } from "../entities/Client/ClientEntity";
import { InvoiceEntity } from "../entities/Invoice/InvoiceEntity";
import { InvoiceState } from "../entities/Invoice/InvoiceState";
import { InvoiceServiceEntity } from "../entities/InvoiceService/InvoiceServiceEntity";
import { ServiceEntity } from "../entities/Service/ServiceEntity";
import { InvoiceLogEntity } from "../entities/InvoiceLog/InvoiceLogEntity";
import SettingManager from "../entities/Setting/SettingManager";
import { createWriteStream } from "node:fs";

import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import { Data } from "swissqrbill/types";
import Config from "../config/config";
import config from "../config/config";

const InvoiceRouter = Router();

RequestManager.post(
  InvoiceRouter,
  "/list",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: object;
      }>,
      response: Response,
    ) => {
      const invoiceEntities = await InvoiceEntity.find({
        where: {
          archived: false,
        },
        order: {
          name: "ASC",
        },
        relations: {
          client: true,
          invoiceLogs: {
            client: true,
            invoice: true,
          },
          invoiceServices: {
            service: true,
            invoice: true,
          },
        },
      });

      const invoices = invoiceEntities.map((invoice) => {
        let amount = 0;
        invoice.invoiceServices.forEach((service) => {
          if (service.amount) {
            amount += service.amount;
          }
        });
        return {
          id: invoice.id,
          name: invoice.name,
          number: invoice.number,
          state: invoice.state,
          client: invoice.client.toJSON(),
          amount: amount.toFixed(2),
          logs: invoice.invoiceLogs.map((log) => {
            return log.toJSON();
          }),
          services: invoice.invoiceServices.map((service) => {
            return service.toJSON();
          }),
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        };
      });

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          invoices,
        },
      });
    },
  ),
);

RequestManager.post(
  InvoiceRouter,
  "/create",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          name: string;
          clientId: number;
          services: {
            serviceId: number;
            amount: number;
            quantity: number;
          }[];
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.name ||
        !request.body.data.clientId ||
        !request.body.data.services ||
        request.body.data.services.length === 0
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { name, clientId, services } = request.body.data;
      const client = await ClientEntity.findOne({
        where: { id: clientId },
      });
      if (!client) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Client not found",
          },
        });
      }
      const invoice = new InvoiceEntity();
      invoice.name = name;
      invoice.number = await SettingManager.getNextInvoiceNumber();
      invoice.client = client;
      invoice.state = InvoiceState.GENERATED;
      await invoice.save();
      for (const serviceData of services) {
        const service = await ServiceEntity.findOne({
          where: { id: serviceData.serviceId },
        });
        if (!service) {
          continue;
        }
        const invoiceService = new InvoiceServiceEntity();
        invoiceService.invoice = invoice;
        invoiceService.service = service;
        invoiceService.amount = serviceData.amount;
        invoiceService.quantity = serviceData.quantity;
        await invoiceService.save();
      }
      const invoiceLogs = new InvoiceLogEntity();
      invoiceLogs.invoice = invoice;
      invoiceLogs.client = client;
      invoiceLogs.code = InvoiceState.CREATED;
      invoiceLogs.details = `Invoice ${invoice.number} has been created by ${request.user?.firstname}`;
      await invoiceLogs.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          invoice,
        },
      });
    },
  ),
);

RequestManager.post(
  InvoiceRouter,
  "/edit",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
          name: string;
          clientId: number;
          services: {
            serviceId: number;
            amount: number;
            quantity: number;
          }[];
        };
      }>,
      response: Response,
    ) => {
      const { id, name, clientId, services } = request.body.data;

      if (!id || !name || !clientId || !services || services.length === 0) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }

      const invoice = await InvoiceEntity.findOne({
        where: { id },
      });

      if (!invoice) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Invoice not found",
          },
        });
      }

      const client = await ClientEntity.findOneBy({ id: clientId });

      if (!client) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Client not found",
          },
        });
      }

      invoice.name = name;
      invoice.client = client;
      await invoice.save();

      await InvoiceServiceEntity.delete({ invoice: { id } });

      for (const serviceData of services) {
        const service = await ServiceEntity.findOneBy({
          id: serviceData.serviceId,
        });
        if (!service) continue;
        const invoiceService = new InvoiceServiceEntity();
        invoiceService.invoice = invoice;
        invoiceService.service = service;
        invoiceService.amount = serviceData.amount;
        invoiceService.quantity = serviceData.quantity;
        await invoiceService.save();
      }

      const log = new InvoiceLogEntity();
      log.invoice = invoice;
      log.client = client;
      log.code = InvoiceState.UPDATED;
      log.details = `Invoice ${invoice.number} has been updated by ${request.user?.firstname}`;
      await log.save();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          invoice,
        },
      });
    },
  ),
);

RequestManager.post(
  InvoiceRouter,
  "/change-state",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
          state: InvoiceState;
        };
      }>,
      response: Response,
    ) => {
      if (!request.body.data || !request.body.data.id) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { id } = request.body.data;

      const invoice = await InvoiceEntity.findOne({
        where: { id },
        relations: {
          client: true,
        },
      });
      if (!invoice) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Invoice not found",
          },
        });
      }
      const { state } = request.body.data;
      if (!Object.values(InvoiceState).includes(state)) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Invalid state",
          },
        });
      }
      invoice.state = state;
      await invoice.save();
      const invoiceLog = new InvoiceLogEntity();
      invoiceLog.invoice = invoice;
      invoiceLog.client = invoice.client;
      invoiceLog.code = state;
      invoiceLog.details = `Invoice ${invoice.number} state changed to ${state} by ${request.user?.firstname}`;
      await invoiceLog.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          log: invoiceLog.toJSON(),
        },
      });
    },
  ),
);

RequestManager.post(
  InvoiceRouter,
  "/delete",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
        };
      }>,
      response: Response,
    ) => {
      if (!request.body.data || !request.body.data.id) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { id } = request.body.data;

      const invoice = await InvoiceEntity.findOne({
        where: { id },
      });
      if (!invoice) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Invoice not found",
          },
        });
      }
      const invoiceServices = await InvoiceServiceEntity.find({
        where: { invoice: { id: invoice.id } },
      });
      for (const invoiceService of invoiceServices) {
        await invoiceService.remove();
      }
      await invoice.remove();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {},
      });
    },
  ),
);

RequestManager.post(
  InvoiceRouter,
  "/generate",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
        };
      }>,
      response: Response,
    ) => {
      if (!request.body.data || !request.body.data.id) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { id } = request.body.data;

      const invoice = await InvoiceEntity.findOne({
        where: { id },
        relations: {
          invoiceServices: true,
          client: true,
        },
      });
      if (!invoice) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Invoice not found",
          },
        });
      }
      const log = await InvoiceLogEntity.findOne({
        where: { invoice: { id: invoice.id }, code: InvoiceState.SENT },
      });
      if (!log) {
        invoice.state = InvoiceState.GENERATED;
        await invoice.save();
      }
      let amount = 0;
      invoice.invoiceServices.map((service) => {
        amount += service.amount * service.quantity;
      });

      const data: Data = {
        amount,
        creditor: {
          account: config.mdev.bank.iban,
          address: config.mdev.bank.address,
          buildingNumber: config.mdev.bank.number,
          city: config.mdev.bank.city,
          country: config.mdev.bank.country,
          name: config.mdev.bank.name,
          zip: config.mdev.bank.postalCode,
        },
        currency: "CHF",
        debtor: {
          address: invoice.client.address,
          buildingNumber: invoice.client.addressNumber,
          city: invoice.client.city,
          country: "CH",
          name: invoice.client.name,
          zip: invoice.client.postalCode,
        },
        reference: "21 00000 00003 13947 14300 09017",
      };

      const pdf = new PDFDocument({ size: "A4" });
      const qrBill = new SwissQRBill(data);
      qrBill.attachTo(pdf);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'attachment; filename="qr-bill.pdf"',
      );

      pdf.pipe(response);
      pdf.end();
    },
  ),
);

export default InvoiceRouter;
