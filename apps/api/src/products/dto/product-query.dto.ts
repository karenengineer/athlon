import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  brand?: string;

  @IsOptional()
  @IsIn(["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "ON_REQUEST"])
  availability?: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "ON_REQUEST";

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(["displayOrder", "priceAsc", "priceDesc", "newest"])
  sort: "displayOrder" | "priceAsc" | "priceDesc" | "newest" = "displayOrder";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Math.min(Number(value), 48))
  @IsInt()
  @Min(1)
  pageSize = 24;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
