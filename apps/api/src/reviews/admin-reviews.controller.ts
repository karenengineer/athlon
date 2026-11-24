import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { AdminReviewsService } from "./admin-reviews.service";
import { AdminReviewQueryDto } from "./dto/admin-review-query.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";

@ApiTags("admin-reviews")
@Controller("admin/reviews")
@UseGuards(AdminAuthGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get() list(@Query() query: AdminReviewQueryDto): Promise<unknown> {
    return this.reviews.list(query);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateReviewDto,
  ): Promise<unknown> {
    return this.reviews.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.reviews.delete(id);
  }
}
