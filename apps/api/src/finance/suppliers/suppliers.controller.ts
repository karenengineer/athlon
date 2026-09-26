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
import { AdminAuthGuard } from "../../auth/admin-auth.guard";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierListQueryDto } from "./dto/supplier-list-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("admin-finance-suppliers")
@Controller("admin/finance/suppliers")
@UseGuards(AdminAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get() list(@Query() query: SupplierListQueryDto): Promise<unknown> {
    return this.suppliers.list(query);
  }

  @Get(":id") get(@Param("id") id: string): Promise<unknown> {
    return this.suppliers.get(id);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateSupplierDto,
  ): Promise<unknown> {
    return this.suppliers.create(input);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateSupplierDto,
  ): Promise<unknown> {
    return this.suppliers.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.suppliers.delete(id);
  }
}
