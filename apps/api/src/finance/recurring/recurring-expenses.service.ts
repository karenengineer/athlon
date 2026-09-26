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
type RecurringWithCategory = Prisma.RecurringExpenseGetPayload<{
  include: typeof recurringInclude;
}>;
const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const formatDateOnly = (value: Date): string =>
  value.toISOString().slice(0, 10);
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
      ...(query.paymentMethod
        ? {
            paymentMethod: {
              contains: query.paymentMethod,
              mode: "insensitive",
            },
          }
        : {}),
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
    try {
      const template = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.recurringExpense.findUnique({
            where: { id },
            include: recurringInclude,
          });
          if (!current)
            throw new NotFoundException("Recurring expense not found");
          const now = new Date();
          const reactivating =
            current.active === false && input.active === true;
          const reactivationStartDate = reactivating
            ? formatDateOnly(
                monthlyOccurrenceDate(
                  current.startDate,
                  now.getUTCFullYear(),
                  now.getUTCMonth() + 1,
                ),
              )
            : undefined;
          const startDate =
            input.startDate ??
            reactivationStartDate ??
            formatDateOnly(current.startDate);
          const endDate =
            input.endDate === undefined
              ? current.endDate?.toISOString().slice(0, 10)
              : input.endDate;
          this.ensureDateRange(startDate, endDate);
          if (input.categoryId !== undefined)
            await this.ensureActiveCategory(input.categoryId, tx);

          if (current.active)
            await this.materializeCompletedPeriods(tx, current, now);

          return tx.recurringExpense.update({
            where: { id },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.categoryId !== undefined
                ? { categoryId: input.categoryId }
                : {}),
              ...(input.amount !== undefined
                ? { amount: money(input.amount) }
                : {}),
              ...(input.startDate !== undefined || reactivationStartDate
                ? { startDate: parseDate(startDate) }
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return serializeRecurring(template);
    } catch (error) {
      rethrowRecurringConflict(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const deleted = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.recurringExpense.findUnique({
            where: { id },
            include: recurringInclude,
          });
          if (!current)
            throw new NotFoundException("Recurring expense not found");
          if (current.active)
            await this.materializeCompletedPeriods(tx, current, new Date());
          if (
            await tx.recurringExpenseOccurrence.count({
              where: { recurringExpenseId: id },
            })
          )
            return false;
          await tx.recurringExpense.delete({ where: { id } });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (!deleted)
        throw new ConflictException(
          "Recurring expense has historical occurrences; deactivate it instead",
        );
    } catch (error) {
      rethrowRecurringConflict(error);
    }
  }

  async materializePeriod(
    tx: Prisma.TransactionClient,
    year: number,
    month: number,
    dueThrough?: Date,
  ): Promise<number> {
    if (!Number.isInteger(year) || year < 1 || year > 9999)
      throw new BadRequestException("year must be an integer from 1 to 9999");
    if (!Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException("month must be an integer from 1 to 12");

    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    if (dueThrough && periodStart > dueThrough) return 0;
    const templates = await tx.recurringExpense.findMany({
      where: {
        active: true,
        startDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      },
      include: { category: true },
      orderBy: [{ id: "asc" }],
    });
    const dueTemplates = dueThrough
      ? templates.filter(
          (template) =>
            monthlyOccurrenceDate(template.startDate, year, month) <=
            dueThrough,
        )
      : templates;
    if (!dueTemplates.length) return 0;

    const adminId = await this.materializationAdminId(tx);

    let created = 0;
    for (const template of dueTemplates) {
      created += await this.materializeTemplatePeriod(
        tx,
        template,
        year,
        month,
        adminId,
      );
    }
    return created;
  }

  private async materializeCompletedPeriods(
    tx: Prisma.TransactionClient,
    template: RecurringWithCategory,
    now: Date,
  ): Promise<number> {
    const currentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    let period = new Date(
      Date.UTC(
        template.startDate.getUTCFullYear(),
        template.startDate.getUTCMonth(),
        1,
      ),
    );
    if (period >= currentMonth) return 0;

    const adminId = await this.materializationAdminId(tx);
    let created = 0;
    while (period < currentMonth) {
      created += await this.materializeTemplatePeriod(
        tx,
        template,
        period.getUTCFullYear(),
        period.getUTCMonth() + 1,
        adminId,
      );
      period = new Date(
        Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1),
      );
    }
    return created;
  }

  private async materializeTemplatePeriod(
    tx: Prisma.TransactionClient,
    template: RecurringWithCategory,
    year: number,
    month: number,
    adminId: string,
  ): Promise<number> {
    const occurrenceDate = monthlyOccurrenceDate(
      template.startDate,
      year,
      month,
    );
    if (
      occurrenceDate < template.startDate ||
      (template.endDate && occurrenceDate > template.endDate)
    )
      return 0;
    const occurrenceKey = {
      recurringExpenseId: template.id,
      periodYear: year,
      periodMonth: month,
    };
    if (
      await tx.recurringExpenseOccurrence.findUnique({
        where: { recurringExpenseId_periodYear_periodMonth: occurrenceKey },
        select: { id: true },
      })
    )
      return 0;

    const expense = await tx.expense.create({
      data: {
        date: occurrenceDate,
        categoryId: template.categoryId,
        description: template.name,
        amount: template.amount,
        paymentMethod: template.paymentMethod,
        notes: template.notes,
        source: ExpenseSource.RECURRING_OCCURRENCE,
        createdByAdminId: adminId,
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
    return 1;
  }

  private async materializationAdminId(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const admin = await tx.adminUser.findFirst({
      where: { active: true },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!admin)
      throw new ConflictException(
        "An active admin user is required to materialize recurring expenses",
      );
    return admin.id;
  }

  private ensureDateRange(startDate: string, endDate?: string | null): void {
    if (endDate && endDate < startDate)
      throw new BadRequestException("endDate must be on or after startDate");
  }

  private async ensureActiveCategory(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const category = await (tx ?? this.prisma).expenseCategory.findUnique({
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
  const adapterConflict =
    error instanceof Error &&
    error.name === "DriverAdapterError" &&
    error.cause !== null &&
    typeof error.cause === "object" &&
    "kind" in error.cause &&
    error.cause.kind === "TransactionWriteConflict" &&
    "originalCode" in error.cause &&
    ["40001", "40P01"].includes(String(error.cause.originalCode));
  if (
    adapterConflict ||
    (error &&
      typeof error === "object" &&
      "code" in error &&
      ["P2002", "P2003", "P2034"].includes(String(error.code)))
  )
    throw new ConflictException(
      "Recurring expense dependencies or a concurrent change prevent this operation",
    );
  throw error;
}
