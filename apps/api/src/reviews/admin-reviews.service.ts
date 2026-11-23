import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AdminReviewQueryDto } from "./dto/admin-review-query.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";

const select = {
  id: true,
  authorName: true,
  rating: true,
  body: true,
  locale: true,
  status: true,
  moderatedAt: true,
  createdAt: true,
  product: {
    select: {
      slug: true,
      translations: { select: { locale: true, name: true } },
    },
  },
} as const;

@Injectable()
export class AdminReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminReviewQueryDto): Promise<unknown> {
    const where = query.status ? { status: query.status } : {};
    const [items, total, pending] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select,
      }),
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.count({ where: { status: "PENDING" } }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        authorName: item.authorName,
        rating: item.rating,
        body: item.body,
        locale: item.locale.toLowerCase(),
        status: item.status,
        moderatedAt: item.moderatedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        product: {
          slug: item.product.slug,
          name:
            item.product.translations.find((t) => t.locale === "HY")?.name ??
            item.product.translations[0]?.name ??
            item.product.slug,
        },
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        pending,
      },
    };
  }

  async update(id: string, input: UpdateReviewDto): Promise<unknown> {
    await this.ensure(id);
    const review = await this.prisma.productReview.update({
      where: { id },
      data: {
        status: input.status,
        moderatedAt: input.status === "PENDING" ? null : new Date(),
      },
      select: { id: true, status: true },
    });
    return review;
  }

  async delete(id: string): Promise<void> {
    await this.ensure(id);
    await this.prisma.productReview.delete({ where: { id } });
  }

  private async ensure(id: string): Promise<void> {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const found =
      uuid.test(id) &&
      (await this.prisma.productReview.findUnique({
        where: { id },
        select: { id: true },
      }));
    if (!found) throw new NotFoundException("Review not found");
  }
}
