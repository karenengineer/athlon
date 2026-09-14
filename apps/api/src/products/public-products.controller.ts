import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProductQueryDto } from "./dto/product-query.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ProductQueryDto): Promise<unknown> {
    return this.products.listPublic(query);
  }

  @Get("featured")
  featured(@Query("locale") locale?: string): Promise<unknown[]> {
    return this.products.listFeatured(locale);
  }

  @Get("new")
  newProducts(@Query("locale") locale?: string): Promise<unknown[]> {
    return this.products.listNew(locale);
  }

  @Get("search-suggestions")
  suggestions(
    @Query("q") q = "",
    @Query("locale") locale?: string,
  ): Promise<unknown[]> {
    return this.products.suggestions(q, locale);
  }

  @Get(":slug")
  detail(
    @Param("slug") slug: string,
    @Query("locale") locale?: string,
  ): Promise<unknown> {
    return this.products.detail(slug, locale);
  }
}
