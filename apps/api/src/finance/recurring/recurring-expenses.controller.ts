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
import { CreateRecurringExpenseDto } from "./dto/create-recurring-expense.dto";
import { RecurringExpenseListQueryDto } from "./dto/recurring-expense-list-query.dto";
import { UpdateRecurringExpenseDto } from "./dto/update-recurring-expense.dto";
import { RecurringExpensesService } from "./recurring-expenses.service";

@ApiTags("admin-finance-recurring-expenses")
@Controller("admin/finance/recurring-expenses")
@UseGuards(AdminAuthGuard)
export class RecurringExpensesController {
  constructor(private readonly recurring: RecurringExpensesService) {}

  @Get() list(@Query() query: RecurringExpenseListQueryDto): Promise<unknown> {
    return this.recurring.list(query);
  }

  @Get(":id") get(@Param("id") id: string): Promise<unknown> {
    return this.recurring.get(id);
  }

  @Post() @UseGuards(CsrfGuard) create(
    @Body() input: CreateRecurringExpenseDto,
  ): Promise<unknown> {
    return this.recurring.create(input);
  }

  @Patch(":id") @UseGuards(CsrfGuard) update(
    @Param("id") id: string,
    @Body() input: UpdateRecurringExpenseDto,
  ): Promise<unknown> {
    return this.recurring.update(id, input);
  }

  @Delete(":id") @HttpCode(204) @UseGuards(CsrfGuard) delete(
    @Param("id") id: string,
  ): Promise<void> {
    return this.recurring.delete(id);
  }
}
