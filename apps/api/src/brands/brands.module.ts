import { Module } from "@nestjs/common";
import { BrandsService } from "./brands.service";
import { PublicBrandsController } from "./public-brands.controller";
import { AuthModule } from "../auth/auth.module";
import { AdminBrandsController } from "./admin-brands.controller";
import { AdminBrandsService } from "./admin-brands.service";

@Module({
  imports: [AuthModule],
  controllers: [PublicBrandsController, AdminBrandsController],
  providers: [BrandsService, AdminBrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
