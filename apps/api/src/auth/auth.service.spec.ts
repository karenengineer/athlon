import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { PrismaService } from "../database/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("allows only one concurrent refresh to rotate a session", async () => {
    const refreshToken = "current-refresh-token";
    const tokenHash = await argon2.hash(refreshToken);
    let revokedAt: Date | null = null;
    const createdSessions: unknown[] = [];
    let readers = 0;
    let releaseReaders!: () => void;
    const readersReady = new Promise<void>((resolve) => {
      releaseReaders = resolve;
    });

    const findUnique = jest.fn(async () => {
      const sessionSnapshot = {
        id: "current-session-id",
        adminUserId: "admin-id",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt,
        createdAt: new Date(),
        adminUser: {
          id: "admin-id",
          email: "admin@athlon.test",
          active: true,
        },
      };
      readers += 1;
      if (readers === 2) releaseReaders();
      await readersReady;
      return sessionSnapshot;
    });
    const update = jest.fn(({ data }: { data: { revokedAt: Date } }) => {
      revokedAt = data.revokedAt;
      return Promise.resolve({});
    });
    const updateMany = jest.fn(() => {
      if (revokedAt) return Promise.resolve({ count: 0 });
      revokedAt = new Date();
      return Promise.resolve({ count: 1 });
    });
    const create = jest.fn(({ data }: { data: unknown }) => {
      createdSessions.push(data);
      return Promise.resolve(data);
    });
    const transactionClient = {
      refreshSession: { updateMany, create },
    };
    const prisma = {
      refreshSession: { findUnique, update, updateMany, create },
      $transaction: jest.fn(
        (
          operation:
            | Promise<unknown>[]
            | ((client: typeof transactionClient) => Promise<unknown>),
        ) =>
          typeof operation === "function"
            ? operation(transactionClient)
            : Promise.all(operation),
      ),
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "admin-id",
        role: "ADMIN",
        type: "refresh",
        jti: "current-session-id",
      }),
      signAsync: jest.fn((payload: { type: string; jti?: string }) =>
        Promise.resolve(
          payload.type === "refresh"
            ? `next-refresh-${payload.jti}`
            : "next-access-token",
        ),
      ),
    };
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
      getOrThrow: jest.fn(() => "test-secret"),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );

    const results = await Promise.allSettled([
      service.refresh(refreshToken),
      service.refresh(refreshToken),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(UnauthorizedException);
    expect(rejected?.reason.message).toBe("Invalid refresh session");
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "current-session-id",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(createdSessions).toHaveLength(1);
  });
});
