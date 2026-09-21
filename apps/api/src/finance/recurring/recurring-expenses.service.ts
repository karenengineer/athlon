import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adminListEnvelope, adminListOffset } from "../../common/admin-list";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ExpenseSource, Recurrence } from "../../generated/prisma/enums";
import { money } from "../domain/money";
import { CreateRecurringExpenseDto } from "./dto/create-recurring-expense.dto";
import { RecurringExpenseListQueryDto } from "./dto/recurring-expense-list-query.dto";
import { UpdateRecurringExpenseDto } from "./dto/update-recurring-expense.dto";

const recurringInclude = { category: true } as const;
const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const serializeRecurring = <T extends { amount: Prisma.Decimal }>(
  template: T,
) => ({
  ...template,
  amount: template.amount.toString(),
});

@Injectable()
export class RecurringExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: RecurringExpenseListQueryDto): Promise<unknown> {
    const where: Prisma.RecurringExpenseWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
    };
    const orderBy: Prisma.RecurringExpenseOrderByWithRelationInput[] =
      query.sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : query.sort === "startDesc"
          ? [{ startDate: "desc" }, { id: "asc" }]
          : [{ name: "asc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.recurringExpense.count({ where }),
      this.prisma.recurringExpense.findMany({
        where,
        skip: adminListOffset(query),
        take: query.pageSize,
        orderBy,
        include: recurringInclude,
      }),
    ]);
    return adminListEnvelope(items.map(serializeRecurring), total, query);
  }

  async get(id: string): Promise<unknown> {
    const template = await this.prisma.recurringExpense.findUnique({
      where: { id },
      include: recurringInclude,
    });
    if (!template) throw new NotFoundException("Recurring expense not found");
    return serializeRecurring(template);
  }

  async create(input: CreateRecurringExpenseDto): Promise<unknown> {
    this.ensureDateRange(input.startDate, input.endDate);
    await this.ensureActiveCategory(input.categoryId);
    try {
      const template = await this.prisma.recurringExpense.create({
        data: {
          name: input.name.trim(),
          categoryId: input.categoryId,
          amount: money(input.amount),
          recurrence: Recurrence.MONTHLY,
          startDate: parseDate(input.startDate),
          endDate: input.endDate ? parseDate(input.endDate) : null,
          active: input.active,
          paymentMethod: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
        },
        include: recurringInclude,
      });
      return serializeRecurring(template);
    } catch (error) {
      rethrowRecurringConflict(error);
    }
  }

  async update(id: string, input: UpdateRecurringExpenseDto): Promise<unknown> {
    const current = await this.prisma.recurringExpense.findUnique({
      where: { id },
      include: recurringInclude,
    });
    if (!current) throw new NotFoundException("Recurring expense not found");
    const startDate =
      input.startDate ?? current.startDate.toISOString().slice(0, 10);
    const endDate =
      input.endDate === undefined
        ? current.endDate?.toISOString().slice(0, 10)
        : input.endDate;
    this.ensureDateRange(startDate, endDate);
    if (input.categoryId !== undefined)
      await this.ensureActiveCategory(input.categoryId);
    try {
      const template = await this.prisma.recurringExpense.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.amount !== undefined
            ? { amount: money(input.amount) }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: parseDate(input.startDate) }
            : {}),
          ...(input.endDate !== undefined
            ? { endDate: input.endDate ? parseDate(input.endDate) : null }
            : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.paymentMethod !== undefined
            ? { paymentMethod: input.paymentMethod?.trim() || null }
            : {}),
          ...(input.notes !== undefined
            ? { notes: input.notes?.trim() || null }
            : {}),
        },
        include: recurringInclude,
      });
      return serializeRecurring(template);
    } catch (error) {
      rethrowRecurringConflict(error);
    }
  }

  async delete(id: string): Promise<void> {
    if (
      !(await this.prisma.recurringExpense.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Recurring expense not found");
    if (
      await this.prisma.recurringExpenseOccurrence.count({
        where: { recurringExpenseId: id },
      })
    )
      throw new ConflictException(
        "Recurring expense has historical occurrences; deactivate it instead",
      );
    try {
      await this.prisma.recurringExpense.delete({ where: { id } });
    } catch (error) {
      rethrowRecurringConflict(error);
    }
  }

  async materializePeriod(
    tx: Prisma.TransactionClient,
    year: number,
    month: number,
  ): Promise<number> {
    if (!Number.isInteger(year) || year < 1 || year > 9999)
      throw new BadRequestException("year must be an integer from 1 to 9999");
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException("month must be an integer from 1 to 12");

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    const templates = await tx.recurringExpense.findMany({
      where: {
        active: true,
        startDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      },
      include: { category: true },
      orderBy: [{ id: "asc" }],
    });
    if (!templates.length) return 0;

    const admin = await tx.adminUser.findFirst({
      where: { active: true },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!admin)
      throw new ConflictException(
        "An active admin user is required to materialize recurring expenses",
      );

    let created = 0;
    for (const template of templates) {
      const occurrenceDate = monthlyOccurrenceDate(
        template.startDate,
        year,
        month,
      );
      if (
        occurrenceDate < template.startDate ||
        (template.endDate && occurrenceDate > template.endDate)
      )
        continue;
      const occurrenceKey = {
        recurringExpenseId: template.id,
        periodYear: year,
        periodMonth: month,
      };
      if (
        await tx.recurringExpenseOccurrence.findUnique({
          where: {
            recurringExpenseId_periodYear_periodMonth: occurrenceKey,
          },
          select: { id: true },
        })
      )
        continue;

      const expense = await tx.expense.create({
        data: {
          date: occurrenceDate,
          categoryId: template.categoryId,
          description: template.name,
          amount: template.amount,
          paymentMethod: template.paymentMethod,
          notes: template.notes,
          source: ExpenseSource.RECURRING_OCCURRENCE,
          createdByAdminId: admin.id,
        },
        select: { id: true },
      });
      await tx.recurringExpenseOccurrence.create({
        data: {
          ...occurrenceKey,
          expenseId: expense.id,
          nameSnapshot: template.name,
          categoryNameSnapshot: template.category.name,
          amountSnapshot: template.amount,
          paymentMethodSnapshot: template.paymentMethod,
        },
      });
      created += 1;
    }
    return created;
  }

  private ensureDateRange(startDate: string, endDate?: string | null): void {
    if (endDate && endDate < startDate)
      throw new BadRequestException("endDate must be on or after startDate");
  }

  private async ensureActiveCategory(id: string): Promise<void> {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!category) throw new NotFoundException("Expense category not found");
    if (!category.active)
      throw new BadRequestException("Expense category is inactive");
  }
}

function monthlyOccurrenceDate(
  startDate: Date,
  year: number,
  month: number,
): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month - 1, Math.min(startDate.getUTCDate(), lastDay)),
  );
}

function rethrowRecurringConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["P2002", "P2003", "P2034"].includes(String(error.code))
  )
    throw new ConflictException(
      "Recurring expense dependencies or a concurrent change prevent this operation",
    );
  throw error;
}
