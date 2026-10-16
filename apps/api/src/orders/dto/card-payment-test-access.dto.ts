import { IsString, MaxLength, MinLength } from "class-validator";

export class CardPaymentTestAccessDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  accessToken!: string;
}
