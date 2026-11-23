import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrdersService } from "./orders.service";

export const RECONCILE_INTERVAL_MS = 5 * 60_000;

/**
 * Periodically asks the bank about card orders still awaiting a verdict, so an
 * order is marked paid (and the shop notified) even when the shopper closes the
 * tab before the bank redirects back. Inert while card payments are disabled.
 */
@Injectable()
export class CardPaymentReconcilerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CardPaymentReconcilerService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.config.get<boolean>("AMERIA_PAYMENTS_ENABLED") !== true ||
      this.config.get<string>("NODE_ENV") === "test"
    ) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), RECONCILE_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.orders.reconcilePendingCardPayments();
    } catch {
      this.logger.warn("Card payment reconciliation failed");
    } finally {
      this.running = false;
    }
  }
}
