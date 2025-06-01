import { Request } from "express";
import {
  AuthenticationErrors,
  UserErrors,
  GeneralErrors,
  CronErrors,
} from "./BackendErrors";
import {UserSession} from "../entities/User/UserType";

export interface ApplicationError {
  code: GeneralErrors | AuthenticationErrors | CronErrors | UserErrors;
  message: string;
  details?: any;
}

export type IntranetReject = (error: ApplicationError) => void;

export interface ApplicationRequest<BodyData> extends Request {
  isValidToken: boolean;
  user?: UserSession;
  body: BodyData;
  headers: {
    "authorization": string;
    "user-agent"?: string;
  };
}

export interface SuccessResponse<DataType> {
  success: true;
  data: DataType;
}

export interface ErrorResponse {
  success: false;
  error: ApplicationError;
}

export type ApplicationResponse<DataType> = SuccessResponse<DataType> | ErrorResponse;

export type ApplicationResponsePromise<DataType> = Promise<
  ApplicationResponse<DataType>
>;

export type JwtSession = {
  user: UserSession;
  exp: number;
  iat: number;
}

