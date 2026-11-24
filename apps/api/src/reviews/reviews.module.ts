import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminReviewsController } from "./admin-reviews.controller";
import { AdminReviewsService } from "./admin-reviews.service";
import { ReviewInvitationEmailService } from "./review-invitation-email.service";
import { ReviewInvitationsController } from "./review-invitations.controller";
import { ReviewInvitationsService } from "./review-invitations.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule],
  controllers: [
    ReviewsController,
    ReviewInvitationsController,
    AdminReviewsController,
  ],
  providers: [
    ReviewsService,
    AdminReviewsService,
    ReviewInvitationEmailService,
    ReviewInvitationsService,
  ],
  exports: [ReviewInvitationsService],
})
export class ReviewsModule {}
