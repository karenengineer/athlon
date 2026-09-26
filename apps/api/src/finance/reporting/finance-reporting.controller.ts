import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../../auth/admin-auth.guard";
import { FinanceReportingService } from "./finance-reporting.service";
import {
  FinanceProductQueryDto,
  MonthlySummaryQueryDto,
  normalizeReportRange,
  ProfitabilityQueryDto,
  ReportQueryDto,
} from "./report-query.dto";

@ApiTags("admin-finance-reporting")
@Controller("admin/finance")
@UseGuards(AdminAuthGuard)
export class FinanceReportingController {
  constructor(private readonly reporting: FinanceReportingService) {}

  @Get("dashboard") dashboard(@Query() query: ReportQueryDto) {
    return this.reporting.getDashboard({
      ...query,
      ...normalizeReportRange(query),
    });
  }
  @Get("products") products(@Query() query: FinanceProductQueryDto) {
    return this.reporting.getProducts({
      ...query,
      ...normalizeReportRange(query),
    });
  }
  @Get("monthly-summary") monthlySummary(
    @Query() query: MonthlySummaryQueryDto,
  ) {
    return this.reporting.getMonthlySummary(query.year, query.month, query);
  }
  @Get("profitability") profitability(@Query() query: ProfitabilityQueryDto) {
    return this.reporting.getProfitability({
      ...query,
      ...normalizeReportRange(query),
    });
  }
  @Get("expense-breakdown") expenseBreakdown(@Query() query: ReportQueryDto) {
    return this.reporting.getExpenseBreakdown({
      ...query,
      ...normalizeReportRange(query),
    });
  }
}
