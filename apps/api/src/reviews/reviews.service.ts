import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { parseLocale } from "../common/localization/locale";
import { CreateReviewDto } from "./dto/create-review.dto";

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
      items: items.map((item) => ({
        ...item,
        locale: item.locale.toLowerCase(),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  /** Stores a review for moderation. It stays hidden until approved. */
  async submit(slug: string, input: CreateReviewDto): Promise<unknown> {
    const product = await this.publishedProduct(slug);
    // Honeypot filled in: answer as if accepted, store nothing.
    if (input.website?.trim()) return { status: "PENDING" };
    await this.prisma.productReview.create({
      data: {
        productId: product.id,
        locale: parseLocale(input.locale),
        authorName: input.authorName,
        rating: input.rating,
        body: input.body,
      },
    });
    return { status: "PENDING" };
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
