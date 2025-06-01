import { Response, Router } from "express";
import { ApplicationRequest } from "../utils/Types";
import RequestManager from "../utils/RequestManager";
import { GeneralErrors } from "../utils/BackendErrors";
import jwt from "jsonwebtoken";
import config from "../config/config";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { UserEntity } from "../entities/User/UserEntity";
import { ConnexionLogEntity } from "../entities/ConnexionLog/ConnexionLogEntity";
import { ServiceEntity } from "../entities/Service/ServiceEntity";
import { ClientEntity } from "../entities/Client/ClientEntity";
import ClientRouter from "./ClientRouter";
import { ServiceType } from "../entities/Service/ServiceType";
import { InvoiceEntity } from "../entities/Invoice/InvoiceEntity";

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

// RequestManager.post(
//   InvoiceRouter,
//   "/create",
//   true,
//   RequestManager.asyncResolver(
//     async (
//       request: ApplicationRequest<{
//         token: string;
//         data: {
//           name: string;
//           description: string;
//           type: ServiceType;
//         };
//       }>,
//       response: Response,
//     ) => {
//       if (
//         !request.body.data ||
//         !request.body.data.name ||
//         !request.body.data.description ||
//         !request.body.data.type
//       ) {
//         return RequestManager.sendResponse(response, {
//           success: false,
//           error: {
//             code: GeneralErrors.INVALID_REQUEST,
//             message: "Missing required fields",
//           },
//         });
//       }
//       const { name, type, description } = request.body.data;
//       const service = new ServiceEntity();
//       service.name = name;
//       service.description = description;
//       service.type = type;
//       await service.save();
//       return RequestManager.sendResponse(response, {
//         success: true,
//         data: {
//           service,
//         },
//       });
//     },
//   ),
// );
//
// RequestManager.post(
//   InvoiceRouter,
//   "/edit",
//   true,
//   RequestManager.asyncResolver(
//     async (
//       request: ApplicationRequest<{
//         token: string;
//         data: {
//           id: number;
//           name: string;
//           description: string;
//           type: ServiceType;
//         };
//       }>,
//       response: Response,
//     ) => {
//       if (
//         !request.body.data ||
//         !request.body.data.id ||
//         !request.body.data.name ||
//         !request.body.data.description ||
//         !request.body.data.type
//       ) {
//         return RequestManager.sendResponse(response, {
//           success: false,
//           error: {
//             code: GeneralErrors.INVALID_REQUEST,
//             message: "Missing required fields",
//           },
//         });
//       }
//       const { id, name, type, description } = request.body.data;
//
//       const service = await ServiceEntity.findOne({
//         where: { id },
//       });
//       if (!service) {
//         return RequestManager.sendResponse(response, {
//           success: false,
//           error: {
//             code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
//             message: "Service not found",
//           },
//         });
//       }
//       service.name = name;
//       service.description = description;
//       service.type = type;
//       await service.save();
//       return RequestManager.sendResponse(response, {
//         success: true,
//         data: {
//           service,
//         },
//       });
//     },
//   ),
// );
//
// RequestManager.post(
//   InvoiceRouter,
//   "/delete",
//   true,
//   RequestManager.asyncResolver(
//     async (
//       request: ApplicationRequest<{
//         token: string;
//         data: {
//           id: number;
//         };
//       }>,
//       response: Response,
//     ) => {
//       if (!request.body.data || !request.body.data.id) {
//         return RequestManager.sendResponse(response, {
//           success: false,
//           error: {
//             code: GeneralErrors.INVALID_REQUEST,
//             message: "Missing required fields",
//           },
//         });
//       }
//       const { id } = request.body.data;
//
//       const service = await ServiceEntity.findOne({
//         where: { id },
//       });
//       if (!service) {
//         return RequestManager.sendResponse(response, {
//           success: false,
//           error: {
//             code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
//             message: "Service not found",
//           },
//         });
//       }
//       await service.remove();
//       return RequestManager.sendResponse(response, {
//         success: true,
//         data: {
//           service,
//         },
//       });
//     },
//   ),
// );

export default InvoiceRouter;
