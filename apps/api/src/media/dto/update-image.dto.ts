import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateImageDto {
  @IsOptional() @IsBoolean() primary?: boolean;
  @IsOptional() @IsString() @MaxLength(250) altRu?: string;
  @IsOptional() @IsString() @MaxLength(250) altHy?: string;
  @IsOptional() @IsString() @MaxLength(250) altEn?: string;
}
