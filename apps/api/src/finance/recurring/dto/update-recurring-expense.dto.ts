import { PartialType } from "@nestjs/swagger";
import { CreateRecurringExpenseDto } from "./create-recurring-expense.dto";

export class UpdateRecurringExpenseDto extends PartialType(
  CreateRecurringExpenseDto,
  { skipNullProperties: false },
) {
  override active?: boolean = undefined;
}
