import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { AdminSandboxPaymentsService } from "./admin-sandbox-payments.service";

@Controller("admin/sandbox-payments")
@UseGuards(AdminAuthGuard)
export class AdminSandboxPaymentsController {
  constructor(private readonly payments: AdminSandboxPaymentsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.payments.list(page);
  }

  @Post(":reference/refund")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  refund(@Param("reference", ParseUUIDPipe) reference: string) {
    return this.payments.refund(reference);
  }

  @Post(":reference/cancel")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  cancel(@Param("reference", ParseUUIDPipe) reference: string) {
    return this.payments.cancel(reference);
  }

  @Post(":reference/recheck")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @HttpCode(200)
  recheck(@Param("reference", ParseUUIDPipe) reference: string) {
    return this.payments.recheck(reference);
  }
}
