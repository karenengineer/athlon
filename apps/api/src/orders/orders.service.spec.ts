import { BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OrderEmailService } from "./order-email.service";
import { OrdersService } from "./orders.service";

const productId = "4ebeb944-3503-47a2-9843-d37f1eb34768";
const orderInput = {
  locale: "hy" as const,
  customer: { name: "Անի", phone: "091123456", address: "Երևան" },
  items: [{ productId, quantity: 2, expectedUnitPrice: "24000" }],
};

describe("OrdersService", () => {
  const findProducts = jest.fn();
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  const products = { findMany: findProducts };
  const email = { send: sendEmail } as unknown as OrderEmailService;
  const service = new OrdersService(
    { product: products } as unknown as PrismaService,
    email,
  );
  const publishedProduct = {
    id: productId,
    sku: "SKU-ONE",
    published: true,
    availability: "IN_STOCK",
    price: "24000",
    translations: [
      { locale: "HY", name: "Պրոտեին" },
      { locale: "RU", name: "Протеин" },
    ],
  };

  beforeEach(() => {
    findProducts.mockReset().mockResolvedValue([publishedProduct]);
    sendEmail.mockReset().mockResolvedValue(undefined);
  });

  it("builds email prices from published database products", async () => {
    const result = await service.submit(orderInput);

    expect(result).toEqual({
      accepted: true,
      orderReference: expect.stringMatching(/^ATH-[A-F0-9]{8}$/),
    });
    expect(findProducts).toHaveBeenCalledWith({
      where: { id: { in: [productId] }, published: true },
      include: { translations: true },
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "hy",
        items: [
          {
            sku: "SKU-ONE",
            name: "Պրոտեին",
            quantity: 2,
            unitPrice: "24000",
            lineTotal: "48000",
          },
        ],
        total: "48000",
      }),
    );
  });

  it("does not report a partial total when any item needs a price quote", async () => {
    const secondProductId = "4ebeb944-3503-47a2-9843-d37f1eb34769";
    findProducts.mockResolvedValueOnce([
      publishedProduct,
      {
        ...publishedProduct,
        id: secondProductId,
        sku: "SKU-TBD",
        price: null,
        translations: [{ locale: "HY", name: "Սպորտային հավելում" }],
      },
    ]);

    await service.submit({
      ...orderInput,
      items: [
        orderInput.items[0]!,
        { productId: secondProductId, quantity: 1, expectedUnitPrice: null },
      ],
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ sku: "SKU-ONE", lineTotal: "48000" }),
          expect.objectContaining({ sku: "SKU-TBD", lineTotal: null }),
        ]),
        total: null,
      }),
    );
  });

  it("rejects a stale basket price before contacting email", async () => {
    await expect(
      service.submit({
        ...orderInput,
        items: [{ ...orderInput.items[0]!, expectedUnitPrice: "20000" }],
      }),
    ).rejects.toThrow(ConflictException);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an unpublished or unknown product", async () => {
    products.findMany.mockResolvedValueOnce([]);

    await expect(service.submit(orderInput)).rejects.toThrow(
      BadRequestException,
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects products currently out of stock", async () => {
    products.findMany.mockResolvedValueOnce([
      { ...publishedProduct, availability: "OUT_OF_STOCK" },
    ]);

    await expect(service.submit(orderInput)).rejects.toThrow(ConflictException);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
