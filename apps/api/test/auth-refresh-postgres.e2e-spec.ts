import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/database/prisma.service";
import { cleanupOwnedResources } from "./isolated-cleanup";

const exec = promisify(execFile);
// Never accepts DATABASE_URL or an existing database. Opt-in creates its own
// uniquely named container, dedicated DB and loopback-only random port.
const integration =
  process.env.ATHLON_PG_INTEGRATION === "1" ? describe : describe.skip;

integration("Isolated actual PostgreSQL refresh rotation", () => {
  const container = `athlon-auth-refresh-${randomUUID()}`;
  const accessSecret = "test-access-secret-with-at-least-32-characters";
  const refreshSecret = "test-refresh-secret-with-at-least-32-characters";
  let created = false;
  let prisma: PrismaService | undefined;
  let auth: AuthService | undefined;
  let jwt: JwtService | undefined;

  beforeAll(async () => {
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--label",
      "athlon.test=auth-refresh",
      "-e",
      "POSTGRES_USER=athlon_auth_refresh",
      "-e",
      "POSTGRES_PASSWORD=isolated-auth-refresh-only",
      "-e",
      "POSTGRES_DB=athlon_auth_refresh",
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ]);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await exec("docker", [
          "exec",
          container,
          "pg_isready",
          "-U",
          "athlon_auth_refresh",
          "-d",
          "athlon_auth_refresh",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL did not start");
    const { stdout } = await exec("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!port) throw new Error("Expected isolated loopback database port");
    const databaseUrl = `postgresql://athlon_auth_refresh:isolated-auth-refresh-only@127.0.0.1:${port}/athlon_auth_refresh`;
    await exec("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 60_000,
    });
    const config = new ConfigService({
      DATABASE_URL: databaseUrl,
      ACCESS_TOKEN_SECRET: accessSecret,
      REFRESH_TOKEN_SECRET: refreshSecret,
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 3600,
    });
    prisma = new PrismaService(config);
    jwt = new JwtService();
    auth = new AuthService(prisma, jwt, config);
  }, 120_000);

  afterAll(async () => {
    const ownedPrisma = prisma;
    await cleanupOwnedResources([
      ...(ownedPrisma
        ? [{ label: "Prisma", cleanup: () => ownedPrisma.onModuleDestroy() }]
        : []),
      ...(created
        ? [
            {
              label: `container ${container}`,
              cleanup: () =>
                exec("docker", ["stop", container], { timeout: 15_000 }),
            },
          ]
        : []),
    ]);
  }, 30_000);

  async function createRefreshSession(email: string) {
    const password = "correct horse battery staple";
    const user = await prisma!.adminUser.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash: await argon2.hash(password),
      },
    });
    const tokens = await auth!.login({ email, password });
    const payload = await jwt!.verifyAsync<{ jti: string }>(
      tokens.refreshToken,
      { secret: refreshSecret },
    );
    return { user, tokens, parentId: payload.jti };
  }

  it("allows only one concurrent rotation and persists one successor", async () => {
    const { user, tokens, parentId } =
      await createRefreshSession("race@athlon.test");
    let reads = 0;
    let releaseReads!: () => void;
    const bothReadsFinished = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const refreshSessions = prisma!.refreshSession;
    const refreshSessionLookup = refreshSessions as unknown as {
      findUnique: (args: {
        where: { id: string };
        include: { adminUser: true };
      }) => Promise<unknown>;
    };
    const originalFindUnique =
      refreshSessionLookup.findUnique.bind(refreshSessions);
    const findUniqueSpy = jest
      .spyOn(refreshSessionLookup, "findUnique")
      .mockImplementation(async (args) => {
        const session = await originalFindUnique(args);
        reads += 1;
        if (reads === 2) releaseReads();
        await bothReadsFinished;
        return session;
      });

    const results = await (async () => {
      try {
        return await Promise.allSettled([
          auth!.refresh(tokens.refreshToken),
          auth!.refresh(tokens.refreshToken),
        ]);
      } finally {
        findUniqueSpy.mockRestore();
      }
    })();

    expect(results.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(UnauthorizedException);
    expect(rejected?.reason.message).toBe("Invalid refresh session");
    const sessions = await prisma!.refreshSession.findMany({
      where: { adminUserId: user.id },
    });
    expect(sessions).toHaveLength(2);
    expect(sessions.find(({ id }) => id === parentId)?.revokedAt).toEqual(
      expect.any(Date),
    );
    expect(sessions.filter(({ id }) => id !== parentId)).toHaveLength(1);
  });

  it("rolls back the parent claim when successor insertion fails", async () => {
    const { tokens, parentId } = await createRefreshSession(
      "rollback@athlon.test",
    );
    await prisma!.$executeRaw`
      CREATE FUNCTION "FailRollbackRefreshInsert"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "AdminUser"
          WHERE "id" = NEW."adminUserId"
            AND "email" = 'rollback@athlon.test'
        ) THEN
          RAISE EXCEPTION 'forced successor failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `;
    await prisma!.$executeRaw`
      CREATE TRIGGER "FailRollbackRefreshInsertTrigger"
      BEFORE INSERT ON "RefreshSession"
      FOR EACH ROW EXECUTE FUNCTION "FailRollbackRefreshInsert"()
    `;

    const failure = await auth!
      .refresh(tokens.refreshToken)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("forced successor failure");
    const parent = await prisma!.refreshSession.findUniqueOrThrow({
      where: { id: parentId },
    });
    expect(parent.revokedAt).toBeNull();
    expect(
      await prisma!.refreshSession.count({
        where: { adminUserId: parent.adminUserId },
      }),
    ).toBe(1);
  });
});
