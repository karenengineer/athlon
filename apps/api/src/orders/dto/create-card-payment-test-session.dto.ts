import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class CardPaymentTestItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  expectedUnitPrice!: string | null;
}

export class CreateCardPaymentTestSessionDto {
  @IsIn(["hy", "ru", "en"])
  locale!: "hy" | "ru" | "en";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CardPaymentTestItemDto)
  items!: CardPaymentTestItemDto[];
}
