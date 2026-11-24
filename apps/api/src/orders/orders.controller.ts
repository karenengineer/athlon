import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@Controller("public/orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  submit(
    @Body() input: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.orders.submit(input, idempotencyKey ?? "");
  }

  @Get("checkout-status")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  checkoutStatus(@Headers("idempotency-key") idempotencyKey?: string) {
    return this.orders.checkoutStatus(idempotencyKey ?? "");
  }

  @Get(":reference/payment-status")
  @UseGuards(ThrottlerGuard)
  // The bank return page polls every 4 s for about two minutes.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  paymentStatus(@Param("reference") reference: string) {
    return this.orders.paymentStatus(reference);
  }
}
