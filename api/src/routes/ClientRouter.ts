import { Response, Router } from "express";
import { ApplicationRequest } from "../utils/Types";
import RequestManager from "../utils/RequestManager";
import { ClientEntity } from "../entities/Client/ClientEntity";
import { GeneralErrors } from "../utils/BackendErrors";

const ClientRouter = Router();

RequestManager.post(
  ClientRouter,
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
      const clients = await ClientEntity.find({
        where: { archived: false },
        order: { name: "ASC" },
      });
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          clients,
        },
      });
    },
  ),
);

RequestManager.post(
  ClientRouter,
  "/create",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          name: string;
          firstname: string;
          lastname: string;
          email: string;
          phoneNumber: string;
          remark: string;
          address: string;
          addressNumber: string;
          postalCode: string;
          city: string;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.name ||
        !request.body.data.firstname ||
        !request.body.data.lastname ||
        !request.body.data.email ||
        !request.body.data.address ||
        !request.body.data.addressNumber ||
        !request.body.data.city ||
        !request.body.data.postalCode ||
        !request.body.data.phoneNumber
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
        email,
        phoneNumber,
        lastname,
        firstname,
        name,
        remark,
        addressNumber,
        address,
        city,
        postalCode,
      } = request.body.data;
      const client = new ClientEntity();
      client.name = name;
      client.firstname = firstname;
      client.lastname = lastname;
      client.email = email;
      client.address = address;
      client.addressNumber = addressNumber;
      client.postalCode = postalCode;
      client.city = city;
      client.phoneNumber = phoneNumber;
      client.remark = remark;
      await client.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          client,
        },
      });
    },
  ),
);

RequestManager.post(
  ClientRouter,
  "/edit",
  true,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          id: number;
          name: string;
          firstname: string;
          lastname: string;
          email: string;
          phoneNumber: string;
          remark: string;
          address: string;
          addressNumber: string;
          postalCode: string;
          city: string;
        };
      }>,
      response: Response,
    ) => {
      if (
        !request.body.data ||
        !request.body.data.id ||
        !request.body.data.name ||
        !request.body.data.firstname ||
        !request.body.data.lastname ||
        !request.body.data.email ||
        !request.body.data.address ||
        !request.body.data.addressNumber ||
        !request.body.data.city ||
        !request.body.data.postalCode ||
        !request.body.data.phoneNumber
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
        id,
        email,
        phoneNumber,
        lastname,
        firstname,
        name,
        remark,
        addressNumber,
        address,
        city,
        postalCode,
      } = request.body.data;

      const client = await ClientEntity.findOne({
        where: { id },
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
      client.name = name;
      client.firstname = firstname;
      client.lastname = lastname;
      client.email = email;
      client.address = address;
      client.addressNumber = addressNumber;
      client.postalCode = postalCode;
      client.city = city;
      client.phoneNumber = phoneNumber;
      client.remark = remark;
      await client.save();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          client,
        },
      });
    },
  ),
);

RequestManager.post(
  ClientRouter,
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

      const client = await ClientEntity.findOne({
        where: { id },
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
      await client.remove();
      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          client,
        },
      });
    },
  ),
);

export default ClientRouter;
