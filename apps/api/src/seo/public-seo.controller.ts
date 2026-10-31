import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SeoService, SitemapInventory } from "./seo.service";

@ApiTags("seo")
@Controller("public/seo")
export class PublicSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get("sitemap")
  sitemap(): Promise<SitemapInventory> {
    return this.seo.sitemapInventory();
  }
}
