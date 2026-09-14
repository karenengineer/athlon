import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";

type ValidationBody = { message?: string | string[]; error?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const status = (
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    ) as HttpStatus;
    const exceptionBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const parsed =
      typeof exceptionBody === "object"
        ? (exceptionBody as ValidationBody)
        : undefined;
    const messages = Array.isArray(parsed?.message)
      ? parsed.message
      : parsed?.message
        ? [parsed.message]
        : undefined;
    const code =
      status === HttpStatus.NOT_FOUND
        ? "NOT_FOUND"
        : status === HttpStatus.BAD_REQUEST
          ? "VALIDATION_ERROR"
          : status === HttpStatus.UNAUTHORIZED
            ? "UNAUTHORIZED"
            : status === HttpStatus.FORBIDDEN
              ? "FORBIDDEN"
              : status >= HttpStatus.INTERNAL_SERVER_ERROR
                ? "INTERNAL_ERROR"
                : "REQUEST_ERROR";

    response.status(status).json({
      code,
      message:
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? "Internal server error"
          : (messages?.[0] ?? parsed?.error ?? "Request failed"),
      ...(messages && messages.length > 1 ? { fieldErrors: messages } : {}),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: request.requestId ?? randomUUID(),
    });
  }
}
