import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";

@ApiTags("categories")
@Controller("categories")
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiQuery({ name: "locale", required: false, enum: ["hy", "ru", "en"] })
  list(@Query("locale") locale?: string): Promise<unknown[]> {
    return this.categories.listPublic(locale);
  }
}
