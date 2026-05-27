import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function resolveAppUrl() {
  const trimmed = process.env.APP_URL?.trim();

  if (trimmed) {
    return trimmed.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL is required in production.");
  }

  return "http://localhost:3000";
}

function resolveCorsOrigin(appUrl: string) {
  const trimmed = process.env.CORS_ORIGIN?.trim();

  if (trimmed) {
    return trimmed.replace(/\/+$/, "");
  }

  return appUrl;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  const appUrl = resolveAppUrl();
  const corsOrigin = resolveCorsOrigin(appUrl);
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
  logger.log(`API listening on port ${port} with prefix /v1`);
}

bootstrap();
