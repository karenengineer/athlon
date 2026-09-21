import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class CreateRecurringExpenseDto {
  @IsString() @MaxLength(180) @Matches(/\S/) name!: string;
  @IsUUID() categoryId!: string;
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  amount!: string;
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate?: string | null;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active = true;
  @IsOptional() @IsString() @MaxLength(100) paymentMethod?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
}
