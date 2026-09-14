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
import { AdminBrandsService } from "./admin-brands.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@ApiTags("admin-brands")
@Controller("admin/brands")
@UseGuards(AdminAuthGuard)
export class AdminBrandsController {
  constructor(private readonly brands: AdminBrandsService) {}
  @Get() list(): Promise<unknown[]> {
    return this.brands.list();
  }
  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateBrandDto,
  ): Promise<unknown> {
    return this.brands.create(input);
  }
  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateBrandDto,
  ): Promise<unknown> {
    return this.brands.update(id, input);
  }
  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.brands.delete(id);
  }
}
