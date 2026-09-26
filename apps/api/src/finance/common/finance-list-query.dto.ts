import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const parseFinanceInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;

export class FinanceListQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @Transform(parseFinanceInteger)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;
  @Transform(parseFinanceInteger) @IsInt() @Min(1) @Max(100) pageSize = 24;
}
