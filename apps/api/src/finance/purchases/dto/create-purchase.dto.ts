import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreatePurchaseItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(2_147_483_647) quantity!: number;
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  purchaseUnitPrice!: string;
}

export class CreatePurchaseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
  @IsUUID() supplierId!: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @ArrayMinSize(1)
  @ArrayUnique((item: CreatePurchaseItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
