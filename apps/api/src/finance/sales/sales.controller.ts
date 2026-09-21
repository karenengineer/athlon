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
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AdminAuthGuard, AdminPrincipal } from "../../auth/admin-auth.guard";
import { CsrfGuard } from "../../auth/csrf.guard";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleListQueryDto } from "./dto/sale-list-query.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { SalesService } from "./sales.service";

type AdminRequest = Request & { user: AdminPrincipal };

@ApiTags("admin-finance-sales")
@Controller("admin/finance/sales")
@UseGuards(AdminAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get() list(@Query() query: SaleListQueryDto): Promise<unknown> {
    return this.sales.list(query);
  }

  @Get(":id") get(@Param("id") id: string): Promise<unknown> {
    return this.sales.get(id);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateSaleDto,
    @Req() request: AdminRequest,
  ): Promise<unknown> {
    return this.sales.create(input, request.user.sub);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateSaleDto,
  ): Promise<unknown> {
    return this.sales.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.sales.delete(id);
  }
}
