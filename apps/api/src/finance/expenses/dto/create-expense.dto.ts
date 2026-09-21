import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateExpenseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
  @IsUUID() categoryId!: string;
  @IsString() @MaxLength(500) @Matches(/\S/) description!: string;
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  amount!: string;
  @IsOptional() @IsString() @MaxLength(100) paymentMethod?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
}
