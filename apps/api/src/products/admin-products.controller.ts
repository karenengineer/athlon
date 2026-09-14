import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { AdminProductsService } from "./admin-products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@ApiTags("admin-products")
@Controller("admin/products")
@UseGuards(AdminAuthGuard)
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<unknown> {
    return this.products.list(Number(page ?? 1), Number(pageSize ?? 24));
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<unknown> {
    return this.products.get(id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Body() input: CreateProductDto): Promise<unknown> {
    return this.products.create(input);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  update(
    @Param("id") id: string,
    @Body() input: UpdateProductDto,
  ): Promise<unknown> {
    return this.products.update(id, input);
  }

  @Post(":id/publish")
  @UseGuards(CsrfGuard)
  publish(@Param("id") id: string): Promise<unknown> {
    return this.products.setPublished(id, true);
  }

  @Post(":id/unpublish")
  @UseGuards(CsrfGuard)
  unpublish(@Param("id") id: string): Promise<unknown> {
    return this.products.setPublished(id, false);
  }

  @Delete(":id")
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  delete(@Param("id") id: string): Promise<void> {
    return this.products.delete(id);
  }
}
