import { Module } from "@nestjs/common";
import { ReviewsModule } from "../reviews/reviews.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { AdminOrdersService } from "./admin-orders.service";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { OrderTelegramService } from "./order-telegram.service";
import { AmeriaPaymentsService } from "./ameria-payments.service";
import { AmeriaVposClient } from "./ameria-vpos.client";
import { CARD_PAYMENT_INITIALIZER } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { CardPaymentTestController } from "./card-payment-test.controller";
import { CardPaymentTestService } from "./card-payment-test.service";
import { CardPaymentTestGuestContextService } from "./card-payment-test-guest-context.service";
import { CardPaymentTestGuestGuard } from "./card-payment-test-guest.guard";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
import { CardPaymentSandboxService } from "./card-payment-sandbox.service";
import { AdminSandboxPaymentsController } from "./admin-sandbox-payments.controller";
import { AdminSandboxPaymentsService } from "./admin-sandbox-payments.service";
import { CardPaymentReconcilerService } from "./card-payment-reconciler.service";

@Module({
  imports: [ReviewsModule],
  controllers: [
    AdminOrdersController,
    OrdersController,
    CardPaymentTestController,
    AdminSandboxPaymentsController,
  ],
  providers: [
    AdminOrdersService,
    OrdersService,
    CardPaymentTestService,
    CardPaymentTestGuestContextService,
    CardPaymentTestGuestGuard,
    AmeriaSandboxClient,
    CardPaymentSandboxService,
    AdminSandboxPaymentsService,
    OrderEmailService,
    OrderPersistenceService,
    OrderTelegramService,
    AmeriaVposClient,
    AmeriaPaymentsService,
    CardPaymentReconcilerService,
    {
      provide: CARD_PAYMENT_INITIALIZER,
      useExisting: AmeriaPaymentsService,
    },
  ],
})
export class OrdersModule {}
