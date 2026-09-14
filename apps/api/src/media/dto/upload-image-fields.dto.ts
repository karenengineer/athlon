import {
  IsBooleanString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UploadImageFieldsDto {
  @IsString() @MinLength(1) @MaxLength(250) altRu!: string;
  @IsOptional() @IsString() @MaxLength(250) altHy?: string;
  @IsOptional() @IsString() @MaxLength(250) altEn?: string;
  @IsOptional() @IsBooleanString() primary?: string;
}
