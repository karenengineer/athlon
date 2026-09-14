import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { Request } from "express";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.config.get<string>(
      "CSRF_COOKIE_NAME",
      "athlon_csrf",
    );
    const cookie = request.cookies?.[cookieName] as string | undefined;
    const header = request.header("x-csrf-token");
    if (!cookie || !header) throw new ForbiddenException("CSRF token mismatch");
    const cookieBuffer = Buffer.from(cookie);
    const headerBuffer = Buffer.from(header);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new ForbiddenException("CSRF token mismatch");
    }
    return true;
  }
}
