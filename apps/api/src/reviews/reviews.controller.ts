import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReviewsService } from "./reviews.service";

/**
 * Approved reviews for a product. There is no anonymous submission: buyers
 * review through the personal link emailed after delivery.
 */
@ApiTags("reviews")
@Controller("products/:slug/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param("slug") slug: string): Promise<unknown> {
    return this.reviews.listPublic(slug);
  }
}
