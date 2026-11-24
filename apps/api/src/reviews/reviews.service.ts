import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

export const PUBLIC_REVIEW_PAGE_SIZE = 20;

export interface ReviewSummary {
  count: number;
  /** Average of approved ratings, rounded to one decimal; null with none. */
  average: number | null;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Approved reviews and rating summary for a published product. */
  async listPublic(slug: string): Promise<unknown> {
    const product = await this.publishedProduct(slug);
    const where = { productId: product.id, status: "APPROVED" as const };
    const [items, aggregate] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PUBLIC_REVIEW_PAGE_SIZE,
        select: {
          id: true,
          authorName: true,
          rating: true,
          body: true,
          locale: true,
          orderId: true,
          createdAt: true,
        },
      }),
      this.prisma.productReview.aggregate({
        where,
        _count: { _all: true },
        _avg: { rating: true },
      }),
    ]);
    return {
      summary: toSummary(aggregate._count._all, aggregate._avg.rating),
      items: items.map(({ orderId, ...item }) => ({
        ...item,
        verified: orderId !== null,
        locale: item.locale.toLowerCase(),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private async publishedProduct(slug: string): Promise<{ id: string }> {
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
}

export function toSummary(
  count: number,
  average: number | null | undefined,
): ReviewSummary {
  return {
    count,
    average:
      count > 0 && average != null ? Math.round(average * 10) / 10 : null,
  };
}
