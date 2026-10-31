import { Module } from "@nestjs/common";
import { PublicSeoController } from "./public-seo.controller";
import { SeoService } from "./seo.service";

@Module({
  controllers: [PublicSeoController],
  providers: [SeoService],
})
export class SeoModule {}
