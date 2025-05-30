import type { Response } from "express";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import config from "../config/config";
import type {
  ApplicationReject,
  ApplicationResponse,
} from "@/types/GlobalTypes";
import Global from "@/utils/Global";

export default class RequestManager {
  static createAxiosInstance() {
    return axios.create({
      baseURL: config.api.endpoint,
      timeout: 1000 * 60, //1 minutes
      headers: {
        "x-access-token": config.api.secretKey,
      },
    });
  }

  static asyncResolver(fn: any) {
    return (request: any, response: any, next: any) => {
      Promise.resolve(fn(request, response, next)).catch((error: any) => {
        RequestManager.sendResponse(response, {
          success: false,
          error,
        });
      });
    };
  }

  static sendResponse(
    response: Response,
    dataToSend: ApplicationResponse<any>,
    status?: number,
  ) {
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
    return new Promise<DataType>((resolve, reject: ApplicationReject) => {
      Global.instanceAxios
        .post(url, params, specialConfig)
        .then((response) => {
          const { status, data } = response;
          resolve(data);
        })
        .catch((error) => {
          resolve(error.response.data);
        });
    });
  }
}
const instance = RequestManager.createAxiosInstance();
