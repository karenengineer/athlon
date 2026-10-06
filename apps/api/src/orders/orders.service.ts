import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { PrismaService } from "../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderEmailService } from "./order-email.service";
import { OrderEmailItem } from "./orders.types";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: OrderEmailService,
  ) {}

  async submit(
    input: CreateOrderDto,
  ): Promise<{ accepted: true; orderReference: string }> {
    const locale = parseLocale(input.locale);
    const productIds = input.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, published: true },
      include: { translations: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException("One or more products cannot be ordered");
    }

    const productsById = new Map<string, (typeof products)[number]>(
      products.map((product) => [product.id, product]),
    );
    let total = new Prisma.Decimal(0);
    let hasUnpricedItems = false;
    let hasPricedItems = false;
    const items: OrderEmailItem[] = input.items.map((requested) => {
      const product = productsById.get(requested.productId)!;
      if (product.availability === "OUT_OF_STOCK") {
        throw new ConflictException("One or more products are out of stock");
      }

      const unitPrice = product.price?.toString() ?? null;
      const expectedPrice = requested.expectedUnitPrice;
      if (
        expectedPrice === null
          ? unitPrice !== null
          : unitPrice === null ||
            !new Prisma.Decimal(expectedPrice).eq(unitPrice)
      ) {
        throw new ConflictException("Basket prices changed. Review your order");
      }

      const productName = selectTranslation(product.translations, locale)?.name;
      const name = productName?.trim() || product.sku;
      const lineTotal =
        unitPrice === null
          ? null
          : new Prisma.Decimal(unitPrice).mul(requested.quantity);
      if (lineTotal === null) hasUnpricedItems = true;
      if (lineTotal !== null) {
        total = total.add(lineTotal);
        hasPricedItems = true;
      }

      return {
        sku: product.sku,
        name,
        quantity: requested.quantity,
        unitPrice,
        lineTotal: lineTotal?.toString() ?? null,
      };
    });

    const orderReference = `ATH-${randomUUID().slice(0, 8).toUpperCase()}`;
    await this.email.send({
      orderReference,
      locale: input.locale,
      customer: input.customer,
      items,
      total: hasPricedItems && !hasUnpricedItems ? total.toString() : null,
    });
    return { accepted: true, orderReference };
  }
}
