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
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { PurchaseListQueryDto } from "./dto/purchase-list-query.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { PurchasesService } from "./purchases.service";

type AdminRequest = Request & { user: AdminPrincipal };

@ApiTags("admin-finance-purchases")
@Controller("admin/finance/purchases")
@UseGuards(AdminAuthGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get() list(@Query() query: PurchaseListQueryDto): Promise<unknown> {
    return this.purchases.list(query);
  }

  @Get(":id") get(@Param("id") id: string): Promise<unknown> {
    return this.purchases.get(id);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreatePurchaseDto,
    @Req() request: AdminRequest,
  ): Promise<unknown> {
    return this.purchases.create(input, request.user.sub);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdatePurchaseDto,
  ): Promise<unknown> {
    return this.purchases.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.purchases.delete(id);
  }
}
