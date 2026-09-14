import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SiteSettingsService } from "./site-settings.service";

@ApiTags("admin-settings")
@Controller("admin/settings")
@UseGuards(AdminAuthGuard)
export class AdminSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}
  @Get() list(): Promise<Record<string, string | null>> {
    return this.settings.adminSettings();
  }
  @Patch() @UseGuards(CsrfGuard) update(
    @Body() input: UpdateSettingsDto,
  ): Promise<Record<string, string | null>> {
    return this.settings.update(input.settings);
  }
}
