import { Module } from "@nestjs/common";
import { OrderEmailService } from "./order-email.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderEmailService],
})
export class OrdersModule {}
