import { Module } from "@nestjs/common";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { AmeriaPaymentsService } from "./ameria-payments.service";
import { AmeriaVposClient } from "./ameria-vpos.client";
import { CARD_PAYMENT_INITIALIZER } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { CardPaymentTestController } from "./card-payment-test.controller";
import { CardPaymentTestService } from "./card-payment-test.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [OrdersController, CardPaymentTestController],
  providers: [
    OrdersService,
    CardPaymentTestService,
    OrderEmailService,
    OrderPersistenceService,
    AmeriaVposClient,
    AmeriaPaymentsService,
    {
      provide: CARD_PAYMENT_INITIALIZER,
      useExisting: AmeriaPaymentsService,
    },
  ],
})
export class OrdersModule {}
