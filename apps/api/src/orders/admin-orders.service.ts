import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import {
  ReviewEmailResult,
  ReviewInvitationsService,
} from "../reviews/review-invitations.service";
import { AdminOrderQueryDto } from "./dto/admin-order-query.dto";

/**
 * Orders the customer can actually have received: cash orders that were not
 * cancelled, and card orders the bank confirmed as paid.
 */
export const deliverableOrder: Prisma.OrderWhereInput = {
  OR: [
    {
      paymentMethod: "CASH_ON_DELIVERY",
      status: { in: ["PENDING", "CONFIRMED", "PAID"] },
    },
    { paymentMethod: "CARD", status: "PAID" },
  ],
};

const select = {
  id: true,
  reference: true,
  createdAt: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  deliveryAddress: true,
  paymentMethod: true,
  status: true,
  total: true,
  currency: true,
  deliveredAt: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: { name: true, sku: true, quantity: true },
  },
  reviewInvitation: { select: { sentAt: true, sendCount: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.OrderSelect;

type AdminOrderRow = Prisma.OrderGetPayload<{ select: typeof select }>;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: ReviewInvitationsService,
  ) {}

  async list(query: AdminOrderQueryDto): Promise<unknown> {
    const where: Prisma.OrderWhereInput =
      query.filter === "TO_DELIVER"
        ? { AND: [deliverableOrder, { deliveredAt: null }] }
        : query.filter === "DELIVERED"
          ? { deliveredAt: { not: null } }
          : {};
    const [rows, total, toDeliver] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: { AND: [deliverableOrder, { deliveredAt: null }] },
      }),
    ]);
    return {
      items: rows.map(toAdminOrder),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        toDeliver,
      },
    };
  }

  /** Record delivery once and email the buyer their review link. */
  async markDelivered(
    id: string,
  ): Promise<{ deliveredAt: string; reviewEmail: ReviewEmailResult | null }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, deliveredAt: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.deliveredAt) {
      // Already delivered: idempotent, no second email (use resend for that).
      return {
        deliveredAt: order.deliveredAt.toISOString(),
        reviewEmail: null,
      };
    }
    const deliveredAt = new Date();
    const { count } = await this.prisma.order.updateMany({
      where: { AND: [{ id, deliveredAt: null }, deliverableOrder] },
      data: { deliveredAt },
    });
    if (count === 0) {
      const latest = await this.prisma.order.findUnique({
        where: { id },
        select: { deliveredAt: true },
      });
      if (latest?.deliveredAt) {
        return {
          deliveredAt: latest.deliveredAt.toISOString(),
          reviewEmail: null,
        };
      }
      throw new ConflictException("This order cannot be marked as delivered");
    }
    const reviewEmail = await this.invitations.issueAndSend(id);
    return { deliveredAt: deliveredAt.toISOString(), reviewEmail };
  }

  /** Send a fresh review link; the previous link stops working. */
  async resendReviewEmail(
    id: string,
  ): Promise<{ reviewEmail: ReviewEmailResult }> {
    return { reviewEmail: await this.invitations.issueAndSend(id) };
  }
}

function toAdminOrder(row: AdminOrderRow) {
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    deliveryAddress: row.deliveryAddress,
    paymentMethod: row.paymentMethod,
    status: row.status,
    total: row.total === null ? null : row.total.toString(),
    currency: row.currency,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    canDeliver:
      row.deliveredAt === null &&
      (row.paymentMethod === "CARD"
        ? row.status === "PAID"
        : ["PENDING", "CONFIRMED", "PAID"].includes(row.status)),
    reviewEmailSentAt: row.reviewInvitation?.sentAt?.toISOString() ?? null,
    reviewEmailCount: row.reviewInvitation?.sendCount ?? 0,
    reviewCount: row._count.reviews,
    items: row.items,
  };
}
