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

const ServiceRouter = Router();

RequestManager.post(
  ServiceRouter,
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
      const services = await ServiceEntity.find({
        where: {
          archived: false,
        },
        order: {
          name: "ASC",
        },
      });
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          services,
        },
      });
    },
  ),
);

RequestManager.post(
  ServiceRouter,
  "/create",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          name: string;
          description: string;
          type: ServiceType;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.name ||
        !request.body.data.description ||
        !request.body.data.type
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { name, type, description } = request.body.data;
      const service = new ServiceEntity();
      service.name = name;
      service.description = description;
      service.type = type;
      await service.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          service,
        },
      });
    },
  ),
);

RequestManager.post(
  ServiceRouter,
  "/edit",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
          name: string;
          description: string;
          type: ServiceType;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.id ||
        !request.body.data.name ||
        !request.body.data.description ||
        !request.body.data.type
      ) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_REQUEST,
            message: "Missing required fields",
          },
        });
      }
      const { id, name, type, description } = request.body.data;

      const service = await ServiceEntity.findOne({
        where: { id },
      });
      if (!service) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Service not found",
          },
        });
      }
      service.name = name;
      service.description = description;
      service.type = type;
      await service.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          service,
        },
      });
    },
  ),
);

RequestManager.post(
  ServiceRouter,
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

      const service = await ServiceEntity.findOne({
        where: { id },
      });
      if (!service) {
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.OBJECT_NOT_FOUND_IN_DATABASE,
            message: "Service not found",
          },
        });
      }
      await service.remove();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          service,
        },
      });
    },
  ),
);

export default ServiceRouter;
