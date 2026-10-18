import { Module } from "@nestjs/common";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { AmeriaPaymentsService } from "./ameria-payments.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
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

@Module({
  controllers: [OrdersController, CardPaymentTestController],
  providers: [
    OrdersService,
    CardPaymentTestService,
    CardPaymentTestGuestContextService,
    CardPaymentTestGuestGuard,
    AmeriaSandboxClient,
    CardPaymentSandboxService,
    OrderEmailService,
    OrderPersistenceService,
    AmeriaVposClient,
    AmeriaSandboxClient,
    AmeriaPaymentsService,
    {
      provide: CARD_PAYMENT_INITIALIZER,
      useExisting: AmeriaPaymentsService,
    },
  ],
})
export class OrdersModule {}
