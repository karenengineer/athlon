import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface CardPaymentTestOwner {
  id: string;
  expiresAtMs: number;
  sandboxAccess?: boolean;
}

export interface CardPaymentTestGuestRequest extends Request {
  cardPaymentTestOwner: CardPaymentTestOwner;
}

type OwnerContext = CardPaymentTestOwner & { csrfToken: string };
const OWNER_COOKIE = "athlon_card_payment_test_owner";
const OWNER_TTL_MS = 15 * 60_000;
const MAX_OWNERS = 500;

@Injectable()
export class CardPaymentTestGuestContextService {
  private readonly owners = new Map<string, OwnerContext>();

  constructor(private readonly config: ConfigService) {}

  assertOrigin(request: Request, mutation = false): void {
    const origin = request.headers.origin;
    if (origin === undefined && !mutation) return;
    if (
      !origin ||
      origin === "null" ||
      !this.config
        .get<string>("CORS_ORIGINS", "")
        .split(",")
        .some((allowed) => allowed.trim() === origin)
    ) {
      throw new ForbiddenException("Mock payment origin is not allowed");
    }
  }

  bootstrap(request: Request, response: Response): string {
    this.pruneExpired();
    let owner = this.findOwner(request);
    if (!owner) {
      if (this.owners.size >= MAX_OWNERS) {
        throw new ServiceUnavailableException("Too many active mock browsers");
      }
      owner = {
        id: randomBytes(32).toString("hex"),
        csrfToken: randomBytes(32).toString("hex"),
        expiresAtMs: Date.now() + OWNER_TTL_MS,
      };
      this.owners.set(owner.id, owner);
    }
    response.cookie(OWNER_COOKIE, owner.id, {
      httpOnly: true,
      sameSite: "strict",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: "/api/v1/public/card-payment-test",
      maxAge: owner.expiresAtMs - Date.now(),
    });
    return owner.csrfToken;
  }

  requireOwner(request: Request): CardPaymentTestOwner {
    if (
      this.config.get<boolean>("CARD_PAYMENT_TEST_FLOW_ENABLED", false) !== true
    ) {
      throw new NotFoundException("Mock payment test flow is disabled");
    }
    const mutation = request.method !== "GET" && request.method !== "HEAD";
    this.assertOrigin(request, mutation);
    this.pruneExpired();
    const owner = this.findOwner(request);
    if (
      !owner ||
      (mutation &&
        request.headers["x-card-payment-test-csrf"] !== owner.csrfToken)
    ) {
      throw new ForbiddenException(
        "Valid mock browser and CSRF token required",
      );
    }
    return {
      id: owner.id,
      expiresAtMs: owner.expiresAtMs,
      ...(owner.sandboxAccess ? { sandboxAccess: true } : {}),
    };
  }

  accessRequired(request: Request): boolean {
    return (
      this.config.get<string>("CARD_PAYMENT_TEST_MODE") === "AMERIA_SANDBOX" &&
      this.findOwner(request)?.sandboxAccess !== true
    );
  }

  grantAccess(owner: CardPaymentTestOwner, token: string): void {
    const expected = this.config.get<string>(
      "CARD_PAYMENT_TEST_ACCESS_TOKEN",
      "",
    );
    const digest = (value: string) =>
      createHash("sha256").update(value).digest();
    const stored = this.owners.get(owner.id);
    if (
      this.config.get<string>("CARD_PAYMENT_TEST_MODE") !== "AMERIA_SANDBOX" ||
      expected.length < 32 ||
      typeof token !== "string" ||
      !timingSafeEqual(digest(token), digest(expected)) ||
      !stored ||
      stored.expiresAtMs <= Date.now()
    )
      throw new ForbiddenException("Sandbox access denied");
    stored.sandboxAccess = true;
  }

  private findOwner(request: Request): OwnerContext | undefined {
    const id: unknown = request.cookies?.[OWNER_COOKIE];
    return typeof id === "string" ? this.owners.get(id) : undefined;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, owner] of this.owners) {
      if (owner.expiresAtMs <= now) this.owners.delete(id);
    }
  }
}
