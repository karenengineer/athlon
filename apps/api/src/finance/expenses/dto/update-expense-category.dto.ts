import { PartialType } from "@nestjs/swagger";
import { CreateExpenseCategoryDto } from "./create-expense-category.dto";

export class UpdateExpenseCategoryDto extends PartialType(
  CreateExpenseCategoryDto,
  { skipNullProperties: false },
) {
  override active?: boolean = undefined;
}
