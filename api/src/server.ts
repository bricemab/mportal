import fileUpload from "express-fileupload";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import { Request, Response } from "express";
import Logger from "./utils/Logger";
import Utils from "./utils/Utils";
import { GeneralErrors } from "./utils/BackendErrors";
import config from "./config/config";
import express from "express";
import http from "http";
// @ts-ignore
import xss from "xss-clean";
import helmet from "helmet";
import authRouter from "./routes/AuthRouter";
import AuthMiddleware from "./middlewares/AuthMiddleware";
import { AppDataSource, initializeDatabase } from "./database";
import clientRouter from "./routes/ClientRouter";
import serviceRouter from "./routes/ServiceRouter";
import invoiceRouter from "./routes/InvoiceRouter";
import GlobalRouter from "./routes/GlobalRouter";
import MaintenanceContractRouter from "./routes/MaintenanceContractRouter";

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
    app.use("/api", GlobalRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/clients", clientRouter);
    app.use("/api/services", serviceRouter);
    app.use("/api/invoices", invoiceRouter);
    app.use("/api/maintenance-contracts", MaintenanceContractRouter);

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

    server.listen(config.server.port, config.server.host, () => {
      Logger.info(
        `API is now running on http://${config.server.host}:${config.server.port}`,
      );
    });

    // Arrêt propre (déploiement Coolify, redémarrage du serveur) : < 5 s.
    const shutdown = (signal: string) => {
      Logger.info(`${signal} reçu, arrêt de l'API`);
      server.close(() => {
        AppDataSource.destroy().finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(0), 4000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

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
    // Sortir pour que Docker relance le conteneur (base pas encore prête, etc.).
    setTimeout(() => process.exit(1), 1000);
  });
