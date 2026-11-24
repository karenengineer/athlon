import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { PrismaService } from "../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { OrderTelegramService } from "./order-telegram.service";
import {
  CardPaymentInitializer,
  OrderEmailMessage,
  OrderPaymentChoice,
  OrderSubmissionResult,
} from "./orders.types";

export const CARD_PAYMENT_INITIALIZER = Symbol("CARD_PAYMENT_INITIALIZER");

interface NotificationState {
  id: string;
  status: string;
  recipientType: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: OrderEmailService,
    private readonly persistence: OrderPersistenceService,
    @Optional()
    @Inject(CARD_PAYMENT_INITIALIZER)
    private readonly paymentInitializer?: CardPaymentInitializer,
    @Optional()
    private readonly telegram?: OrderTelegramService,
  ) {}

  async submit(
    input: CreateOrderDto,
    idempotencyKey: string,
  ): Promise<OrderSubmissionResult> {
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) {
      throw new BadRequestException(
        "A valid Idempotency-Key header is required",
      );
    }

    const paymentMethod: OrderPaymentChoice =
      input.paymentMethod ?? "CASH_ON_DELIVERY";
    const locale = parseLocale(input.locale);
    const requestFingerprint = createOrderRequestFingerprint(input);
    const existingOrder =
      await this.persistence.findByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      if (existingOrder.requestFingerprint !== requestFingerprint) {
        throw new ConflictException(
          "Idempotency key was used for a different order",
        );
      }
      if (existingOrder.paymentMethod === "CASH_ON_DELIVERY") {
        await this.dispatchOrderNotifications(
          existingOrder,
          orderEmailMessage(existingOrder),
        );
        return {
          kind: "COD_ACCEPTED",
          accepted: true,
          orderReference: existingOrder.reference,
        };
      }
      const recoveredCheckout = this.recoverCardCheckout(existingOrder);
      if (recoveredCheckout) return recoveredCheckout;
      if (isCardCheckoutInitializing(existingOrder)) {
        throw new ServiceUnavailableException(
          "Card checkout is still being initialized",
        );
      }
      throw new ConflictException("This payment request cannot be resumed");
    }
    if (
      paymentMethod === "CARD" &&
      (!this.paymentInitializer || !this.paymentInitializer.isEnabled)
    ) {
      throw new ServiceUnavailableException("Card payments are unavailable");
    }

    const productIds = input.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
        category: { slug: { not: "resistance-bands" } },
      },
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
    const persistenceItems = input.items.map((requested) => {
      const product = productsById.get(requested.productId)!;
      if (product.availability !== "IN_STOCK") {
        throw new ConflictException("One or more products are out of stock");
      }
      if (product.currency !== "AMD") {
        throw new ConflictException("Only AMD orders are currently supported");
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
      if (paymentMethod === "CARD" && unitPrice === null) {
        throw new BadRequestException(
          "Card payment is unavailable for products without a listed price",
        );
      }

      const productName = selectTranslation(product.translations, locale)?.name;
      const name = productName?.trim() || product.sku;
      const lineTotal =
        unitPrice === null
          ? null
          : new Prisma.Decimal(unitPrice).mul(requested.quantity);
      if (lineTotal === null) hasUnpricedItems = true;
      else total = total.add(lineTotal);

      const item = {
        sku: product.sku,
        name,
        quantity: requested.quantity,
        unitPrice,
        lineTotal: lineTotal?.toString() ?? null,
      };
      return {
        productId: product.id,
        ...item,
      };
    });

    const orderReference = `ATH-${randomUUID().replaceAll("-", "").toUpperCase()}`;
    const totalText = hasUnpricedItems ? null : total.toString();
    const paymentAttempt =
      paymentMethod === "CARD"
        ? {
            provider: "AMERIABANK" as const,
            status: "PENDING" as const,
            ameriaOrderId: await this.persistence.nextAmeriaOrderId(),
            requestIdempotencyKey: idempotencyKey,
            expectedAmount: total.toString(),
            currency: "AMD",
          }
        : undefined;
    const persisted = await this.persistence.createPendingOrder({
      reference: orderReference,
      idempotencyKey,
      requestFingerprint,
      locale,
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      deliveryAddress: input.customer.address,
      paymentMethod,
      currency: "AMD",
      total: totalText,
      items: persistenceItems,
      ...(paymentAttempt ? { paymentAttempt } : {}),
    });
    const order = persisted.order;

    if (paymentMethod === "CASH_ON_DELIVERY") {
      const message = orderEmailMessage(order);
      await this.dispatchOrderNotifications(order, message, persisted.created);
      return {
        kind: "COD_ACCEPTED",
        accepted: true,
        orderReference: order.reference,
      };
    }

    if (!persisted.created) {
      // Another request may have initialized the same idempotency key between
      // the initial lookup and this transaction. Reload once and recover its
      // already-created hosted checkout instead of making the client retry.
      const racedOrder =
        await this.persistence.findByIdempotencyKey(idempotencyKey);
      if (racedOrder?.requestFingerprint === requestFingerprint) {
        const recoveredCheckout = this.recoverCardCheckout(racedOrder);
        if (recoveredCheckout) return recoveredCheckout;
        if (isCardCheckoutInitializing(racedOrder)) {
          throw new ServiceUnavailableException(
            "Card checkout is still being initialized",
          );
        }
      }
      throw new ConflictException(
        "This card order request was already submitted",
      );
    }

    try {
      const initialized = await this.paymentInitializer!.initialize(order);
      if (
        !isValidHostedCheckoutUrl(initialized.checkoutUrl) ||
        !this.paymentInitializer!.isTrustedCheckoutUrl(initialized.checkoutUrl)
      ) {
        throw new Error("Invalid hosted checkout URL");
      }
      const paymentAttemptId = order.paymentAttempts[0]?.id;
      if (!paymentAttemptId)
        throw new Error("Payment attempt was not persisted");
      await this.persistence.recordProviderPaymentId(
        paymentAttemptId,
        initialized.providerPaymentId,
        initialized.checkoutUrl,
      );
      return {
        kind: "CARD_PAYMENT_PENDING",
        accepted: true,
        orderReference: order.reference,
        paymentStatus: "PENDING",
        checkoutUrl: initialized.checkoutUrl,
      };
    } catch {
      await this.persistence.markInitializationFailed(order.id);
      throw new ServiceUnavailableException(
        "Card payment could not be started",
      );
    }
  }

  async paymentStatus(orderReference: string) {
    if (!/^ATH-[A-F0-9]{32}$/.test(orderReference)) {
      throw new BadRequestException("Invalid order reference");
    }
    if (!this.paymentInitializer?.isEnabled) {
      throw new ServiceUnavailableException(
        "Ameriabank payment verification is not configured",
      );
    }
    const verified =
      await this.paymentInitializer.verifyAndApplyStatus(orderReference);
    if (verified.newlyPaidOrderId) {
      await this.dispatchPaymentConfirmed(verified.newlyPaidOrderId);
    }
    return {
      orderReference: verified.orderReference,
      paymentStatus: verified.paymentStatus,
      locale: verified.locale,
    };
  }

  /**
   * Verify card orders whose shopper never came back from the bank page, so a
   * paid order is never left PAYMENT_PENDING. Errors are per-order and quiet.
   */
  async reconcilePendingCardPayments(now = new Date()): Promise<number> {
    if (!this.paymentInitializer?.isEnabled) return 0;
    const pending = await this.persistence.findPendingCardOrderReferences({
      createdBefore: new Date(now.getTime() - 2 * 60_000),
      createdAfter: new Date(now.getTime() - 72 * 60 * 60_000),
      limit: 25,
    });
    let checked = 0;
    for (const { reference } of pending) {
      try {
        await this.paymentStatus(reference);
        checked += 1;
      } catch {
        this.logger.warn("Could not reconcile a pending card payment");
      }
    }
    return checked;
  }

  /** Runs once, on the request that moved the order to PAID. */
  private async dispatchPaymentConfirmed(orderId: string): Promise<void> {
    try {
      const order = await this.persistence.findOrderWithNotifications(orderId);
      if (!order) return;
      const notifications = order.notifications.filter(
        (notification) => notification.eventType === "PAYMENT_CONFIRMED",
      );
      await this.dispatchOrderNotifications(
        { id: order.id, notifications },
        { ...orderEmailMessage(order), paidByCard: true },
        true,
        "PAYMENT_CONFIRMED",
      );
    } catch {
      // The payment is recorded; failed intents stay FAILED/PENDING for ops.
      this.logger.warn("Could not deliver payment confirmation notifications");
    }
  }

  private recoverCardCheckout(order: {
    status: string;
    reference: string;
    paymentAttempts?: Array<{
      status: string;
      checkoutUrl?: string | null;
    }>;
  }): OrderSubmissionResult | null {
    if (
      !this.paymentInitializer?.isEnabled ||
      order.status !== "PAYMENT_PENDING"
    ) {
      return null;
    }
    const pendingAttempt = order.paymentAttempts?.find(
      (attempt) => attempt.status === "PENDING",
    );
    if (
      !pendingAttempt?.checkoutUrl ||
      !this.paymentInitializer.isTrustedCheckoutUrl(pendingAttempt.checkoutUrl)
    ) {
      return null;
    }
    return {
      kind: "CARD_PAYMENT_PENDING",
      accepted: true,
      orderReference: order.reference,
      paymentStatus: "PENDING",
      checkoutUrl: pendingAttempt.checkoutUrl,
    };
  }

  private async dispatchOrderNotifications(
    order: { id: string; notifications?: NotificationState[] },
    message: OrderEmailMessage,
    createTelegramIntent = false,
    eventType: "ORDER_ACCEPTED" | "PAYMENT_CONFIRMED" = "ORDER_ACCEPTED",
  ): Promise<void> {
    const notifications = order.notifications ?? [];
    const telegramDelivery = this.dispatchTelegramNotification(
      order.id,
      notifications.find(
        ({ recipientType }) => recipientType === "MERCHANT_TELEGRAM",
      ),
      message,
      createTelegramIntent,
      eventType,
    );
    try {
      await this.dispatchOrderEmails(notifications, message);
    } finally {
      await telegramDelivery;
    }
  }

  private async dispatchOrderEmails(
    notifications: NotificationState[],
    message: OrderEmailMessage,
  ): Promise<void> {
    for (const notification of notifications) {
      if (
        notification.status === "SENT" ||
        notification.recipientType === "MERCHANT_TELEGRAM"
      ) {
        continue;
      }

      await this.persistence.recordNotificationAttempt(notification.id);
      try {
        if (notification.recipientType === "MERCHANT") {
          await this.email.send(message, notification.id);
        } else if (notification.recipientType === "CUSTOMER") {
          await this.email.sendCustomer(message, notification.id);
        } else {
          continue;
        }
        await this.persistence.markNotificationSent(notification.id);
      } catch {
        await this.persistence.markNotificationFailed(notification.id);
        throw new ServiceUnavailableException(
          "Order notification delivery is unavailable",
        );
      }
    }
  }

  private async dispatchTelegramNotification(
    orderId: string,
    notification: NotificationState | undefined,
    message: OrderEmailMessage,
    createIntent: boolean,
    eventType: "ORDER_ACCEPTED" | "PAYMENT_CONFIRMED",
  ): Promise<void> {
    try {
      if (!this.telegram?.isEnabled || notification?.status === "SENT") return;
      // The order and email intents have already committed. A Telegram insert
      // failure cannot roll them back, and replays never add missing intents.
      const intent =
        notification ??
        (createIntent
          ? await this.persistence.createMerchantTelegramNotification(
              orderId,
              eventType,
            )
          : undefined);
      if (!intent) return;

      const skipSent = { skipSent: true };
      await this.persistence.recordNotificationAttempt(intent.id, skipSent);
      try {
        await this.telegram.send(message);
      } catch {
        await this.persistence.markNotificationFailed(intent.id, skipSent);
        return;
      }
      await this.persistence.markNotificationSent(intent.id);
    } catch {
      this.logger.warn("Could not track order Telegram notification");
    }
  }
}

function orderEmailMessage(order: {
  reference: string;
  locale: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  total: { toString(): string } | string | null;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: { toString(): string } | string | null;
    lineTotal: { toString(): string } | string | null;
  }>;
}): OrderEmailMessage {
  return {
    orderReference: order.reference,
    locale: order.locale.toLowerCase() as "hy" | "ru" | "en",
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address: order.deliveryAddress,
    },
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice?.toString() ?? null,
      lineTotal: item.lineTotal?.toString() ?? null,
    })),
    total: order.total?.toString() ?? null,
  };
}

function createOrderRequestFingerprint(input: CreateOrderDto): string {
  const canonicalRequest = {
    locale: parseLocale(input.locale),
    paymentMethod: input.paymentMethod ?? "CASH_ON_DELIVERY",
    customer: {
      name: input.customer.name.trim(),
      email: input.customer.email.trim().toLowerCase(),
      phone: input.customer.phone.trim(),
      address: input.customer.address.trim(),
    },
    items: input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      expectedUnitPrice:
        item.expectedUnitPrice === null
          ? null
          : new Prisma.Decimal(item.expectedUnitPrice).toFixed(2),
    })),
  };
  return createHash("sha256")
    .update(JSON.stringify(canonicalRequest))
    .digest("hex");
}

function isCardCheckoutInitializing(order: {
  paymentMethod?: string;
  status: string;
  paymentAttempts?: Array<{
    status: string;
    checkoutUrl?: string | null;
  }>;
}): boolean {
  if (order.paymentMethod !== "CARD" || order.status !== "PAYMENT_PENDING") {
    return false;
  }
  return (
    order.paymentAttempts?.some(
      (attempt) => attempt.status === "PENDING" && !attempt.checkoutUrl,
    ) ?? false
  );
}

function isValidHostedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
