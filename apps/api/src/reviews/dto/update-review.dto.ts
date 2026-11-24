import { IsIn } from "class-validator";

export class UpdateReviewDto {
  @IsIn(["PENDING", "APPROVED", "REJECTED"]) status!:
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
}
