import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request, Response } from "express";
import {
  CardPaymentTestGuestContextService,
  CardPaymentTestGuestRequest,
} from "./card-payment-test-guest-context.service";
import { CardPaymentTestGuestGuard } from "./card-payment-test-guest.guard";
import { CardPaymentTestService } from "./card-payment-test.service";
import { CompleteCardPaymentTestSessionDto } from "./dto/complete-card-payment-test-session.dto";
import { CreateCardPaymentTestSessionDto } from "./dto/create-card-payment-test-session.dto";
import { CardPaymentTestAccessDto } from "./dto/card-payment-test-access.dto";

@Controller("public/card-payment-test")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class CardPaymentTestController {
  constructor(
    private readonly sessions: CardPaymentTestService,
    private readonly guests: CardPaymentTestGuestContextService,
  ) {}

  @Get("config")
  @Header("Cache-Control", "no-store")
  getConfig(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.guests.assertOrigin(request);
    const enabled = this.sessions.isEnabled();
    return {
      enabled,
      mode: this.sessions.getMode(),
      csrfToken: enabled ? this.guests.bootstrap(request, response) : null,
      accessRequired: enabled && this.guests.accessRequired(request),
    };
  }

  @Post("access")
  @Header("Cache-Control", "no-store")
  @UseGuards(CardPaymentTestGuestGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  grantAccess(
    @Body() input: CardPaymentTestAccessDto,
    @Req() request: CardPaymentTestGuestRequest,
  ) {
    this.guests.grantAccess(request.cardPaymentTestOwner, input.accessToken);
    return { unlocked: true };
  }

  @Post("sessions")
  @Header("Cache-Control", "no-store")
  @UseGuards(CardPaymentTestGuestGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createSession(
    @Body() input: CreateCardPaymentTestSessionDto,
    @Req() request: CardPaymentTestGuestRequest,
  ) {
    return this.sessions.createSession(input, request.cardPaymentTestOwner);
  }

  @Get("sessions/:reference")
  @Header("Cache-Control", "no-store")
  @UseGuards(CardPaymentTestGuestGuard)
  getSession(
    @Param("reference") reference: string,
    @Req() request: CardPaymentTestGuestRequest,
  ) {
    return this.sessions.getSession(reference, request.cardPaymentTestOwner.id);
  }

  @Post("sessions/:reference/outcome")
  @Header("Cache-Control", "no-store")
  @UseGuards(CardPaymentTestGuestGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  completeSession(
    @Param("reference") reference: string,
    @Body() input: CompleteCardPaymentTestSessionDto,
    @Req() request: CardPaymentTestGuestRequest,
  ) {
    return this.sessions.completeSession(
      reference,
      input.outcome,
      request.cardPaymentTestOwner.id,
    );
  }
}
