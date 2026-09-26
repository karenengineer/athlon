import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { cleanupOwnedResources } from "./isolated-cleanup";

const exec = promisify(execFile);
// Own a fresh loopback-only PostgreSQL container. Never point this at DATABASE_URL.
const integration =
  process.env.ATHLON_PG_INTEGRATION === "1" ? describe : describe.skip;
integration(
  "Finance purchase-to-export workflow on isolated PostgreSQL",
  () => {
    const container = `athlon-finance-${randomUUID()}`;
    let created = false;
    let app: INestApplication | undefined;
    let prisma: PrismaService | undefined;
    let token: string;
    let adminId: string;
    let productId: string;
    const base = "/api/v1/admin/finance";
    const server = () => app!.getHttpServer();
    const auth = (test: request.Test) =>
      test
        .set("Cookie", [`athlon_access=${token}`, "athlon_csrf=workflow-csrf"])
        .set("x-csrf-token", "workflow-csrf");

    beforeAll(async () => {
      await exec("docker", [
        "run",
        "--detach",
        "--rm",
        "--name",
        container,
        "--label",
        "athlon.test=finance-workflow",
        "-e",
        "POSTGRES_USER=athlon_finance",
        "-e",
        "POSTGRES_PASSWORD=isolated-finance-only",
        "-e",
        "POSTGRES_DB=athlon_finance",
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
            "athlon_finance",
            "-d",
            "athlon_finance",
          ]);
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      if (!ready) throw new Error("Isolated finance PostgreSQL did not start");
      const { stdout } = await exec("docker", ["port", container, "5432/tcp"]);
      const port = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
      if (!port) throw new Error("Expected isolated loopback database port");
      const url = `postgresql://athlon_finance:isolated-finance-only@127.0.0.1:${port}/athlon_finance`;
      await exec("pnpm", ["exec", "prisma", "migrate", "deploy"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: url },
        timeout: 60_000,
      });
      prisma = new PrismaService(new ConfigService({ DATABASE_URL: url }));
      adminId = randomUUID();
      const categoryId = randomUUID();
      productId = randomUUID();
      await prisma.adminUser.create({
        data: {
          id: adminId,
          email: "workflow@athlon.test",
          passwordHash: "isolated-test-only",
        },
      });
      await prisma.category.create({
        data: {
          id: categoryId,
          code: "finance-workflow",
          slug: "finance-workflow",
          translations: {
            create: [{ locale: "EN", name: "Finance workflow" }],
          },
        },
      });
      await prisma.product.create({
        data: {
          id: productId,
          categoryId,
          sku: "FIN-WORKFLOW",
          slug: "fin-workflow",
          price: "16000",
          lowStockThreshold: 2,
          translations: {
            create: [{ locale: "EN", name: "Workflow product" }],
          },
        },
      });
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();
      app = configureApplication(module.createNestApplication());
      await app.init();
      token = await new JwtService().signAsync(
        {
          sub: adminId,
          email: "workflow@athlon.test",
          role: "ADMIN",
          type: "access",
        },
        {
          secret: "test-access-secret-with-at-least-32-characters",
          expiresIn: 900,
        },
      );
    }, 120_000);

    afterAll(async () => {
      await cleanupOwnedResources([
        ...(app
          ? [{ label: "Nest app / Prisma", cleanup: () => app!.close() }]
          : prisma
            ? [{ label: "Prisma", cleanup: () => prisma!.onModuleDestroy() }]
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

    it("reconciles purchases, sales, expenses, monthly results and CSV export", async () => {
      const supplier = await auth(request(server()).post(`${base}/suppliers`))
        .send({ name: "Workflow supplier" })
        .expect(201);
      const expenseCategory = await auth(
        request(server()).post(`${base}/expense-categories`),
      )
        .send({ name: "Workflow operations" })
        .expect(201);

      for (const [quantity, purchaseUnitPrice] of [
        [10, "12000"],
        [5, "13000"],
      ] as const) {
        await auth(request(server()).post(`${base}/purchases`))
          .send({
            date: "2026-09-01",
            supplierId: supplier.body.id,
            items: [{ productId, quantity, purchaseUnitPrice }],
          })
          .expect(201);
      }
      for (const [quantity, actualUnitPrice] of [
        [2, "16000"],
        [1, "15000"],
      ] as const) {
        const sale = await auth(request(server()).post(`${base}/sales`))
          .send({
            date: "2026-09-02",
            channel: "DIRECT",
            items: [{ productId, quantity, actualUnitPrice }],
          })
          .expect(201);
        expect(sale.body.totalCostOfGoodsSold).toBe(
          String(quantity * 12333.333333),
        );
      }
      for (const amount of ["5000", "10000", "40000"]) {
        await auth(request(server()).post(`${base}/expenses`))
          .send({
            date: "2026-09-03",
            categoryId: expenseCategory.body.id,
            description: `Workflow expense ${amount}`,
            amount,
          })
          .expect(201);
      }
      const query = { dateFrom: "2026-09-01", dateTo: "2026-09-30" };
      const products = await auth(
        request(server()).get(`${base}/products`).query(query),
      ).expect(200);
      expect(products.body.items[0]).toMatchObject({
        totalPurchased: 15,
        totalSold: 3,
        currentStock: 12,
        weightedAverageBuyPrice: "12333.33",
      });
      const dashboard = await auth(
        request(server()).get(`${base}/dashboard`).query(query),
      ).expect(200);
      expect(dashboard.body).toMatchObject({
        revenue: "47000",
        costOfGoodsSold: "37000",
        grossProfit: "10000",
        totalExpenses: "55000",
        netProfit: "-45000",
        currentStock: 12,
      });
      const monthly = await auth(
        request(server())
          .get(`${base}/monthly-summary`)
          .query({ year: 2026, month: 9 }),
      ).expect(200);
      expect(monthly.body.totals).toMatchObject({
        revenue: "47000",
        costOfGoodsSold: "37000",
        grossProfit: "10000",
        totalExpenses: "55000",
        netProfit: "-45000",
        unitsSold: 3,
      });
      const exportResult = await auth(
        request(server())
          .get(`${base}/exports/monthly-summary.csv`)
          .query({ year: 2026, month: 9 }),
      ).expect(200);
      expect(exportResult.headers["content-type"]).toContain("text/csv");
      expect(exportResult.text).toContain("2026-09,47000,37000,10000");
      expect(exportResult.text).toContain("55000,-45000");
    }, 120_000);
  },
);
