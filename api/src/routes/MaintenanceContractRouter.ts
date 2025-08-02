import { Response, Router } from "express";
import RequestManager from "../utils/RequestManager";
import { ApplicationRequest } from "../utils/Types";
import { MaintenanceContractEntity } from "../entities/MaintenanceContract/MaintenanceContractEntity";
import dayjs from "dayjs";
import { GeneralErrors } from "../utils/BackendErrors";
import { ClientEntity } from "../entities/Client/ClientEntity";
import { InvoiceEntity } from "../entities/Invoice/InvoiceEntity";
import SettingManager from "../entities/Setting/SettingManager";
import { InvoiceState } from "../entities/Invoice/InvoiceState";
import Utils from "../utils/Utils";
import { ContractInvoiceEntity } from "../entities/ContractInvoice/ContractInvoiceEntity";
import { ContractHourEntity } from "../entities/ContractHour/ContractHourEntity";
import { InvoiceServiceEntity } from "../entities/InvoiceService/InvoiceServiceEntity";
import { ServiceEntity } from "../entities/Service/ServiceEntity";

const MaintenanceContractRouter = Router();

RequestManager.post(
  MaintenanceContractRouter,
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
      const maintenanceContracts =
        await MaintenanceContractEntity.createQueryBuilder(
          "maintenanceContract",
        )
          .leftJoinAndSelect("maintenanceContract.client", "client")
          .orderBy(`maintenanceContract.endAt`)
          .getMany();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          maintenanceContracts: maintenanceContracts.map(
            (maintenanceContract) => {
              return {
                id: maintenanceContract.id,
                name: maintenanceContract.name,
                client: {
                  id: maintenanceContract.client.id,
                  name: maintenanceContract.client.name,
                  firstname: maintenanceContract.client.firstname,
                  lastname: maintenanceContract.client.lastname,
                },
                totalHours: maintenanceContract.totalHours,
                remainingHours: maintenanceContract.remainingHours,
                price: maintenanceContract.price,
                path: maintenanceContract.path,
                startAt: dayjs(maintenanceContract.startAt).format(
                  "YYYY-MM-DD",
                ),
                endAt: dayjs(maintenanceContract.endAt).format("YYYY-MM-DD"),
                createdAt: dayjs(maintenanceContract.createdAt).format(
                  "YYYY-MM-DD",
                ),
                updatedAt: dayjs(maintenanceContract.updatedAt).format(
                  "YYYY-MM-DD",
                ),
              };
            },
          ),
        },
      });
    },
  ),
);

RequestManager.post(
  MaintenanceContractRouter,
  "/details",
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

      const contract = await MaintenanceContractEntity.findOne({
        where: {
          id: id,
        },
        relations: {
          client: true,
          contractHours: true,
        },
      });

      if (!contract) {
        return RequestManager.sendResponse(response, {
          success: true,
          data: {
            contract: null,
          },
        });
      }

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          contract: {
            id: contract.id,
            name: contract.name,
            client: {
              id: contract.client.id,
              name: contract.client.name,
              firstname: contract.client.firstname,
              lastname: contract.client.lastname,
            },
            contractHours: contract.contractHours,
            totalHours: contract.totalHours,
            remainingHours: contract.remainingHours,
            price: contract.price,
            path: contract.path,
            startAt: dayjs(contract.startAt).format("YYYY-MM-DD"),
            endAt: dayjs(contract.endAt).format("YYYY-MM-DD"),
            createdAt: dayjs(contract.createdAt).format("YYYY-MM-DD"),
            updatedAt: dayjs(contract.updatedAt).format("YYYY-MM-DD"),
          },
        },
      });
    },
  ),
);

RequestManager.post(
  MaintenanceContractRouter,
  "/create",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          name: string;
          clientId: number;
          totalHours: number;
          price: number;
          contractPath: string;
          startDate: string;
          endDate: string;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.name ||
        !request.body.data.clientId ||
        !request.body.data.totalHours ||
        !request.body.data.price ||
        !request.body.data.contractPath ||
        !request.body.data.startDate ||
        !request.body.data.endDate
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const {
        name,
        clientId,
        endDate,
        startDate,
        price,
        contractPath,
        totalHours,
      } = request.body.data;

      const client = (await ClientEntity.findOneBy({ id: clientId }))!;

      const contract = new MaintenanceContractEntity();
      contract.name = name;
      contract.client = client;
      contract.remainingHours = totalHours;
      contract.totalHours = totalHours;
      contract.price = price;
      contract.path = contractPath;
      contract.startAt = startDate;
      contract.endAt = endDate;
      await contract.save();

      const invoice = new InvoiceEntity();
      invoice.name =
        "Contrat maintenance - " +
        client.name +
        " - " +
        dayjs(startDate).format("DD.MM.YYYY") +
        " à " +
        dayjs(endDate).format("DD.MM.YYYY");
      invoice.number = await SettingManager.getNextInvoiceNumber();
      invoice.state = InvoiceState.CREATED;
      invoice.reference = Utils.computeQRReference(
        invoice.number.toString().padStart(26, "0"),
      );
      invoice.client = client;
      await invoice.save();

      const invoiceService = new InvoiceServiceEntity();
      invoiceService.amount = price;
      invoiceService.quantity = 1;
      invoiceService.invoice = invoice;
      invoiceService.service = (await ServiceEntity.findOneBy({
        id: 11, // ID du contrat de maintenance
      }))!;
      await invoiceService.save();

      const contractInvoice = new ContractInvoiceEntity();
      contractInvoice.invoice = invoice;
      contractInvoice.contract = contract;
      await contractInvoice.save();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {},
      });
    },
  ),
);

RequestManager.post(
  MaintenanceContractRouter,
  "/renew",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          originalContractId: number;
          name: string;
          totalHours: number;
          price: number;
          contractPath: string;
          startDate: string;
          endDate: string;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.originalContractId ||
        !request.body.data.name ||
        !request.body.data.totalHours ||
        !request.body.data.price ||
        !request.body.data.contractPath ||
        !request.body.data.startDate ||
        !request.body.data.endDate
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const {
        originalContractId,
        name,
        endDate,
        startDate,
        price,
        contractPath,
        totalHours,
      } = request.body.data;

      // Récupérer le contrat original pour obtenir le client
      const contract = await MaintenanceContractEntity.findOne({
        where: { id: originalContractId },
        relations: { client: true },
      });

      if (!contract) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Original contract not found",
          },
        });
      }

      contract.name = name;
      contract.remainingHours = totalHours;
      contract.totalHours = totalHours;
      contract.price = price;
      contract.path = contractPath;
      contract.startAt = startDate;
      contract.endAt = endDate;
      await contract.save();

      // Créer la facture pour le renouvellement
      const invoice = new InvoiceEntity();
      invoice.name =
        "Renouvellement contrat maintenance - " +
        contract.client.name +
        " - " +
        dayjs(startDate).format("DD.MM.YYYY") +
        " à " +
        dayjs(endDate).format("DD.MM.YYYY");
      invoice.number = await SettingManager.getNextInvoiceNumber();
      invoice.state = InvoiceState.CREATED;
      invoice.reference = Utils.computeQRReference(
        invoice.number.toString().padStart(26, "0"),
      );
      invoice.client = contract.client;
      await invoice.save();

      const invoiceService = new InvoiceServiceEntity();
      invoiceService.amount = price;
      invoiceService.quantity = 1;
      invoiceService.invoice = invoice;
      invoiceService.service = (await ServiceEntity.findOneBy({
        id: 11, // ID du contrat de maintenance
      }))!;
      await invoiceService.save();

      const contractInvoice = new ContractInvoiceEntity();
      contractInvoice.invoice = invoice;
      contractInvoice.contract = contract;
      await contractInvoice.save();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          contractId: contract.id,
          invoiceId: invoice.id,
        },
      });
    },
  ),
);

RequestManager.post(
  MaintenanceContractRouter,
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

      const contract = await MaintenanceContractEntity.findOneBy({
        id: id,
      });
      if (!contract) {
        return RequestManager.sendResponse(response, {
          success: true,
          data: {},
        });
      }
      const contractHours = await ContractHourEntity.findBy({
        contract: {
          id: id,
        },
      });
      if (contractHours && contractHours.length > 0) {
        for (const hour of contractHours) {
          await hour.remove();
        }
      }
      const contractInvoices = await ContractInvoiceEntity.find({
        where: {
          contract: {
            id: id,
          },
        },
        relations: {
          invoice: true,
        },
      });
      if (contractInvoices && contractInvoices.length > 0) {
        for (const ch of contractInvoices) {
          const invoice = await InvoiceEntity.findOneBy({
            id: ch.invoice.id,
          });
          if (invoice) {
            await invoice.remove();
          }
          await ch.remove();
        }
      }

      await contract.remove();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {},
      });
    },
  ),
);

RequestManager.post(
  MaintenanceContractRouter,
  "/add-hours",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          contractId: number;
          description: string;
          hours: number;
          date: string;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.contractId ||
        !request.body.data.description ||
        !request.body.data.hours ||
        !request.body.data.date
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { contractId, hours, date, description } = request.body.data;

      const contract = await MaintenanceContractEntity.findOneBy({
        id: contractId,
      });
      const contractHour = new ContractHourEntity();
      contractHour.description = description;
      contractHour.contract = contract!;
      contractHour.hours = hours;
      contractHour.date = dayjs(date).format("YYYY-MM-DD");
      await contractHour.save();

      contract!.remainingHours -= hours;
      await contract!.save();

      return RequestManager.sendResponse(response, {
        success: true,
        data: {},
      });
    },
  ),
);

export default MaintenanceContractRouter;
