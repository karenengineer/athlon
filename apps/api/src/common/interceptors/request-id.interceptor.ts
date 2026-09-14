import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { Observable } from "rxjs";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();
    const incoming = request.header("x-request-id");
    const requestId =
      incoming && incoming.length <= 128 ? incoming : randomUUID();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    return next.handle();
  }
}
