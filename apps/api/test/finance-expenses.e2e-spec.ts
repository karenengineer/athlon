import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { RecurringExpensesService } from "../src/finance/recurring/recurring-expenses.service";

const adminId = "55c20c13-3b51-44fb-a6ff-33fe765d29bb";
const categoryId = "65c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherCategoryId = "75c20c13-3b51-44fb-a6ff-33fe765d29bb";
const generatedExpenseId = "85c20c13-3b51-44fb-a6ff-33fe765d29bb";
const csrf = "known-csrf-token";

type Row = Record<string, unknown>;
type ExpenseCategoryRow = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type ExpenseRow = {
  id: string;
  date: Date;
  categoryId: string;
  description: string;
  amount: Prisma.Decimal;
  paymentMethod: string | null;
  notes: string | null;
  source: "ONE_TIME" | "RECURRING_OCCURRENCE";
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
};
type RecurringExpenseRow = {
  id: string;
  name: string;
  categoryId: string;
  amount: Prisma.Decimal;
  recurrence: "MONTHLY";
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type RecurringExpenseOccurrenceRow = {
  id: string;
  recurringExpenseId: string;
  periodYear: number;
  periodMonth: number;
  expenseId: string;
  nameSnapshot: string;
  categoryNameSnapshot: string;
  amountSnapshot: Prisma.Decimal;
  paymentMethodSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const sortRows = (rows: Row[], orderBy?: Row[]): Row[] => {
  if (!orderBy) return rows;
  return [...rows].sort((left, right) => {
    for (const ordering of orderBy) {
      const [field, direction] = Object.entries(ordering)[0] as [
        string,
        "asc" | "desc",
      ];
      const l = left[field] as string | number | Date;
      const r = right[field] as string | number | Date;
      if (l < r) return direction === "asc" ? -1 : 1;
      if (l > r) return direction === "asc" ? 1 : -1;
    }
    return 0;
  });
};

function makePrismaMock() {
  const now = new Date("2026-09-01T10:00:00.000Z");
  const categories: ExpenseCategoryRow[] = [
    {
      id: categoryId,
      name: "Rent",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: otherCategoryId,
      name: "Advertising",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const expenses: ExpenseRow[] = [
    {
      id: generatedExpenseId,
      date: new Date("2026-09-05T00:00:00.000Z"),
      categoryId,
      description: "Monthly rent",
      amount: new Prisma.Decimal("120000"),
      paymentMethod: "Bank transfer",
      notes: null,
      source: "RECURRING_OCCURRENCE",
      createdByAdminId: adminId,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const recurringExpenses: RecurringExpenseRow[] = [];
  const occurrences: RecurringExpenseOccurrenceRow[] = [];
  let transactionTail = Promise.resolve();
  let activeTransactions = 0;
  let recurringReadBarrier:
    | {
        templateId: string;
        reads: number;
        release: () => void;
        ready: Promise<void>;
      }
    | undefined;

  const categoryFor = (id: string) =>
    categories.find((category) => category.id === id);
  const hydrateExpense = (expense: ExpenseRow) => ({
    ...expense,
    category: categoryFor(expense.categoryId),
    createdByAdmin: { id: adminId, email: "admin@athlon.test" },
  });
  const hydrateRecurring = (template: RecurringExpenseRow) => ({
    ...template,
    category: categoryFor(template.categoryId),
  });
  const matchesExpense = (expense: ExpenseRow, where: Row = {}) => {
    const date = where.date as { gte?: Date; lte?: Date } | undefined;
    if (date?.gte && expense.date < date.gte) return false;
    if (date?.lte && expense.date > date.lte) return false;
    if (where.categoryId && expense.categoryId !== where.categoryId)
      return false;
    if (where.source && expense.source !== where.source) return false;
    const query = String(
      (
        where.OR as Array<{ description?: { contains?: string } }> | undefined
      )?.[0]?.description?.contains ?? "",
    ).toLowerCase();
    if (
      query &&
      !expense.description.toLowerCase().includes(query) &&
      !expense.paymentMethod?.toLowerCase().includes(query) &&
      !expense.notes?.toLowerCase().includes(query)
    )
      return false;
    return true;
  };

  const transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => {
    const result = transactionTail.then(async () => {
      activeTransactions += 1;
      try {
        return await callback(prisma);
      } finally {
        activeTransactions -= 1;
      }
    });
    transactionTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  });
  const prisma: Row = {
    $transaction: transaction,
    adminUser: {
      findFirst: jest.fn(() =>
        Promise.resolve({ id: adminId, email: "admin@athlon.test" }),
      ),
    },
    expenseCategory: {
      count: jest.fn(({ where = {} }: { where?: Row } = {}) =>
        Promise.resolve(
          categories.filter(
            (category) =>
              (where.active === undefined ||
                category.active === where.active) &&
              (!where.name ||
                category.name
                  .toLowerCase()
                  .includes(
                    String(
                      (where.name as { contains?: string }).contains,
                    ).toLowerCase(),
                  )),
          ).length,
        ),
      ),
      findMany: jest.fn(
        ({
          where = {},
          skip = 0,
          take,
          orderBy,
        }: {
          where?: Row;
          skip?: number;
          take?: number;
          orderBy?: Row[];
        } = {}) => {
          const rows = categories.filter(
            (category) =>
              (where.active === undefined ||
                category.active === where.active) &&
              (!where.name ||
                category.name
                  .toLowerCase()
                  .includes(
                    String(
                      (where.name as { contains?: string }).contains,
                    ).toLowerCase(),
                  )),
          );
          return Promise.resolve(
            sortRows(rows as unknown as Row[], orderBy).slice(
              skip,
              take ? skip + take : undefined,
            ),
          );
        },
      ),
      findUnique: jest.fn(
        ({ where: { id, name } }: { where: { id?: string; name?: string } }) =>
          Promise.resolve(
            categories.find(
              (category) => category.id === id || category.name === name,
            ) ?? null,
          ),
      ),
      create: jest.fn(({ data }: { data: Partial<ExpenseCategoryRow> }) => {
        if (categories.some((category) => category.name === data.name))
          return Promise.reject(
            Object.assign(new Error("Unique category name"), { code: "P2002" }),
          );
        const category: ExpenseCategoryRow = {
          id: randomUUID(),
          name: data.name!,
          active: data.active ?? true,
          createdAt: now,
          updatedAt: now,
        };
        categories.push(category);
        return Promise.resolve(category);
      }),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: Partial<ExpenseCategoryRow>;
        }) => {
          if (
            data.name &&
            categories.some(
              (category) => category.id !== id && category.name === data.name,
            )
          )
            return Promise.reject(
              Object.assign(new Error("Unique category name"), {
                code: "P2002",
              }),
            );
          const index = categories.findIndex((category) => category.id === id);
          categories[index] = {
            ...categories[index]!,
            ...data,
            updatedAt: now,
          };
          return Promise.resolve(categories[index]);
        },
      ),
    },
    expense: {
      count: jest.fn(({ where = {} }: { where?: Row } = {}) =>
        Promise.resolve(
          expenses.filter((expense) => matchesExpense(expense, where)).length,
        ),
      ),
      findMany: jest.fn(
        ({
          where = {},
          skip = 0,
          take,
          orderBy,
        }: {
          where?: Row;
          skip?: number;
          take?: number;
          orderBy?: Row[];
        } = {}) => {
          const rows = sortRows(
            expenses
              .filter((expense) => matchesExpense(expense, where))
              .map(hydrateExpense) as unknown as Row[],
            orderBy,
          );
          return Promise.resolve(
            rows.slice(skip, take ? skip + take : undefined),
          );
        },
      ),
      findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) => {
        const expense = expenses.find((row) => row.id === id);
        return Promise.resolve(expense ? hydrateExpense(expense) : null);
      }),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<ExpenseRow, "id" | "createdAt" | "updatedAt">;
        }) => {
          const expense: ExpenseRow = {
            id: randomUUID(),
            ...data,
            amount: new Prisma.Decimal(data.amount),
            createdAt: now,
            updatedAt: now,
          };
          expenses.push(expense);
          return Promise.resolve(hydrateExpense(expense));
        },
      ),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: Partial<ExpenseRow>;
        }) => {
          const index = expenses.findIndex((expense) => expense.id === id);
          expenses[index] = {
            ...expenses[index]!,
            ...data,
            ...(data.amount !== undefined
              ? { amount: new Prisma.Decimal(data.amount) }
              : {}),
            updatedAt: now,
          };
          return Promise.resolve(hydrateExpense(expenses[index]));
        },
      ),
      delete: jest.fn(({ where: { id } }: { where: { id: string } }) => {
        const index = expenses.findIndex((expense) => expense.id === id);
        return Promise.resolve(expenses.splice(index, 1)[0]);
      }),
    },
    recurringExpense: {
      count: jest.fn(() => Promise.resolve(recurringExpenses.length)),
      findMany: jest.fn(
        ({
          where = {},
          skip = 0,
          take,
        }: { where?: Row; skip?: number; take?: number } = {}) => {
          const startDate = where.startDate as { lte?: Date } | undefined;
          const endDate = (
            where.OR as Array<{ endDate?: null | { gte?: Date } }> | undefined
          )?.find(
            (condition) =>
              condition.endDate && typeof condition.endDate === "object",
          )?.endDate as { gte?: Date } | undefined;
          return Promise.resolve(
            recurringExpenses
              .filter(
                (template) =>
                  (where.active === undefined ||
                    template.active === where.active) &&
                  (!startDate?.lte || template.startDate <= startDate.lte) &&
                  (!endDate?.gte ||
                    template.endDate === null ||
                    template.endDate >= endDate.gte),
              )
              .slice(skip, take ? skip + take : undefined)
              .map(hydrateRecurring),
          );
        },
      ),
      findUnique: jest.fn(
        async ({ where: { id } }: { where: { id: string } }) => {
          const template = recurringExpenses.find((row) => row.id === id);
          const result = template ? hydrateRecurring(template) : null;
          if (
            recurringReadBarrier?.templateId === id &&
            activeTransactions === 0
          ) {
            recurringReadBarrier.reads += 1;
            if (recurringReadBarrier.reads === 2)
              recurringReadBarrier.release();
            await recurringReadBarrier.ready;
          }
          return result;
        },
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<RecurringExpenseRow, "id" | "createdAt" | "updatedAt">;
        }) => {
          const template: RecurringExpenseRow = {
            id: randomUUID(),
            ...data,
            amount: new Prisma.Decimal(data.amount),
            createdAt: now,
            updatedAt: now,
          };
          recurringExpenses.push(template);
          return Promise.resolve(hydrateRecurring(template));
        },
      ),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: Partial<RecurringExpenseRow>;
        }) => {
          const index = recurringExpenses.findIndex(
            (template) => template.id === id,
          );
          recurringExpenses[index] = {
            ...recurringExpenses[index]!,
            ...data,
            ...(data.amount !== undefined
              ? { amount: new Prisma.Decimal(data.amount) }
              : {}),
            updatedAt: now,
          };
          return Promise.resolve(hydrateRecurring(recurringExpenses[index]));
        },
      ),
      delete: jest.fn(({ where: { id } }: { where: { id: string } }) => {
        const index = recurringExpenses.findIndex(
          (template) => template.id === id,
        );
        return Promise.resolve(recurringExpenses.splice(index, 1)[0]);
      }),
    },
    recurringExpenseOccurrence: {
      count: jest.fn(({ where = {} }: { where?: Row } = {}) =>
        Promise.resolve(
          occurrences.filter(
            (occurrence) =>
              !where.recurringExpenseId ||
              occurrence.recurringExpenseId === where.recurringExpenseId,
          ).length,
        ),
      ),
      findUnique: jest.fn(({ where }: { where: Row }) => {
        const compound = where.recurringExpenseId_periodYear_periodMonth as
          | {
              recurringExpenseId: string;
              periodYear: number;
              periodMonth: number;
            }
          | undefined;
        return Promise.resolve(
          occurrences.find(
            (occurrence) =>
              compound &&
              occurrence.recurringExpenseId === compound.recurringExpenseId &&
              occurrence.periodYear === compound.periodYear &&
              occurrence.periodMonth === compound.periodMonth,
          ) ?? null,
        );
      }),
      create: jest.fn(({ data }: { data: Row }) => {
        const expenseCreate = (data.expense as { create: Row } | undefined)
          ?.create;
        const expense = expenseCreate
          ? ({
              id: randomUUID(),
              date: expenseCreate.date as Date,
              categoryId: expenseCreate.categoryId as string,
              description: expenseCreate.description as string,
              amount: new Prisma.Decimal(
                expenseCreate.amount as Prisma.Decimal,
              ),
              paymentMethod:
                (expenseCreate.paymentMethod as string | null) ?? null,
              notes: (expenseCreate.notes as string | null) ?? null,
              source: "RECURRING_OCCURRENCE",
              createdByAdminId: expenseCreate.createdByAdminId as string,
              createdAt: now,
              updatedAt: now,
            } satisfies ExpenseRow)
          : expenses.find((row) => row.id === data.expenseId)!;
        const occurrence: RecurringExpenseOccurrenceRow = {
          id: randomUUID(),
          recurringExpenseId: data.recurringExpenseId as string,
          periodYear: data.periodYear as number,
          periodMonth: data.periodMonth as number,
          expenseId: expense.id,
          nameSnapshot: data.nameSnapshot as string,
          categoryNameSnapshot: data.categoryNameSnapshot as string,
          amountSnapshot: new Prisma.Decimal(
            data.amountSnapshot as Prisma.Decimal,
          ),
          paymentMethodSnapshot:
            (data.paymentMethodSnapshot as string | null) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        if (expenseCreate) expenses.push(expense);
        occurrences.push(occurrence);
        return Promise.resolve({
          ...occurrence,
          expense: hydrateExpense(expense),
        });
      }),
    },
  };
  return {
    prisma,
    transaction,
    categories,
    expenses,
    recurringExpenses,
    occurrences,
    pauseConcurrentRecurringReads(templateId: string) {
      let release: () => void = () => {};
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      recurringReadBarrier = { templateId, reads: 0, release, ready };
    },
  };
}

describe("Finance expenses", () => {
  let app: INestApplication;
  let accessToken: string;
  let recurringService: RecurringExpensesService;
  const database = makePrismaMock();

  const authenticated = (operation: request.Test) =>
    operation.set("Cookie", [`athlon_access=${accessToken}`]);
  const write = (operation: request.Test) =>
    authenticated(operation)
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf);

  beforeAll(async () => {
    // Recurrence mutation semantics depend on the current calendar month.
    // Freeze Date while preserving real timers for Nest and supertest I/O.
    jest.useFakeTimers({
      now: new Date("2026-09-21T12:00:00.000Z"),
      doNotFake: [
        "hrtime",
        "nextTick",
        "performance",
        "queueMicrotask",
        "setImmediate",
        "clearImmediate",
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
      ],
    });
    accessToken = await new JwtService().signAsync(
      {
        sub: adminId,
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database.prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
    recurringService = app.get(RecurringExpensesService);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      jest.useRealTimers();
    }
  });

  it("creates, lists, and updates custom expense categories", async () => {
    const created = await write(
      request(app.getHttpServer()).post(
        "/api/v1/admin/finance/expense-categories",
      ),
    )
      .send({ name: "  Equipment repair  " })
      .expect(201);
    expect(created.body).toMatchObject({
      name: "Equipment repair",
      active: true,
    });

    const listed = await authenticated(
      request(app.getHttpServer()).get(
        "/api/v1/admin/finance/expense-categories?q=repair",
      ),
    ).expect(200);
    expect(
      (listed.body as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
    ).toEqual([created.body.id]);

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/expense-categories/${created.body.id}`,
      ),
    )
      .send({ active: false })
      .expect(200)
      .expect(({ body }) => expect(body.active).toBe(false));
  });

  it("creates, reads, updates, and deletes one-time expenses", async () => {
    const created = await write(
      request(app.getHttpServer()).post("/api/v1/admin/finance/expenses"),
    )
      .send({
        date: "2026-09-21",
        categoryId,
        description: "  Office supplies  ",
        amount: "2500.50",
        paymentMethod: "  Cash  ",
        notes: "  Receipt 42  ",
      })
      .expect(201);
    expect(created.body).toMatchObject({
      description: "Office supplies",
      amount: "2500.5",
      paymentMethod: "Cash",
      notes: "Receipt 42",
      source: "ONE_TIME",
      createdByAdminId: adminId,
    });

    await authenticated(
      request(app.getHttpServer()).get(
        `/api/v1/admin/finance/expenses/${created.body.id}`,
      ),
    )
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/expenses/${created.body.id}`,
      ),
    )
      .send({ amount: "3000", paymentMethod: " " })
      .expect(200)
      .expect(({ body }) => {
        expect(body.amount).toBe("3000");
        expect(body.paymentMethod).toBeNull();
      });

    await write(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/finance/expenses/${created.body.id}`,
      ),
    ).expect(204);
  });

  it("filters expenses by date, category, source, and search text", async () => {
    const created = await write(
      request(app.getHttpServer()).post("/api/v1/admin/finance/expenses"),
    )
      .send({
        date: "2026-10-02",
        categoryId: otherCategoryId,
        description: "October campaign",
        amount: "90000",
      })
      .expect(201);

    for (const query of [
      "dateFrom=2026-10-01&dateTo=2026-10-31",
      `categoryId=${otherCategoryId}`,
      "source=ONE_TIME",
      "q=campaign",
    ]) {
      const response = await authenticated(
        request(app.getHttpServer()).get(
          `/api/v1/admin/finance/expenses?${query}`,
        ),
      ).expect(200);
      expect(
        (response.body as { items: Array<{ id: string }> }).items.map(
          (item) => item.id,
        ),
      ).toContain(created.body.id);
    }

    const generated = await authenticated(
      request(app.getHttpServer()).get(
        "/api/v1/admin/finance/expenses?source=RECURRING_OCCURRENCE",
      ),
    ).expect(200);
    expect(
      (generated.body as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
    ).toEqual([generatedExpenseId]);
  });

  it("prevents normal expense CRUD from rewriting recurring history", async () => {
    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/expenses/${generatedExpenseId}`,
      ),
    )
      .send({ amount: "1" })
      .expect(409);
    await write(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/finance/expenses/${generatedExpenseId}`,
      ),
    ).expect(409);
  });

  it("creates, reads, updates, lists, and deletes recurring templates", async () => {
    const created = await write(
      request(app.getHttpServer()).post(
        "/api/v1/admin/finance/recurring-expenses",
      ),
    )
      .send({
        name: "  Monthly hosting  ",
        categoryId,
        amount: "15000",
        startDate: "2026-09-15",
        paymentMethod: "  Card  ",
      })
      .expect(201);
    expect(created.body).toMatchObject({
      name: "Monthly hosting",
      amount: "15000",
      recurrence: "MONTHLY",
      active: true,
      paymentMethod: "Card",
    });

    await authenticated(
      request(app.getHttpServer()).get(
        `/api/v1/admin/finance/recurring-expenses/${created.body.id}`,
      ),
    )
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));

    await authenticated(
      request(app.getHttpServer()).get(
        "/api/v1/admin/finance/recurring-expenses",
      ),
    )
      .expect(200)
      .expect(({ body }) => {
        const items = (body as { items: Array<{ id: string }> }).items;
        expect(items.map((item) => item.id)).toContain(created.body.id);
      });

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/recurring-expenses/${created.body.id}`,
      ),
    )
      .send({ amount: "17500", endDate: "2026-12-31", active: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.amount).toBe("17500");
        expect(body.active).toBe(false);
      });

    await write(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/finance/recurring-expenses/${created.body.id}`,
      ),
    ).expect(204);
  });

  it("materializes each monthly occurrence once and preserves historical snapshots", async () => {
    const template = await write(
      request(app.getHttpServer()).post(
        "/api/v1/admin/finance/recurring-expenses",
      ),
    )
      .send({
        name: "Monthly software",
        categoryId,
        amount: "20000",
        startDate: "2026-09-30",
        paymentMethod: "Card",
        notes: "September terms",
      })
      .expect(201);
    const tx = database.prisma as unknown as Prisma.TransactionClient;

    await expect(recurringService.materializePeriod(tx, 2026, 9)).resolves.toBe(
      1,
    );
    await expect(recurringService.materializePeriod(tx, 2026, 9)).resolves.toBe(
      0,
    );
    await expect(tx.recurringExpenseOccurrence.count()).resolves.toBe(1);
    await expect(
      tx.expense.count({
        where: { source: "RECURRING_OCCURRENCE" },
      }),
    ).resolves.toBe(2);

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/recurring-expenses/${template.body.id}`,
      ),
    )
      .send({
        name: "Software subscription",
        categoryId: otherCategoryId,
        amount: "25000",
        paymentMethod: "Bank transfer",
        notes: "October terms",
      })
      .expect(200);
    await expect(
      recurringService.materializePeriod(tx, 2026, 10),
    ).resolves.toBe(1);

    const september = database.occurrences.find(
      (occurrence) =>
        occurrence.recurringExpenseId === template.body.id &&
        occurrence.periodMonth === 9,
    )!;
    const october = database.occurrences.find(
      (occurrence) =>
        occurrence.recurringExpenseId === template.body.id &&
        occurrence.periodMonth === 10,
    )!;
    const septemberExpense = database.expenses.find(
      (expense) => expense.id === september.expenseId,
    )!;
    const octoberExpense = database.expenses.find(
      (expense) => expense.id === october.expenseId,
    )!;

    expect(september).toMatchObject({
      nameSnapshot: "Monthly software",
      categoryNameSnapshot: "Rent",
      paymentMethodSnapshot: "Card",
    });
    expect(september.amountSnapshot.toString()).toBe("20000");
    expect(septemberExpense).toMatchObject({
      categoryId,
      description: "Monthly software",
      paymentMethod: "Card",
      notes: "September terms",
    });
    expect(septemberExpense.amount.toString()).toBe("20000");
    expect(septemberExpense.date.toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );

    expect(october).toMatchObject({
      nameSnapshot: "Software subscription",
      categoryNameSnapshot: "Advertising",
      paymentMethodSnapshot: "Bank transfer",
    });
    expect(october.amountSnapshot.toString()).toBe("25000");
    expect(octoberExpense).toMatchObject({
      categoryId: otherCategoryId,
      description: "Software subscription",
      paymentMethod: "Bank transfer",
      notes: "October terms",
    });
    expect(octoberExpense.amount.toString()).toBe("25000");
    expect(octoberExpense.date.toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("preserves completed months with the previous template before an edit", async () => {
    const created = await write(
      request(app.getHttpServer()).post(
        "/api/v1/admin/finance/recurring-expenses",
      ),
    )
      .send({
        name: "Historical subscription",
        categoryId,
        amount: "100",
        startDate: "2026-08-10",
        paymentMethod: "Cash",
        notes: "August terms",
      })
      .expect(201);

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/recurring-expenses/${created.body.id}`,
      ),
    )
      .send({
        name: "Edited subscription",
        categoryId: otherCategoryId,
        amount: "200",
        paymentMethod: "Card",
        notes: "September terms",
      })
      .expect(200);

    await expect(
      recurringService.materializePeriod(
        database.prisma as unknown as Prisma.TransactionClient,
        2026,
        8,
      ),
    ).resolves.toBe(0);
    const august = database.occurrences.find(
      (occurrence) =>
        occurrence.recurringExpenseId === created.body.id &&
        occurrence.periodYear === 2026 &&
        occurrence.periodMonth === 8,
    )!;
    const expense = database.expenses.find(
      (row) => row.id === august.expenseId,
    )!;
    expect(august).toMatchObject({
      nameSnapshot: "Historical subscription",
      categoryNameSnapshot: "Rent",
      paymentMethodSnapshot: "Cash",
    });
    expect(august.amountSnapshot.toString()).toBe("100");
    expect(expense).toMatchObject({
      categoryId,
      description: "Historical subscription",
      paymentMethod: "Cash",
      notes: "August terms",
    });
    expect(expense.amount.toString()).toBe("100");
  });

  it("preserves completed months before deactivation or deletion", async () => {
    const createTemplate = (name: string) =>
      write(
        request(app.getHttpServer()).post(
          "/api/v1/admin/finance/recurring-expenses",
        ),
      )
        .send({
          name,
          categoryId,
          amount: "300",
          startDate: "2026-08-20",
        })
        .expect(201);
    const deactivated = await createTemplate("Deactivate with history");
    const deletion = await createTemplate("Delete with history");

    await write(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/finance/recurring-expenses/${deactivated.body.id}`,
      ),
    )
      .send({ active: false })
      .expect(200);
    await write(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/finance/recurring-expenses/${deletion.body.id}`,
      ),
    ).expect(409);

    for (const templateId of [deactivated.body.id, deletion.body.id]) {
      const august = database.occurrences.find(
        (occurrence) =>
          occurrence.recurringExpenseId === templateId &&
          occurrence.periodYear === 2026 &&
          occurrence.periodMonth === 8,
      );
      expect(august?.amountSnapshot.toString()).toBe("300");
    }
  });

  it("serializes concurrent date-boundary updates before validation", async () => {
    const created = await write(
      request(app.getHttpServer()).post(
        "/api/v1/admin/finance/recurring-expenses",
      ),
    )
      .send({
        name: "Concurrent dates",
        categoryId,
        amount: "1",
        startDate: "2026-09-01",
        endDate: "2026-10-31",
      })
      .expect(201);
    database.pauseConcurrentRecurringReads(created.body.id);

    const patchTemplate = (body: Row) =>
      write(
        request(app.getHttpServer()).patch(
          `/api/v1/admin/finance/recurring-expenses/${created.body.id}`,
        ),
      ).send(body);
    const responses = await Promise.all([
      patchTemplate({ startDate: "2026-10-01" }),
      patchTemplate({ endDate: "2026-09-30" }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    const stored = database.recurringExpenses.find(
      (template) => template.id === created.body.id,
    )!;
    expect(stored.startDate.getTime()).toBeLessThanOrEqual(
      stored.endDate!.getTime(),
    );
    expect(database.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("does not materialize inactive or out-of-window templates", async () => {
    const createTemplate = (body: Row) =>
      write(
        request(app.getHttpServer()).post(
          "/api/v1/admin/finance/recurring-expenses",
        ),
      )
        .send(body)
        .expect(201);
    await createTemplate({
      name: "Inactive",
      categoryId,
      amount: "1",
      startDate: "2026-09-01",
      active: false,
    });
    await createTemplate({
      name: "Future",
      categoryId,
      amount: "1",
      startDate: "2026-12-01",
    });
    await createTemplate({
      name: "Expired",
      categoryId,
      amount: "1",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    for (const template of database.recurringExpenses) {
      if (!["Inactive", "Future", "Expired"].includes(template.name))
        template.active = false;
    }

    await expect(
      recurringService.materializePeriod(
        database.prisma as unknown as Prisma.TransactionClient,
        2026,
        11,
      ),
    ).resolves.toBe(0);
  });

  it.each([
    [
      "negative expense amount",
      "/expenses",
      { date: "2026-09-21", categoryId, description: "Bad", amount: "-1" },
    ],
    [
      "blank expense description",
      "/expenses",
      { date: "2026-09-21", categoryId, description: " ", amount: "1" },
    ],
    [
      "forged expense source",
      "/expenses",
      {
        date: "2026-09-21",
        categoryId,
        description: "Bad",
        amount: "1",
        source: "RECURRING_OCCURRENCE",
      },
    ],
    [
      "negative recurring amount",
      "/recurring-expenses",
      { name: "Bad", categoryId, amount: "-1", startDate: "2026-09-01" },
    ],
    [
      "recurring end before start",
      "/recurring-expenses",
      {
        name: "Bad dates",
        categoryId,
        amount: "1",
        startDate: "2026-10-01",
        endDate: "2026-09-30",
      },
    ],
  ])("rejects %s", async (_name, route, body) => {
    await write(
      request(app.getHttpServer()).post(`/api/v1/admin/finance${route}`),
    )
      .send(body)
      .expect(400);
  });

  it("protects reads and requires CSRF on writes", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/finance/expenses")
      .expect(401);
    await authenticated(
      request(app.getHttpServer()).post("/api/v1/admin/finance/expenses"),
    )
      .send({
        date: "2026-09-21",
        categoryId,
        description: "Blocked",
        amount: "1",
      })
      .expect(403);
  });
});
