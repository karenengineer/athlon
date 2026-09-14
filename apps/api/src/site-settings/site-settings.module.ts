import { Module } from "@nestjs/common";
import { PublicSettingsController } from "./public-settings.controller";
import { SiteSettingsService } from "./site-settings.service";
import { AuthModule } from "../auth/auth.module";
import { AdminSettingsController } from "./admin-settings.controller";

@Module({
  imports: [AuthModule],
  controllers: [PublicSettingsController, AdminSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
