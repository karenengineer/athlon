import { PrismaService } from "../database/prisma.service";
import { ProductsService } from "./products.service";

describe("public product search", () => {
  const product = {
    id: "protein-1",
    sku: "PROTEIN-1",
    slug: "whey-blend",
    price: null,
    availability: "IN_STOCK",
    category: { slug: "protein", translations: [] },
    translations: [{ locale: "EN", name: "Whey Blend" }],
    images: [],
  };
  const prisma = {
    product: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    productTranslation: { findMany: jest.fn() },
  };
  const service = new ProductsService(prisma as unknown as PrismaService);
  const expectProteinCategory = expect.objectContaining({
    OR: expect.arrayContaining([
      expect.objectContaining({
        category: expect.objectContaining({
          OR: expect.arrayContaining([{ slug: "protein" }]),
        }),
      }),
    ]),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.product.count.mockResolvedValue(0);
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.productTranslation.findMany.mockResolvedValue([]);
  });

  it("applies a viable correction within the original filters, sort, and page", async () => {
    prisma.product.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prisma.product.findFirst.mockResolvedValue({ id: product.id });
    prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([product]);
    expect(
      await service.listPublic({
        q: "Pratein",
        category: "sports-nutrition",
        brand: "fixture-brand",
        minPrice: 10,
        availability: "IN_STOCK",
        sort: "priceAsc",
        page: 2,
        pageSize: 1,
      }),
    ).toMatchObject({
      items: [{ slug: "whey-blend" }],
      meta: { correctedQuery: "protein", total: 2, totalPages: 2, page: 2 },
    });
    const scope = expect.objectContaining({
      published: true,
      category: {
        OR: [
          { slug: "sports-nutrition" },
          { parent: { slug: "sports-nutrition" } },
        ],
      },
      brand: { slug: "fixture-brand" },
      price: { gte: 10 },
      availability: "IN_STOCK",
      AND: [expectProteinCategory],
    });
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: scope,
      select: { id: true },
    });
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: scope,
        skip: 1,
        take: 1,
        orderBy: [{ price: "asc" }, { displayOrder: "asc" }],
      }),
    );
  });

  it("keeps literal results authoritative when the requested page is empty", async () => {
    prisma.product.count.mockResolvedValue(1);
    expect(
      await service.listPublic({
        q: "Pratein",
        sort: "displayOrder",
        page: 3,
        pageSize: 1,
      }),
    ).toEqual({
      items: [],
      meta: { total: 1, totalPages: 1, page: 3, pageSize: 1 },
    });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(prisma.productTranslation.findMany).not.toHaveBeenCalled();
  });

  it.each(["protein", "Протеин", "սպիտակուց", "պրոտեին"])(
    "treats %s as an exact protein category term",
    async (q) => {
      prisma.product.count.mockResolvedValue(1);
      const result = await service.listPublic({
        q,
        sort: "displayOrder",
        page: 1,
        pageSize: 24,
      });
      expect(result).toMatchObject({ meta: { total: 1 } });
      expect(result).not.toHaveProperty("meta.correctedQuery");
      expect(prisma.product.count).toHaveBeenCalledWith({
        where: { published: true, AND: [expectProteinCategory] },
      });
    },
  );

  it("keeps the search filter when Unicode normalization exceeds the limit", async () => {
    const q = "ﬃ".repeat(120);
    await service.listPublic({
      q,
      sort: "displayOrder",
      page: 1,
      pageSize: 24,
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        published: true,
        translations: { some: { name: { contains: q, mode: "insensitive" } } },
      },
    });
  });

  it("does not query fuzzy candidates for a short search term", async () => {
    const result = await service.listPublic({
      q: "prt",
      sort: "displayOrder",
      page: 1,
      pageSize: 24,
    });
    expect(result).not.toHaveProperty("meta.correctedQuery");
    expect(prisma.productTranslation.findMany).not.toHaveBeenCalled();
  });

  it("uses the scoped title vocabulary without inventing a match", async () => {
    prisma.productTranslation.findMany.mockResolvedValue([
      { name: "Vanilla blend" },
    ]);
    const result = await service.listPublic({
      q: "vanila",
      brand: "fixture",
      sort: "displayOrder",
      page: 1,
      pageSize: 24,
    });
    expect(prisma.productTranslation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product: { published: true, brand: { slug: "fixture" } } },
        take: expect.any(Number),
        select: { name: true },
      }),
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          published: true,
          brand: { slug: "fixture" },
        }),
      }),
    );
    expect(result).not.toHaveProperty("meta.correctedQuery");
  });

  it.each(["pratein", "protien", "proteinn"])(
    "returns bounded suggestions for %s",
    async (query) => {
      prisma.product.findFirst.mockResolvedValue({ id: product.id });
      prisma.product.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([product]);
      expect(await service.suggestions(query, "en")).toEqual([
        { slug: "whey-blend", name: "Whey Blend" },
      ]);
      expect(prisma.product.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          take: 8,
          where: { published: true, AND: [expectProteinCategory] },
        }),
      );
    },
  );

  it.each([
    [" PROT ", "en", "protein"],
    ["прот", "ru", "протеин"],
    ["սպի", "hy", "սպիտակուց"],
  ])(
    "completes %s using a published search term",
    async (prefix, locale, query) => {
      prisma.product.findFirst.mockResolvedValue({ id: product.id });
      prisma.product.findMany.mockResolvedValue([product]);

      expect(await service.suggestions(prefix, locale, true)).toEqual([
        { query, name: query },
        { slug: "whey-blend", name: "Whey Blend" },
      ]);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { published: true, AND: [expectProteinCategory] },
        select: { id: true },
      });
    },
  );

  it("keeps the existing product-only response unless term suggestions are requested", async () => {
    prisma.product.findMany.mockResolvedValue([product]);

    expect(await service.suggestions("prot", "en")).toEqual([
      { slug: "whey-blend", name: "Whey Blend" },
    ]);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it.each(["pr", "protein", "999"])(
    "skips term availability queries for %s with no longer known term",
    async (query) => {
      prisma.product.findMany.mockResolvedValue([product]);

      expect(await service.suggestions(query, "en", true)).toEqual([
        { slug: "whey-blend", name: "Whey Blend" },
      ]);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    },
  );

  it("omits term completions without published matches", async () => {
    prisma.product.findMany.mockResolvedValue([product]);

    expect(await service.suggestions("prot", "en", true)).toEqual([
      { slug: "whey-blend", name: "Whey Blend" },
    ]);
    expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
  });

  it("keeps the combined suggestion list within eight results", async () => {
    prisma.product.findFirst.mockResolvedValue({ id: product.id });
    prisma.product.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        ...product,
        slug: `whey-${index}`,
      })),
    );

    const result = await service.suggestions("prot", "en", true);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ query: "protein", name: "protein" });
    expect(result[7]).toEqual({ slug: "whey-6", name: "Whey Blend" });
  });

  it("bounds suggestion input before using the database", async () => {
    expect(await service.suggestions("a".repeat(121))).toEqual([]);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
});
