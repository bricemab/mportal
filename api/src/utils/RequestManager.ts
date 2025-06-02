import { NextFunction, Request, Response } from "express";
import { AxiosInstance, AxiosRequestConfig } from "axios";
import {
  ApplicationError,
  ApplicationRequest,
  ApplicationResponse,
} from "./Types";
import Utils from "./Utils";
import GlobalStore from "./GlobalStore";
import { ApplicationReject } from "./BackendErrors";

export default class RequestManager {
  static post(app: any, path: string, mustBeLogged: boolean, fn: any) {
    app.post(path, (req: Request, res: Response) => {
      const request = req as ApplicationRequest<{
        data: {};
        token: string;
      }>;
      if (mustBeLogged && !request.user) {
        res.status(401).send("Unauthorized");
        return;
      }
      if (!mustBeLogged && request.user) {
        res.status(403).send("Forbidden");
        return;
      }
      fn(req, res);
    });
  }
  static get(app: any, path: string, mustBeLogged: boolean, fn: any) {
    app.get(path, (req: any, res: any) => {
      const request = req as ApplicationRequest<{
        data: {};
        token: string;
      }>;
      if (mustBeLogged && !request.user) {
        res.status(401).send("Unauthorized");
        return;
      }
      if (!mustBeLogged && request.user) {
        res.status(403).send("Forbidden");
        return;
      }
      fn(req, res);
    });
  }
  static asyncResolver(fn: (req: any, res: any, next: any) => Promise<any>) {
    return (request: Request, response: Response, next: NextFunction) => {
      Promise.resolve(fn(request, response, next)).catch(
        (error: ApplicationError) => {
          Utils.manageError(error);
          RequestManager.sendResponse(response, {
            success: false,
            error,
          });
        },
      );
    };
  }

  static sendResponse(
    response: Response,
    dataToSend: ApplicationResponse<any>,
    status?: number,
  ) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");
    if (dataToSend && dataToSend.success) {
      response.status(200).json(dataToSend);
    } else {
      response.status(status || 460).json({
        success: false,
        error: dataToSend.error,
      });
    }
  }

  static executePost<DataType>(
    url: string,
    params: any,
    specialConfig?: AxiosRequestConfig,
  ) {
    const wpInstance = GlobalStore.get("wpInstance") as AxiosInstance;
    return new Promise<DataType>((resolve, reject: ApplicationReject) => {
      wpInstance
        .post(url, params, specialConfig)
        .then((response) => {
          const { status, data } = response;
          resolve(data);
        })
        .catch((error) => {
          console.log(error);
          resolve(error.response.data);
        });
    });
  }
}
