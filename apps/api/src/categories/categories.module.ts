import { Module } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { PublicCategoriesController } from "./public-categories.controller";
import { AdminCategoriesController } from "./admin-categories.controller";
import { AdminCategoriesService } from "./admin-categories.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PublicCategoriesController, AdminCategoriesController],
  providers: [CategoriesService, AdminCategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
