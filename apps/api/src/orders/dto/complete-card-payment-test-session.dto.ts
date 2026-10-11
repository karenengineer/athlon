import { IsIn } from "class-validator";

export class CompleteCardPaymentTestSessionDto {
  @IsIn(["SUCCESS", "DECLINED", "CANCELLED", "TIMEOUT"])
  outcome!: "SUCCESS" | "DECLINED" | "CANCELLED" | "TIMEOUT";
}
