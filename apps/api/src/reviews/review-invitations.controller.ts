import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CreateInvitedReviewDto } from "./dto/create-invited-review.dto";
import { ReviewInvitationsService } from "./review-invitations.service";

/** The buyer's personal review link, sent by email after delivery. */
@ApiTags("reviews")
@Controller("public/review-invitations/:token")
@UseGuards(ThrottlerGuard)
export class ReviewInvitationsController {
  constructor(private readonly invitations: ReviewInvitationsService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex, nofollow")
  describe(
    @Param("token") token: string,
    @Query("locale") locale?: string,
  ): Promise<unknown> {
    return this.invitations.describe(token, locale);
  }

  @Post("reviews")
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  submit(
    @Param("token") token: string,
    @Body() input: CreateInvitedReviewDto,
  ): Promise<unknown> {
    return this.invitations.submit(token, input);
  }
}
