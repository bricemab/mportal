import fileUpload from "express-fileupload";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import { Request, Response } from "express";
import Logger from "./utils/Logger";
import Utils from "./utils/Utils";
import GlobalStore from "./utils/GlobalStore";
import { GeneralErrors } from "./utils/BackendErrors";
import config from "./config/config";
import express from "express";
import http from "http";
// @ts-ignore
import xss from "xss-clean";
import helmet from "helmet";
import authRouter from "./routes/AuthRouter";
import AuthMiddleware from "./middlewares/AuthMiddleware";
import { initializeDatabase } from "./database";
import clientRouter from "./routes/ClientRouter";

const app = express();

const setup = async () => {
  Logger.verbose(`Setup started`);
  app.options("*", cors());
  app.use(compression());
  app.use(fileUpload());
  app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(cors());
  app.set("trust proxy", 1); // trust first proxy
  app.use(xss());
  app.use(helmet());

  await initializeDatabase();
};

setup()
  .then(async () => {
    Logger.verbose(`Setup finish with success`);

    // Définition des routes Express
    app.get("/api/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
    app.use(AuthMiddleware.checkAuth);
    app.use("/api/auth", authRouter);
    app.use("/api/clients", clientRouter);

    app.get("*", (req: Request, res: Response) => {
      res.json({ state: "Page doesn't exist" });
    });
    app.post("*", (req: Request, res: Response) => {
      res
        .status(404)
        .json({ success: false, error: { message: "Page doesn't exist" } });
    });

    Logger.verbose(`Server starting`);

    const server = http.createServer(app);

    server.listen(config.server.port, "0.0.0.0", () => {
      const protocol = config.isDevModeEnabled ? "http" : "http";
      Logger.info(
        `API is now running on ${protocol}://${config.server.host}:${config.server.port}`,
      );
    });

    app.on("error", (error: any) => {
      Utils.manageError({
        code: GeneralErrors.UNHANDLED_ERROR,
        message: `Error occurred in express: ${error}`,
      });
    });
  })
  .catch((error) => {
    Logger.warn(`Setup finish with errors`);
    Utils.manageError(error);
  });
