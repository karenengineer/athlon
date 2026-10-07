import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class OrderCustomerDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/)
  name!: string;

  @Transform(trimString)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(7)
  @MaxLength(24)
  @Matches(/^(?=(?:\D*\d){7,15}$)[+()\d .-]+$/)
  phone!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  @Matches(/\S/)
  address!: string;
}

export class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(moneyPattern)
  expectedUnitPrice!: string | null;
}

export class CreateOrderDto {
  @IsIn(["hy", "ru", "en"])
  locale!: "hy" | "ru" | "en";

  @IsOptional()
  @IsIn(["CARD", "CASH_ON_DELIVERY"])
  paymentMethod?: "CARD" | "CASH_ON_DELIVERY";

  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer!: OrderCustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique((item: OrderItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
