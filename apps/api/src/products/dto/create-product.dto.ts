import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ProductTranslationDto } from "./product-translation.dto";

export class CreateProductDto {
  @IsString()
  @MaxLength(100)
  sku!: string;

  @IsString()
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number | null;

  @IsIn(["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "ON_REQUEST"])
  availability!: "IN_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "ON_REQUEST";

  @IsObject()
  characteristics!: Record<string, unknown>;

  @IsBoolean()
  featured!: boolean;

  @IsBoolean()
  isNew!: boolean;

  @IsBoolean()
  published!: boolean;

  @IsInt()
  displayOrder!: number;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductTranslationDto)
  translations!: ProductTranslationDto[];
}
