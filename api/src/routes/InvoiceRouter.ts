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

import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import { Data } from "swissqrbill/types";
import config from "../config/config";
import dayjs from "dayjs";
import path from "path";

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
      const invoiceEntities = await InvoiceEntity.createQueryBuilder("invoice")
        .leftJoinAndSelect("invoice.client", "client")
        .leftJoinAndSelect("invoice.invoiceLogs", "invoiceLogs")
        .leftJoinAndSelect("invoiceLogs.client", "invoiceLogsClient")
        .leftJoinAndSelect("invoiceLogs.invoice", "invoiceLogsInvoice")
        .leftJoinAndSelect("invoice.invoiceServices", "invoiceServices")
        .leftJoinAndSelect("invoiceServices.service", "service")
        .leftJoinAndSelect("invoiceServices.invoice", "invoiceServiceInvoice")
        .where("invoice.archived = false")
        .orderBy(
          `FIELD(invoice.state, 'CREATED', 'GENERATED', 'SENT', 'PAID', 'CANCELLED', 'UNPAID')`,
        )
        .getMany();

      const invoices = invoiceEntities.map((invoice) => {
        let amount = 0;
        invoice.invoiceServices.forEach((service) => {
          if (service.amount) {
            amount += service.amount * service.quantity;
          }
        });
        return {
          id: invoice.id,
          name: invoice.name,
          number: invoice.number,
          reference: invoice.reference,
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
      function computeQRReference(base: string): string {
        const weights = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
        let carry = 0;

        for (const digit of base) {
          carry = weights[(parseInt(digit, 10) + carry) % 10];
        }

        const checkDigit = (10 - carry) % 10;
        return base + checkDigit;
      }

      const invoice = new InvoiceEntity();
      invoice.name = name;
      invoice.number = await SettingManager.getNextInvoiceNumber();
      invoice.reference = computeQRReference(
        invoice.number.toString().padStart(26, "0"),
      );
      invoice.client = client;
      invoice.state = InvoiceState.CREATED;
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
      invoice.state = InvoiceState.UPDATED;
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
      request: ApplicationRequest<{ token: string; data: { id: number } }>,
      response: Response,
    ) => {
      if (!request.body.data?.id) {
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
          invoiceServices: { service: true },
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

      const generatedLog = new InvoiceLogEntity();
      generatedLog.invoice = invoice;
      generatedLog.client = invoice.client;
      generatedLog.code = InvoiceState.GENERATED;
      generatedLog.details = `Invoice ${invoice.number} has been generated by ${request.user?.firstname}`;
      await generatedLog.save();

      if (!invoice.dueAt) {
        invoice.dueAt = dayjs().add(30, "day").format("YYYY-MM-DD HH:mm:ss");
        await invoice.save();
      }

      let total = 0;
      invoice.invoiceServices.forEach((s) => {
        total += s.amount * s.quantity;
      });

      const data: Data = {
        amount: total,
        currency: "CHF",
        creditor: {
          account: config.mdev.bank.iban,
          address: config.mdev.bank.address,
          buildingNumber: config.mdev.bank.number,
          city: config.mdev.bank.city,
          country: config.mdev.bank.country,
          name: config.mdev.bank.name,
          zip: config.mdev.bank.postalCode,
        },
        debtor: {
          address: invoice.client.address,
          buildingNumber: invoice.client.addressNumber,
          city: invoice.client.city,
          country: "CH",
          name: invoice.client.name,
          zip: invoice.client.postalCode,
        },
        reference: invoice.reference,
      };

      // Préparation PDF
      const pdf = new PDFDocument({ size: "A4", margin: 50 });
      const qrBill = new SwissQRBill(data, { language: "FR" });

      const logoPath = path.resolve(__dirname, "../../assets/mdevelopment.png");
      const fontRegular = path.resolve(
        __dirname,
        "../../assets/fonts/Outfit-Regular.ttf",
      );
      const fontBold = path.resolve(
        __dirname,
        "../../assets/fonts/Outfit-Bold.ttf",
      );

      pdf.registerFont("Outfit", fontRegular);
      pdf.registerFont("Outfit-Bold", fontBold);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoice.name}.pdf"`,
      );
      pdf.pipe(response);

      // 1. Logo
      pdf.image(logoPath, 50, 120, { width: 100 });

      // 2. En-tête
      pdf
        .font("Outfit-Bold")
        .fontSize(20)
        .text("FACTURE", 350, 50, { align: "right" });

      pdf
        .fontSize(9)
        .font("Outfit-Bold")
        .text("MDevelopment", 350, 120, { align: "right" })
        .font("Outfit")
        .text(config.mdev.bank.name, { align: "right" })
        .text(`${config.mdev.bank.address} ${config.mdev.bank.number}`, {
          align: "right",
        })
        .text(`${config.mdev.bank.postalCode} ${config.mdev.bank.city}`, {
          align: "right",
        })
        .text("contact@mdevelopment.ch", { align: "right" });

      // 3. Infos client et facture
      const infoTop = 220;
      const leftX = 60;
      const rightX = 350;

      pdf.font("Outfit-Bold").fontSize(9).text("FACTURÉ À", leftX, infoTop);
      pdf
        .font("Outfit")
        .text(invoice.client.name, leftX, infoTop + 15)
        .text(
          `${invoice.client.address} ${invoice.client.addressNumber}`,
          leftX,
          infoTop + 30,
        )
        .text(
          `${invoice.client.postalCode} ${invoice.client.city}`,
          leftX,
          infoTop + 45,
        );

      pdf
        .font("Outfit")
        .text(`Facture N° : ${invoice.number}`, rightX, infoTop, {
          align: "right",
        })
        .text(`Date : ${dayjs().format("DD.MM.YYYY")}`, rightX, infoTop + 15, {
          align: "right",
        })
        .text(
          `Échéance : ${dayjs(invoice.dueAt).format("DD.MM.YYYY")}`,
          rightX,
          infoTop + 30,
          { align: "right" },
        );

      // 4. Tableau
      pdf.moveDown().moveDown();
      const tableTop = pdf.y + 10;
      const itemHeight = 20;

      // Header avec fond gris
      pdf.rect(50, tableTop, 500, itemHeight).fill("#eeeeee");

      pdf
        .fillColor("black")
        .font("Outfit-Bold")
        .fontSize(9)
        .text("Description", 60, tableTop + 5)
        .text("Quantité", 250, tableTop + 5, { width: 50, align: "right" })
        .text("Prix", 350, tableTop + 5, { width: 50, align: "right" })
        .text("Montant", 450, tableTop + 5, {
          width: 70,
          align: "right",
        });

      // Lignes
      pdf.font("Outfit").fontSize(9).fillColor("black");
      let i = 1;
      invoice.invoiceServices.forEach((s) => {
        const y = tableTop + i * itemHeight;

        // Ligne de séparation
        pdf
          .moveTo(50, y)
          .lineTo(550, y)
          .strokeColor("#cccccc")
          .lineWidth(0.5)
          .stroke();

        pdf
          .text(s.service.name, 60, y + 5)
          .text(s.quantity.toString(), 250, y + 5, {
            width: 50,
            align: "right",
          })
          .text(s.amount.toFixed(2) + " CHF", 300, y + 5, {
            width: 100,
            align: "right",
          })
          .text((s.amount * s.quantity).toFixed(2) + " CHF", 420, y + 5, {
            width: 100,
            align: "right",
          });

        i++;
      });

      const yTotal = tableTop + i * itemHeight + 10;
      const lineWidth = 500; // largeur du tableau ou de la page souhaitée
      const lineStartX = 50; // position X de départ (ajuste selon ta mise en page)

      pdf.lineWidth(1).strokeColor("#000000");

      // Ligne au-dessus
      pdf
        .moveTo(lineStartX, yTotal - 3)
        .lineTo(lineStartX + lineWidth, yTotal - 3)
        .stroke();

      // Texte TOTAL
      pdf
        .font("Outfit-Bold")
        .fontSize(9)
        .text("TOTAL À PAYER (CHF)", 255, yTotal, {
          width: 100,
          align: "right",
        })
        .text(`${total.toFixed(2)} CHF`, 450, yTotal, {
          width: 70,
          align: "right",
        });

      // Ligne en dessous
      pdf
        .moveTo(lineStartX, yTotal + 15) // ajuste +12 si ton texte est plus haut
        .lineTo(lineStartX + lineWidth, yTotal + 15)
        .stroke();

      // QR-Bill
      pdf.moveDown().moveDown();
      qrBill.attachTo(pdf);

      pdf.end();
    },
  ),
);

export default InvoiceRouter;
