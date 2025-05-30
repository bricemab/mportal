import type { UserSession, UserType } from '@/types/UserType'
import {
  AuthenticationErrors, ClientErrors,
  GeneralErrors,
  UserErrors, WsErrors
} from '@/types/BackendErrors'

export type ApplicationReject = (error: ApplicationError) => void;

export interface SuccessResponse<DataType> {
  success: true;
  data: DataType;
}

export interface ErrorResponse {
  success: false;
  error: ApplicationError;
}

export type ApplicationResponse<DataType> = SuccessResponse<DataType> | ErrorResponse;
export type ApplicationResponsePromise<DataType> = Promise<SuccessResponse<DataType> | ErrorResponse>;

export type ApplicationErrorType =
  | WsErrors
  | ClientErrors
  | GeneralErrors
  | UserErrors
  | MyslValidationCode
  | AuthenticationErrors;

export interface ApplicationError {
  code: ApplicationErrorType;
  message: string;
  details?: string;
}

export interface ApplicationSession {
  user: UserSession;
  exp: number;
  iat: number;
}

export interface LocationType {
  city: string;
  stateProv: string;
  countryCode: string;
  ipAddress: string;
  continentCode: string;
  continentName: string;
  countryName: string;
}

export enum MyslValidationCode {
  TWO_FA_VALIDATION_PROCESS_VALIDATED = "TWO_FA_VALIDATION_PROCESS_VALIDATED",
  TWO_FA_VALIDATION_PROCESS_REFUSED = "TWO_FA_VALIDATION_PROCESS_REFUSED",
  TWO_FA_VALIDATION_PROCESS_EXPIRED = "TWO_FA_VALIDATION_PROCESS_EXPIRED",
}
