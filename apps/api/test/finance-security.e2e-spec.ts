import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

const adminId = "55c20c13-3b51-44fb-a6ff-33fe765d29bb";
const path = (suffix: string) => `/api/v1/admin/finance${suffix}`;
const readRoutes = [
  "/suppliers",
  `/suppliers/${adminId}`,
  "/purchases",
  `/purchases/${adminId}`,
  "/sales",
  `/sales/${adminId}`,
  "/expense-categories",
  "/expenses",
  `/expenses/${adminId}`,
  "/recurring-expenses",
  `/recurring-expenses/${adminId}`,
  "/dashboard",
  "/products",
  "/monthly-summary",
  "/profitability",
  "/expense-breakdown",
  "/exports/products.csv",
  "/exports/purchases.csv",
  "/exports/sales.csv",
  "/exports/expenses.csv",
  "/exports/monthly-summary.csv",
  "/exports/profitability.csv",
  "/exports/accounting.xlsx",
];
const writeRoutes: Array<["post" | "patch" | "delete", string]> = [
  ["post", "/suppliers"],
  ["patch", `/suppliers/${adminId}`],
  ["delete", `/suppliers/${adminId}`],
  ["post", "/purchases"],
  ["patch", `/purchases/${adminId}`],
  ["delete", `/purchases/${adminId}`],
  ["post", "/sales"],
  ["patch", `/sales/${adminId}`],
  ["delete", `/sales/${adminId}`],
  ["post", "/expense-categories"],
  ["patch", `/expense-categories/${adminId}`],
  ["post", "/expenses"],
  ["patch", `/expenses/${adminId}`],
  ["delete", `/expenses/${adminId}`],
  ["post", "/recurring-expenses"],
  ["patch", `/recurring-expenses/${adminId}`],
  ["delete", `/recurring-expenses/${adminId}`],
];

describe("Finance route security matrix", () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: adminId,
          email: "admin@athlon.test",
          active: true,
          role: "ADMIN",
        }),
      },
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(module.createNestApplication());
    await app.init();
    token = await new JwtService().signAsync(
      {
        sub: adminId,
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
  });

  afterAll(async () => app?.close());

  it.each(readRoutes)("rejects anonymous GET %s", async (route) => {
    await request(app.getHttpServer()).get(path(route)).expect(401);
  });

  it.each(writeRoutes)("rejects anonymous %s %s", async (method, route) => {
    await request(app.getHttpServer())[method](path(route)).expect(401);
  });

  it.each(writeRoutes)("rejects %s %s without CSRF", async (method, route) => {
    await request(app.getHttpServer())
      [method](path(route))
      .set("Cookie", [`athlon_access=${token}`, "athlon_csrf=known-csrf"])
      .expect(403);
  });
});
