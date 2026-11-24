import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { Locale } from "../generated/prisma/enums";
import { PrismaService } from "../database/prisma.service";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { CreateInvitedReviewDto } from "./dto/create-invited-review.dto";
import { ReviewInvitationEmailService } from "./review-invitation-email.service";
import {
  REVIEW_INVITATION_TTL_MS,
  REVIEW_TOKEN_PATTERN,
  hashReviewToken,
  newReviewToken,
} from "./review-token";

export type ReviewEmailResult = "SENT" | "FAILED" | "NO_PRODUCTS";

/** First word of the name the customer ordered with, for a friendly default. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]?.slice(0, 80) ?? "";
}

/**
 * Review links for delivered orders. Only the buyer of a delivered order gets
 * a link, and the link only accepts reviews for products in that order, once
 * per product. Reviews still wait for admin approval.
 */
@Injectable()
export class ReviewInvitationsService {
  private readonly logger = new Logger(ReviewInvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: ReviewInvitationEmailService,
    private readonly config: ConfigService,
  ) {}

  /** Issue (or rotate) the order's review link and email it to the buyer. */
  async issueAndSend(orderId: string): Promise<ReviewEmailResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        reference: true,
        locale: true,
        customerName: true,
        customerEmail: true,
        deliveredAt: true,
        items: { select: { productId: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!order.deliveredAt) {
      throw new ConflictException("Order is not marked as delivered");
    }
    const items = order.items.filter((item) => item.productId !== null);
    if (items.length === 0) return "NO_PRODUCTS";

    const { token, tokenHash } = newReviewToken();
    const expiresAt = new Date(Date.now() + REVIEW_INVITATION_TTL_MS);
    await this.prisma.reviewInvitation.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });
    const locale = order.locale.toLowerCase() as "hy" | "ru" | "en";
    const origin = this.config.get<string>(
      "PUBLIC_SITE_ORIGIN",
      "https://athlon.am",
    );
    try {
      await this.email.send(
        {
          to: order.customerEmail,
          locale,
          customerName: firstName(order.customerName),
          orderReference: order.reference,
          productNames: [...new Set(items.map((item) => item.name))],
          reviewUrl: `${origin}/${locale}/review/${token}`,
        },
        `review-invitation-${tokenHash.slice(0, 40)}`,
      );
    } catch {
      this.logger.warn(`Review email for ${order.reference} was not sent`);
      return "FAILED";
    }
    await this.prisma.reviewInvitation.update({
      where: { orderId: order.id },
      data: { sentAt: new Date(), sendCount: { increment: 1 } },
    });
    return "SENT";
  }

  /** Products the link holder may review, and which are already reviewed. */
  async describe(token: string, localeValue?: string): Promise<unknown> {
    const invitation = await this.findValid(token);
    const locale = localeValue
      ? parseLocale(localeValue)
      : invitation.order.locale;
    const reviewed = new Set(
      invitation.order.reviews.map((review) => review.productId),
    );
    const seen = new Set<string>();
    const items = [];
    for (const item of invitation.order.items) {
      const product = item.product;
      if (!product || seen.has(product.id)) continue;
      seen.add(product.id);
      const image = product.images[0];
      items.push({
        productId: product.id,
        slug: product.published ? product.slug : null,
        name:
          selectTranslation(product.translations, locale)?.name ?? item.name,
        imageUrl: image ? `/api/v1/media/${image.thumbnailKey}` : null,
        reviewed: reviewed.has(product.id),
      });
    }
    return {
      authorName: firstName(invitation.order.customerName),
      locale: invitation.order.locale.toLowerCase(),
      expiresAt: invitation.expiresAt.toISOString(),
      items,
    };
  }

  async submit(token: string, input: CreateInvitedReviewDto): Promise<unknown> {
    const invitation = await this.findValid(token);
    const bought = invitation.order.items.some(
      (item) => item.product?.id === input.productId,
    );
    if (!bought) throw new NotFoundException("Product not in this order");
    try {
      await this.prisma.productReview.create({
        data: {
          productId: input.productId,
          orderId: invitation.order.id,
          locale: parseLocale(input.locale),
          authorName: input.authorName,
          rating: input.rating,
          body: input.body,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("This product is already reviewed");
      }
      throw error;
    }
    return { status: "PENDING" };
  }

  private async findValid(token: string) {
    if (!REVIEW_TOKEN_PATTERN.test(token)) {
      throw new NotFoundException("Review link not found");
    }
    const invitation = await this.prisma.reviewInvitation.findUnique({
      where: { tokenHash: hashReviewToken(token) },
      select: {
        expiresAt: true,
        order: {
          select: {
            id: true,
            locale: true,
            customerName: true,
            deliveredAt: true,
            reviews: { select: { productId: true } },
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                name: true,
                product: {
                  select: {
                    id: true,
                    slug: true,
                    published: true,
                    translations: { select: { locale: true, name: true } },
                    images: {
                      orderBy: [{ primary: "desc" }, { position: "asc" }],
                      take: 1,
                      select: { thumbnailKey: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!invitation || !invitation.order.deliveredAt) {
      throw new NotFoundException("Review link not found");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException("Review link expired");
    }
    return invitation as typeof invitation & {
      order: { locale: Locale };
    };
  }
}
