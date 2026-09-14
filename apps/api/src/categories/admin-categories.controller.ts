import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { AdminCategoriesService } from "./admin-categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("admin-categories")
@Controller("admin/categories")
@UseGuards(AdminAuthGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}
  @Get() list(): Promise<unknown[]> {
    return this.categories.list();
  }
  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateCategoryDto,
  ): Promise<unknown> {
    return this.categories.create(input);
  }
  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateCategoryDto,
  ): Promise<unknown> {
    return this.categories.update(id, input);
  }
  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.categories.delete(id);
  }
}
