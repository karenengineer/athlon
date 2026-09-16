import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const parseAdminBoolean = ({ value }: { value: unknown }): unknown =>
  value === "true" ? true : value === "false" ? false : value;

const parseInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;

export class AdminListQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @Transform(parseInteger) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) page =
    1;
  @Transform(parseInteger) @IsInt() @Min(1) @Max(100) pageSize = 24;
  @IsOptional() @Transform(parseAdminBoolean) @IsBoolean() published?: boolean;
  @IsIn(["order", "updated", "name"]) sort: string = "order";
}
