import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import {
  CardPaymentTestGuestContextService,
  CardPaymentTestGuestRequest,
} from "./card-payment-test-guest-context.service";

@Injectable()
export class CardPaymentTestGuestGuard implements CanActivate {
  constructor(private readonly guests: CardPaymentTestGuestContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<CardPaymentTestGuestRequest>();
    request.cardPaymentTestOwner = this.guests.requireOwner(request);
    return true;
  }
}
