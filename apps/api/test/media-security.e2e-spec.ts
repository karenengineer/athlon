import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

describe("Media security", () => {
  let app: INestApplication;
  let accessToken: string;
  const csrf = "known-csrf-token";
  const prisma = {
    product: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "24d3f1a3-8413-4bc6-b32d-437871a22b54" }),
    },
    productImage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    accessToken = await new JwtService().signAsync(
      {
        sub: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => app?.close());

  it("rejects a file whose declared image MIME cannot be decoded", async () => {
    await request(app.getHttpServer())
      .post(
        "/api/v1/admin/products/24d3f1a3-8413-4bc6-b32d-437871a22b54/images",
      )
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .field("altRu", "Поддельное изображение")
      .attach("file", Buffer.from("not a png"), {
        filename: "fake.png",
        contentType: "image/png",
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
    expect(prisma.productImage.create).not.toHaveBeenCalled();
  });

  it("requires authentication before accepting media", async () => {
    await request(app.getHttpServer())
      .post(
        "/api/v1/admin/products/24d3f1a3-8413-4bc6-b32d-437871a22b54/images",
      )
      .attach("file", Buffer.from("not a png"), {
        filename: "fake.png",
        contentType: "image/png",
      })
      .expect(401);
  });
});
