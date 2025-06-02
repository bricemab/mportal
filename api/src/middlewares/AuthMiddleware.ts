import { NextFunction, Request, Response } from "express";
import { ApplicationRequest, JwtSession } from "../utils/Types";
import Utils from "../utils/Utils";
import { GeneralErrors } from "../utils/BackendErrors";
import RequestManager from "../utils/RequestManager";
import jwt from "jsonwebtoken";
import config from "../config/config";
import { RequestContext } from "../utils/RequestContext";

export default class AuthMiddleware {
  public static async checkAuth(
    expressRequest: Request,
    response: Response,
    next: NextFunction,
  ) {
    const request = expressRequest as ApplicationRequest<{
      data: {};
      token: string;
    }>;
    const { data, token } = request.body;

    if (!Utils.validateHmacSha256Signature(token, data)) {
      return RequestManager.sendResponse(response, {
        success: false,
        error: {
          code: GeneralErrors.PACKET_NOT_AUTHENTIC,
          message: "Packet not authenticated",
        },
      });
    }

    const bearer = request.headers["authorization"];
    if (!bearer) {
      return RequestContext.run({ userId: 0 }, () => next());
    }
    const jwtToken = bearer.split(" ")[1];
    let userId = null;
    try {
      const decoded = jwt.verify(
        jwtToken,
        config.security.jwt.secret,
      ) as JwtSession;
      request.user = decoded.user;
      userId = decoded.user.id;
    } catch (error) {
      console.log(error);
      return RequestManager.sendResponse(response, {
        success: false,
        error: {
          code: GeneralErrors.BEARER_TOKEN_ERROR,
          message: "BEARER_TOKEN_ERROR",
        },
      });
    }
    return RequestContext.run({ userId }, () => next());
  }
}
