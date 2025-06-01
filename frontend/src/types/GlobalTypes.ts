import type { UserSession } from '@/types/UserType'
import { GeneralErrors } from '@/types/BackendErrors'

export type ApplicationReject = (error: ApplicationError) => void

export interface SuccessResponse<DataType> {
  success: true
  data: DataType
}

export interface ErrorResponse {
  success: false
  error: ApplicationError
}

export type ApplicationResponse<DataType> = SuccessResponse<DataType> | ErrorResponse
export type ApplicationResponsePromise<DataType> = Promise<
  SuccessResponse<DataType> | ErrorResponse
>

export type ApplicationErrorType = GeneralErrors

export interface ApplicationError {
  code: ApplicationErrorType
  message: string
  details?: string
}

export interface ApplicationSession {
  user: UserSession
  exp: number
  iat: number
}
