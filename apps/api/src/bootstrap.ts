import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";

export function configureApplication(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  const config = app.get(ConfigService);
  const trustedProxyHops = config.get<number>("TRUST_PROXY_HOPS", 0);
  if (trustedProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.set("trust proxy", trustedProxyHops);
  }
  app.enableCors({
    origin: config
      .getOrThrow<string>("CORS_ORIGINS")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  if (config.get<boolean>("SWAGGER_ENABLED", false)) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("ATHLON API")
        .setVersion("1")
        .addCookieAuth()
        .build(),
    );
    SwaggerModule.setup("api/docs", app, document);
  }
  return app;
}

export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  return configureApplication(app);
}
