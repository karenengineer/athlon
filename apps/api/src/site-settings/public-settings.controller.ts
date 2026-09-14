import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SiteSettingsService } from "./site-settings.service";

@ApiTags("settings")
@Controller("public/settings")
export class PublicSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  list(): Promise<Record<string, string>> {
    return this.settings.publicSettings();
  }
}
