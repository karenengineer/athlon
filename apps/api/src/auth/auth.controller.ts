import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth.constants";
import { AdminAuthGuard, AdminPrincipal } from "./admin-auth.guard";
import { AuthService, SessionTokens } from "./auth.service";
import { CsrfGuard } from "./csrf.guard";
import { LoginDto } from "./dto/login.dto";

@ApiTags("admin-auth")
@Controller("admin/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("config")
  authConfig(): { csrfCookieName: string } {
    return { csrfCookieName: this.csrfCookieName() };
  }

  @Post("login")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const session = await this.auth.login(input);
    this.setCookies(response, session);
    return { user: session.user };
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const token = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    const session = await this.auth.refresh(token ?? "");
    this.setCookies(response, session);
    return { user: session.user };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(
      request.cookies?.[REFRESH_COOKIE] as string | undefined,
    );
    response.clearCookie(ACCESS_COOKIE, { path: "/" });
    response.clearCookie(REFRESH_COOKIE, { path: "/api/v1/admin/auth" });
    response.clearCookie(this.csrfCookieName(), { path: "/" });
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  me(@Req() request: Request & { user?: AdminPrincipal }): unknown {
    const user = request.user!;
    return { user: { id: user.sub, email: user.email, role: user.role } };
  }

  private setCookies(response: Response, session: SessionTokens): void {
    const secure = this.config.get<string>("NODE_ENV") === "production";
    const common = { httpOnly: true, secure, sameSite: "strict" as const };
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      ...common,
      path: "/",
      maxAge: this.config.get<number>("ACCESS_TOKEN_TTL_SECONDS", 900) * 1000,
    });
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...common,
      path: "/api/v1/admin/auth",
      maxAge:
        this.config.get<number>("REFRESH_TOKEN_TTL_SECONDS", 2592000) * 1000,
    });
    response.cookie(this.csrfCookieName(), session.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge:
        this.config.get<number>("REFRESH_TOKEN_TTL_SECONDS", 2592000) * 1000,
    });
  }

  private csrfCookieName(): string {
    return this.config.get<string>("CSRF_COOKIE_NAME", "athlon_csrf");
  }
}
