import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { SalesChannel, Prisma } from "../../../generated/prisma/client";

const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

@ValidatorConstraint({ name: "lineDiscountWithinRevenue", async: false })
class LineDiscountWithinRevenue implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== "string" || !moneyPattern.test(value)) return true;
    const item = args.object as CreateSaleItemDto;
    if (
      !Number.isInteger(item.quantity) ||
      typeof item.actualUnitPrice !== "string" ||
      !moneyPattern.test(item.actualUnitPrice)
    )
      return true;
    return new Prisma.Decimal(value).lte(
      new Prisma.Decimal(item.actualUnitPrice).mul(item.quantity),
    );
  }

  defaultMessage(): string {
    return "lineDiscount must not exceed line revenue";
  }
}

export class CreateSaleItemDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(2_147_483_647) quantity!: number;
  @IsString() @Matches(moneyPattern) actualUnitPrice!: string;
  @IsOptional()
  @IsString()
  @Matches(moneyPattern)
  @Validate(LineDiscountWithinRevenue)
  lineDiscount?: string;
}

export class CreateSaleDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;
  @IsOptional() @IsString() @MaxLength(100) orderId?: string | null;
  @IsEnum(SalesChannel) channel!: SalesChannel;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trainerReferralCode?: string | null;
  @IsOptional() @IsString() @MaxLength(180) customerName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) customerPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateSaleItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
