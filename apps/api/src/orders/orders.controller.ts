import {
  Body,
  Controller,
  Get,
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

  @Get(":reference/payment-status")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  paymentStatus(@Param("reference") reference: string) {
    return this.orders.paymentStatus(reference);
  }
}
