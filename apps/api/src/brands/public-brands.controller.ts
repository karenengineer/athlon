import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BrandsService } from "./brands.service";

@ApiTags("brands")
@Controller("brands")
export class PublicBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list(@Query("locale") locale?: string): Promise<unknown[]> {
    return this.brands.listPublic(locale);
  }
}
