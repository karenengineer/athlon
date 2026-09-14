import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { LoginDto } from "./dto/login.dto";

interface RefreshPayload {
  sub: string;
  role: "ADMIN";
  type: "refresh";
  jti: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: { id: string; email: string; role: "ADMIN" };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(input: LoginDto): Promise<SessionTokens> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: input.email },
    });
    const valid = user?.active
      ? await argon2.verify(user.passwordHash, input.password)
      : false;
    if (!user || !valid)
      throw new UnauthorizedException("Invalid email or password");
    return this.issue(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const payload = await this.verifyRefresh(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.jti },
      include: { adminUser: true },
    });
    const valid =
      session &&
      !session.revokedAt &&
      session.expiresAt > new Date() &&
      session.adminUser.active &&
      (await argon2.verify(session.tokenHash, refreshToken));
    if (!valid || !session)
      throw new UnauthorizedException("Invalid refresh session");
    const next = await this.buildTokens(
      session.adminUser.id,
      session.adminUser.email,
    );
    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshSession.create({ data: next.session }),
    ]);
    return next.tokens;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.verifyRefresh(refreshToken);
      await this.prisma.refreshSession.update({
        where: { id: payload.jti },
        data: { revokedAt: new Date() },
      });
    } catch {
      return;
    }
  }

  private async issue(userId: string, email: string): Promise<SessionTokens> {
    const result = await this.buildTokens(userId, email);
    await this.prisma.refreshSession.create({ data: result.session });
    return result.tokens;
  }

  private async buildTokens(
    userId: string,
    email: string,
  ): Promise<{ tokens: SessionTokens; session: any }> {
    const jti = randomUUID();
    const accessTtl = this.config.get<number>("ACCESS_TOKEN_TTL_SECONDS", 900);
    const refreshTtl = this.config.get<number>(
      "REFRESH_TOKEN_TTL_SECONDS",
      2592000,
    );
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role: "ADMIN", type: "access" },
      {
        secret: this.config.getOrThrow("ACCESS_TOKEN_SECRET"),
        expiresIn: accessTtl,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, role: "ADMIN", type: "refresh", jti },
      {
        secret: this.config.getOrThrow("REFRESH_TOKEN_SECRET"),
        expiresIn: refreshTtl,
      },
    );
    return {
      tokens: {
        accessToken,
        refreshToken,
        csrfToken: randomUUID().replaceAll("-", ""),
        user: { id: userId, email, role: "ADMIN" },
      },
      session: {
        id: jti,
        adminUserId: userId,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    };
  }

  private async verifyRefresh(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>("REFRESH_TOKEN_SECRET"),
      });
      if (payload.type !== "refresh" || !payload.jti)
        throw new Error("Invalid token");
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid refresh session");
    }
  }
}
