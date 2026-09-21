import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateSupplierDto {
  @IsString() @MaxLength(180) @Matches(/\S/) name!: string;
  @IsOptional() @IsString() @MaxLength(180) contactName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsBoolean() active = true;
}
