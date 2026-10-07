import { Module } from "@nestjs/common";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { AmeriaPaymentsService } from "./ameria-payments.service";
import { AmeriaVposClient } from "./ameria-vpos.client";
import { CARD_PAYMENT_INITIALIZER } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
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
