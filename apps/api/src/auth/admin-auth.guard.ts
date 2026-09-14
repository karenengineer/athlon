import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { ACCESS_COOKIE } from "./auth.constants";

export interface AdminPrincipal {
  sub: string;
  email: string;
  role: "ADMIN";
  type: "access";
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AdminPrincipal }>();
    const token = request.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException("Authentication required");
    try {
      const principal = await this.jwt.verifyAsync<AdminPrincipal>(token, {
        secret: this.config.getOrThrow<string>("ACCESS_TOKEN_SECRET"),
      });
      if (principal.type !== "access" || principal.role !== "ADMIN")
        throw new Error("Invalid token");
      request.user = principal;
      return true;
    } catch {
      throw new UnauthorizedException("Authentication required");
    }
  }
}
