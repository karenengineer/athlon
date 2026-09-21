import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adminListEnvelope, adminListOffset } from "../../common/admin-list";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ExpenseSource } from "../../generated/prisma/enums";
import { money } from "../domain/money";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ExpenseCategoryListQueryDto } from "./dto/expense-category-list-query.dto";
import { ExpenseListQueryDto } from "./dto/expense-list-query.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

const expenseInclude = {
  category: true,
  createdByAdmin: { select: { id: true, email: true } },
} as const;

const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const serializeExpense = <T extends { amount: Prisma.Decimal }>(
  expense: T,
) => ({
  ...expense,
  amount: expense.amount.toString(),
});

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(query: ExpenseCategoryListQueryDto): Promise<unknown> {
    const where: Prisma.ExpenseCategoryWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
    };
    const orderBy: Prisma.ExpenseCategoryOrderByWithRelationInput[] =
      query.sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : [{ name: "asc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.expenseCategory.count({ where }),
      this.prisma.expenseCategory.findMany({
        where,
        skip: adminListOffset(query),
        take: query.pageSize,
        orderBy,
      }),
    ]);
    return adminListEnvelope(items, total, query);
  }

  async createCategory(input: CreateExpenseCategoryDto): Promise<unknown> {
    try {
      return await this.prisma.expenseCategory.create({
        data: { name: input.name.trim(), active: input.active },
      });
    } catch (error) {
      rethrowExpenseWriteConflict(error);
    }
  }

  async updateCategory(
    id: string,
    input: UpdateExpenseCategoryDto,
  ): Promise<unknown> {
    await this.ensureCategoryExists(id);
    try {
      return await this.prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
    } catch (error) {
      rethrowExpenseWriteConflict(error);
    }
  }

  async list(query: ExpenseListQueryDto): Promise<unknown> {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)
      throw new BadRequestException("dateFrom must be on or before dateTo");
    const where: Prisma.ExpenseWhereInput = {
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: parseDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: parseDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.q
        ? {
            OR: ["description", "paymentMethod", "notes"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const amountSort =
      query.sort === "amountAsc" || query.sort === "amountDesc";
    const direction =
      query.sort === "dateAsc" || query.sort === "amountAsc" ? "asc" : "desc";
    const orderBy: Prisma.ExpenseOrderByWithRelationInput[] = amountSort
      ? [{ amount: direction }, { date: "desc" }, { id: "asc" }]
      : [{ date: direction }, { createdAt: direction }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        skip: adminListOffset(query),
        take: query.pageSize,
        orderBy,
        include: expenseInclude,
      }),
    ]);
    return adminListEnvelope(items.map(serializeExpense), total, query);
  }

  async get(id: string): Promise<unknown> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!expense) throw new NotFoundException("Expense not found");
    return serializeExpense(expense);
  }

  async create(input: CreateExpenseDto, adminId: string): Promise<unknown> {
    await this.ensureActiveCategory(input.categoryId);
    try {
      const expense = await this.prisma.expense.create({
        data: {
          date: parseDate(input.date),
          categoryId: input.categoryId,
          description: input.description.trim(),
          amount: money(input.amount),
          paymentMethod: input.paymentMethod?.trim() || null,
          notes: input.notes?.trim() || null,
          source: ExpenseSource.ONE_TIME,
          createdByAdminId: adminId,
        },
        include: expenseInclude,
      });
      return serializeExpense(expense);
    } catch (error) {
      rethrowExpenseWriteConflict(error);
    }
  }

  async update(id: string, input: UpdateExpenseDto): Promise<unknown> {
    const current = await this.editableExpense(id);
    if (input.categoryId !== undefined)
      await this.ensureActiveCategory(input.categoryId);
    try {
      const expense = await this.prisma.expense.update({
        where: { id: current.id },
        data: {
          ...(input.date !== undefined ? { date: parseDate(input.date) } : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description.trim() }
            : {}),
          ...(input.amount !== undefined
            ? { amount: money(input.amount) }
            : {}),
          ...(input.paymentMethod !== undefined
            ? { paymentMethod: input.paymentMethod?.trim() || null }
            : {}),
          ...(input.notes !== undefined
            ? { notes: input.notes?.trim() || null }
            : {}),
        },
        include: expenseInclude,
      });
      return serializeExpense(expense);
    } catch (error) {
      rethrowExpenseWriteConflict(error);
    }
  }

  async delete(id: string): Promise<void> {
    const current = await this.editableExpense(id);
    try {
      await this.prisma.expense.delete({ where: { id: current.id } });
    } catch (error) {
      rethrowExpenseWriteConflict(error);
    }
  }

  private async editableExpense(
    id: string,
  ): Promise<{ id: string; source: ExpenseSource }> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      select: { id: true, source: true },
    });
    if (!expense) throw new NotFoundException("Expense not found");
    if (expense.source === ExpenseSource.RECURRING_OCCURRENCE)
      throw new ConflictException(
        "Recurring occurrences require an explicit correction workflow",
      );
    return expense;
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

  private async ensureCategoryExists(id: string): Promise<void> {
    if (
      !(await this.prisma.expenseCategory.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Expense category not found");
  }
}

function rethrowExpenseWriteConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException(
      "An expense category with this name already exists",
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["P2003", "P2034"].includes(String(error.code))
  )
    throw new ConflictException(
      "Expense dependencies or a concurrent change prevent this operation",
    );
  throw error;
}
