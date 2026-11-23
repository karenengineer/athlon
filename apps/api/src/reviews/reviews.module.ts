import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminReviewsController } from "./admin-reviews.controller";
import { AdminReviewsService } from "./admin-reviews.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, AdminReviewsService],
})
export class ReviewsModule {}
