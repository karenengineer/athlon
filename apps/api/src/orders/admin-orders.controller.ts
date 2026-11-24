import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminOrderQueryDto } from "./dto/admin-order-query.dto";

@ApiTags("admin-orders")
@Controller("admin/orders")
@UseGuards(AdminAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: AdminOrderQueryDto): Promise<unknown> {
    return this.orders.list(query);
  }

  @Post(":id/delivered")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  markDelivered(@Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.orders.markDelivered(id);
  }

  @Post(":id/review-email")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  resendReviewEmail(@Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.orders.resendReviewEmail(id);
  }
}
