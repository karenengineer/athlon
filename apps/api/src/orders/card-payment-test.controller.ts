import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { CardPaymentTestService } from "./card-payment-test.service";
import { CompleteCardPaymentTestSessionDto } from "./dto/complete-card-payment-test-session.dto";
import { CreateCardPaymentTestSessionDto } from "./dto/create-card-payment-test-session.dto";

@Controller("admin/card-payment-test")
@UseGuards(AdminAuthGuard)
export class CardPaymentTestController {
  constructor(private readonly sessions: CardPaymentTestService) {}

  @Get("config")
  getConfig() {
    return { enabled: this.sessions.isEnabled(), mode: "MOCK" as const };
  }

  @Post("sessions")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createSession(@Body() input: CreateCardPaymentTestSessionDto) {
    return this.sessions.createSession(input);
  }

  @Get("sessions/:reference")
  getSession(@Param("reference") reference: string) {
    return this.sessions.getSession(reference);
  }

  @Post("sessions/:reference/outcome")
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  completeSession(
    @Param("reference") reference: string,
    @Body() input: CompleteCardPaymentTestSessionDto,
  ) {
    return this.sessions.completeSession(reference, input.outcome);
  }
}
