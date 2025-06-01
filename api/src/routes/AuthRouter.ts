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

const AuthRouter = Router();

RequestManager.post(
  AuthRouter,
  "/login",
  false,
  RequestManager.asyncResolver(
    async (
      request: ApplicationRequest<{
        token: string;
        data: {
          email: string;
          password: string;
        };
      }>,
      response: Response,
    ) => {
      const { email, password } = request.body.data;

      const user = await UserEntity.findOneBy({ email });
      const log =
        (await ConnexionLogEntity.findOneBy({ email })) ||
        new ConnexionLogEntity();

      if (log.blockedUntil && dayjs().isBefore(dayjs(log.blockedUntil))) {
        const remainingMinutes = dayjs(log.blockedUntil).diff(
          dayjs(),
          "minute",
        );
        await log.save();
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.TOO_MANY_ATTEMPTS,
            message: "Account temporarily blocked. Please try again later.",
            details: remainingMinutes,
          },
        });
      }

      log.ip =
        // @ts-ignore
        request.headers["x-forwarded-for"] || request.socket.remoteAddress;
      log.userAgent = request.headers["user-agent"] || "unknown";
      log.email = email;
      if (!user || !bcrypt.compareSync(password, user.password)) {
        bcrypt.compareSync(password, "invalid_password"); // prevent timing attacks
        log.failedAttempts = (log.failedAttempts || 0) + 1;
        if (log.failedAttempts >= 5) {
          log.blockedUntil = dayjs().add(30, "minutes").toDate();
        }
        await log.save();
        return RequestManager.sendResponse(response, {
          success: false,
          error: {
            code: GeneralErrors.INVALID_CREDENTIALS,
            message: "Invalid credentials",
          },
        });
      }

      log.failedAttempts = 0;
      log.blockedUntil = null;
      await log.save();

      user.lastConnexionAt = dayjs().toDate();
      await user.save();

      const userJwt = {
        id: user.id,
        lastname: user.lastname,
        firstname: user.firstname,
        email: user.email,
      };

      const token = jwt.sign({ user: userJwt }, config.security.jwt.secret, {
        expiresIn: config.security.jwt.expiresIn,
      });

      return RequestManager.sendResponse(response, {
        success: true,
        data: {
          user: userJwt,
          jwt: token,
        },
      });
    },
  ),
);

export default AuthRouter;
