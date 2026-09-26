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
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ExpenseCategoryListQueryDto } from "./dto/expense-category-list-query.dto";
import { ExpenseListQueryDto } from "./dto/expense-list-query.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

type AdminRequest = Request & { user: AdminPrincipal };

@ApiTags("admin-finance-expense-categories")
@Controller("admin/finance/expense-categories")
@UseGuards(AdminAuthGuard)
export class ExpenseCategoriesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get() list(@Query() query: ExpenseCategoryListQueryDto): Promise<unknown> {
    return this.expenses.listCategories(query);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateExpenseCategoryDto,
  ): Promise<unknown> {
    return this.expenses.createCategory(input);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateExpenseCategoryDto,
  ): Promise<unknown> {
    return this.expenses.updateCategory(id, input);
  }
}

@ApiTags("admin-finance-expenses")
@Controller("admin/finance/expenses")
@UseGuards(AdminAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get() list(@Query() query: ExpenseListQueryDto): Promise<unknown> {
    return this.expenses.list(query);
  }

  @Get(":id") get(@Param("id") id: string): Promise<unknown> {
    return this.expenses.get(id);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateExpenseDto,
    @Req() request: AdminRequest,
  ): Promise<unknown> {
    return this.expenses.create(input, request.user.sub);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateExpenseDto,
  ): Promise<unknown> {
    return this.expenses.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.expenses.delete(id);
  }
}
