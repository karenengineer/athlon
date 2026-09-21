import { Prisma } from "../src/generated/prisma/client";

export const reportIds = {
  admin: "15c20c13-3b51-44fb-a6ff-33fe765d29bb",
  category: "25c20c13-3b51-44fb-a6ff-33fe765d29bb",
  otherCategory: "35c20c13-3b51-44fb-a6ff-33fe765d29bb",
  product: "45c20c13-3b51-44fb-a6ff-33fe765d29bb",
  otherProduct: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
  supplier: "65c20c13-3b51-44fb-a6ff-33fe765d29bb",
  otherSupplier: "75c20c13-3b51-44fb-a6ff-33fe765d29bb",
  expenseCategory: "85c20c13-3b51-44fb-a6ff-33fe765d29bb",
};
const decimal = (value: string | number) => new Prisma.Decimal(value);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

// Only the database boundary is replaced. Reports, ledger replay, recurring
// materialization, DTO validation and authentication run their production code.
export function reportingDatabase() {
  const stamp = date("2026-01-01");
  const supplier = { id: reportIds.supplier, name: "Primary supplier" };
  const purchase = {
    id: "purchase",
    purchaseNumber: "PUR-1",
    date: date("2026-08-01"),
    createdAt: stamp,
    supplierId: supplier.id,
    supplier,
    notes: null,
  };
  const sale = {
    id: "sale",
    saleNumber: "SAL-1",
    date: date("2026-09-01"),
    createdAt: stamp,
    orderId: null,
    sourceType: "MANUAL",
    sourceId: null,
    channel: "TRAINER",
    trainerReferralCode: "COACH",
    customerName: null,
    customerPhone: null,
    notes: null,
  };
  const products = [
    {
      id: reportIds.product,
      sku: "A-01",
      price: decimal(150000),
      lowStockThreshold: 2,
      categoryId: reportIds.category,
      category: {
        id: reportIds.category,
        translations: [{ locale: "HY", name: "Equipment" }],
      },
      translations: [
        { locale: "HY", name: "Armenian A" },
        { locale: "EN", name: "English A" },
      ],
      purchaseItems: [
        {
          id: "purchase-a",
          purchaseId: "purchase",
          productId: reportIds.product,
          quantity: 8,
          purchaseUnitPrice: decimal(60000),
          purchase,
        },
      ],
      saleItems: [
        {
          id: "sale-a",
          saleId: sale.id,
          productId: reportIds.product,
          quantity: 6,
          actualUnitPrice: decimal(110000),
          lineDiscount: decimal(60000),
          costUnitSnapshot: decimal(60000),
          sale,
        },
      ],
    },
    {
      id: reportIds.otherProduct,
      sku: "B-02",
      price: decimal(200000),
      lowStockThreshold: 1,
      categoryId: reportIds.otherCategory,
      category: {
        id: reportIds.otherCategory,
        translations: [{ locale: "EN", name: "Other equipment" }],
      },
      translations: [{ locale: "EN", name: "English B" }],
      purchaseItems: [
        {
          id: "purchase-b",
          purchaseId: "purchase-b",
          productId: reportIds.otherProduct,
          quantity: 4,
          purchaseUnitPrice: decimal(60000),
          purchase: {
            ...purchase,
            id: "purchase-b",
            supplierId: reportIds.otherSupplier,
            supplier: { id: reportIds.otherSupplier, name: "Other supplier" },
          },
        },
      ],
      saleItems: [
        {
          id: "sale-b",
          saleId: sale.id,
          productId: reportIds.otherProduct,
          quantity: 4,
          actualUnitPrice: decimal(100000),
          lineDiscount: decimal(0),
          costUnitSnapshot: decimal(60000),
          sale,
        },
      ],
    },
  ];
  const category = { id: reportIds.expenseCategory, name: "Operations" };
  const expenses = [
    {
      id: "expense",
      date: date("2026-09-30"),
      categoryId: category.id,
      category,
      description: "One time",
      amount: decimal(60000),
      source: "ONE_TIME",
      paymentMethod: null,
      notes: null,
      recurringOccurrence: null as null | { categoryNameSnapshot: string },
    },
  ];
  const template = {
    id: "template",
    name: "Rent",
    categoryId: category.id,
    category,
    amount: decimal(40000),
    recurrence: "MONTHLY",
    startDate: date("2026-09-01"),
    endDate: date("2026-09-30"),
    active: true,
    paymentMethod: null,
    notes: null,
  };
  const occurrences = new Map<string, Record<string, unknown>>();
  const prisma = {
    adminUser: {
      findUnique: () =>
        Promise.resolve({
          id: reportIds.admin,
          email: "admin@athlon.test",
          active: true,
          role: "ADMIN",
        }),
      findFirst: () => Promise.resolve({ id: reportIds.admin }),
    },
    product: { findMany: () => Promise.resolve(products) },
    expense: {
      findMany: ({
        where,
      }: {
        where: { date: { gte: Date; lte: Date }; categoryId?: string };
      }) =>
        Promise.resolve(
          expenses.filter(
            (expense) =>
              expense.date >= where.date.gte &&
              expense.date <= where.date.lte &&
              (!where.categoryId || expense.categoryId === where.categoryId),
          ),
        ),
      create: ({
        data,
      }: {
        data: Omit<
          (typeof expenses)[number],
          "id" | "category" | "recurringOccurrence"
        >;
      }) => {
        const expense = {
          ...data,
          id: `expense-${expenses.length}`,
          category,
          recurringOccurrence: null,
        };
        expenses.push(expense);
        return Promise.resolve({ id: expense.id });
      },
    },
    recurringExpense: {
      findMany: ({
        where,
      }: {
        where: {
          startDate: { lte: Date };
          OR: Array<{ endDate: null | { gte: Date } }>;
        };
      }) =>
        Promise.resolve(
          template.startDate <= where.startDate.lte &&
            template.endDate >= where.OR[1]!.endDate!.gte
            ? [template]
            : [],
        ),
    },
    recurringExpenseOccurrence: {
      findUnique: ({
        where,
      }: {
        where: {
          recurringExpenseId_periodYear_periodMonth: Record<string, unknown>;
        };
      }) =>
        Promise.resolve(
          occurrences.get(
            JSON.stringify(where.recurringExpenseId_periodYear_periodMonth),
          ) ?? null,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const key = {
          recurringExpenseId: data.recurringExpenseId,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
        };
        occurrences.set(JSON.stringify(key), data);
        expenses.find(
          (expense) => expense.id === data.expenseId,
        )!.recurringOccurrence = {
          categoryNameSnapshot: String(data.categoryNameSnapshot),
        };
        return Promise.resolve(data);
      },
    },
    $transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> =>
      run(prisma),
  };
  return { prisma, products, expenses, occurrences };
}
