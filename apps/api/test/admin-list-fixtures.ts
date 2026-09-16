// A deliberately small in-memory adapter for the Prisma list query subset.
// HTTP tests exercise real controllers/services; this is not a database test.
type Row = Record<string, unknown>;
type Query = {
  where?: Row;
  orderBy?: Row | Row[];
  skip?: number;
  take?: number;
  select?: Row;
};

export const categoryId = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
export const brandId = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
export const childId = "44d3f1a3-8413-4bc6-b32d-437871a22b54";

const base = (
  id: string,
  slug: string,
  published: boolean,
  name: string,
): Row => ({
  id,
  slug,
  published,
  displayOrder: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-02-01"),
  translations: [
    { locale: "EN", name },
    { locale: "HY", name: `${name} HY` },
  ],
});

export const fixtures: Record<"products" | "categories" | "brands", Row[]> = {
  products: [
    {
      ...base("p3", "protein-third", false, "Gamma"),
      sku: "SKU-3",
      categoryId,
      brandId,
      price: 30,
      currency: "AMD",
      availability: "IN_STOCK",
      featured: true,
      isNew: false,
      characteristics: {},
      images: [],
    },
    {
      ...base("p1", "protein-first", false, "Alpha"),
      sku: "SKU-1",
      categoryId,
      brandId,
      price: 10,
      currency: "AMD",
      availability: "IN_STOCK",
      featured: true,
      isNew: false,
      characteristics: {},
      images: [],
    },
    {
      ...base("p2", "creatine", true, "Beta"),
      sku: "SKU-2",
      categoryId: childId,
      brandId: null,
      price: 20,
      currency: "AMD",
      availability: "ON_REQUEST",
      featured: false,
      isNew: true,
      characteristics: {},
      images: [],
    },
  ],
  categories: [
    {
      ...base(categoryId, "nutrition", true, "Nutrition"),
      code: "nutrition",
      parentId: null,
    },
    {
      ...base(brandId, "equipment", false, "Equipment"),
      code: "equipment",
      parentId: null,
    },
    {
      ...base(childId, "protein", false, "Protein"),
      code: "protein",
      parentId: categoryId,
    },
  ],
  brands: [
    {
      ...base(brandId, "brand-z", false, "Localized brand"),
      name: "Z Brand",
      logoKey: null,
    },
    {
      ...base(childId, "brand-a", true, "Other"),
      name: "A Brand",
      logoKey: null,
    },
  ],
};

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR")
      return (condition as Row[]).some((part) => matches(row, part));
    if (key === "AND")
      return (condition as Row[]).every((part) => matches(row, part));
    if (condition && typeof condition === "object") {
      const filter = condition as Row;
      if ("some" in filter)
        return (row[key] as Row[]).some((item) =>
          matches(item, filter.some as Row),
        );
      if ("contains" in filter)
        return String(row[key])
          .toLowerCase()
          .includes(String(filter.contains).toLowerCase());
      if ("not" in filter) return row[key] !== filter.not;
      if ("in" in filter) return (filter.in as unknown[]).includes(row[key]);
      throw new Error(`Unsupported fixture condition ${key}`);
    }
    return row[key] === condition;
  });
}

export function fixtureCount(rows: Row[], query: Query = {}): number {
  return rows.filter((row) => matches(row, query.where)).length;
}

export function fixtureList(rows: Row[], query: Query = {}): Row[] {
  const items = rows.filter((row) => matches(row, query.where));
  const ordering = query.orderBy
    ? Array.isArray(query.orderBy)
      ? query.orderBy
      : [query.orderBy]
    : [];
  items.sort((a, b) => {
    for (const order of ordering) {
      const [field, direction] = Object.entries(order)[0]!;
      const left = a[field] as string | number;
      const right = b[field] as string | number;
      if (left == null && right != null) return direction === "asc" ? 1 : -1;
      if (right == null && left != null) return direction === "asc" ? -1 : 1;
      if (left < right) return direction === "asc" ? -1 : 1;
      if (left > right) return direction === "asc" ? 1 : -1;
    }
    return 0;
  });
  const page = items.slice(
    query.skip ?? 0,
    query.take === undefined ? undefined : (query.skip ?? 0) + query.take,
  );
  return query.select
    ? page.map((row) =>
        Object.fromEntries(
          Object.keys(query.select!).map((key) => [key, row[key]]),
        ),
      )
    : page;
}
