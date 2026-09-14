import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AvailabilityStatus, Locale } from "../src/generated/prisma/enums";

config({ path: resolve(__dirname, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const names = (hy: string, ru: string, en: string) => [
  { locale: Locale.HY, name: hy },
  { locale: Locale.RU, name: ru },
  { locale: Locale.EN, name: en },
];

async function upsertCategory(
  code: string,
  slug: string,
  translatedNames: ReturnType<typeof names>,
  displayOrder: number,
  parentId?: string,
): Promise<string> {
  const category = await prisma.category.upsert({
    where: { code },
    create: { code, slug, displayOrder, parentId: parentId ?? null },
    update: { slug, displayOrder, parentId: parentId ?? null, published: true },
  });
  for (const translation of translatedNames) {
    await prisma.categoryTranslation.upsert({
      where: {
        categoryId_locale: {
          categoryId: category.id,
          locale: translation.locale,
        },
      },
      create: { categoryId: category.id, ...translation },
      update: { name: translation.name },
    });
  }
  return category.id;
}

async function main(): Promise<void> {
  const sportsNutritionId = await upsertCategory(
    "sports-nutrition",
    "sports-nutrition",
    names("Սպորտային սնունդ", "Спортивное питание", "Sports nutrition"),
    0,
  );
  const accessoriesId = await upsertCategory(
    "accessories",
    "accessories",
    names("Աքսեսուարներ", "Аксессуары", "Accessories"),
    1,
  );
  const proteinId = await upsertCategory(
    "protein",
    "protein",
    names("Սպիտակուց", "Протеин", "Protein"),
    0,
    sportsNutritionId,
  );
  const performanceId = await upsertCategory(
    "performance",
    "performance",
    names(
      "Արդյունավետության սնունդ",
      "Питание для производительности",
      "Performance nutrition",
    ),
    1,
    sportsNutritionId,
  );
  const trainingAccessoriesId = await upsertCategory(
    "training-accessories",
    "training-accessories",
    names(
      "Մարզման աքսեսուարներ",
      "Аксессуары для тренировок",
      "Training accessories",
    ),
    0,
    accessoriesId,
  );

  const brand = await prisma.brand.upsert({
    where: { slug: "demo-athletics" },
    create: { slug: "demo-athletics", name: "Demo Athletics" },
    update: { name: "Demo Athletics", published: true },
  });
  for (const translation of names(
    "Դեմո Աթլետիկս",
    "Демо Атлетикс",
    "Demo Athletics",
  )) {
    await prisma.brandTranslation.upsert({
      where: {
        brandId_locale: { brandId: brand.id, locale: translation.locale },
      },
      create: { brandId: brand.id, ...translation },
      update: { name: translation.name },
    });
  }

  const products = [
    [
      "DEMO-WHEY-01",
      "demo-whey-protein",
      proteinId,
      "Դեմո շիճուկային պրոտեին",
      "Демо сывороточный протеин",
      "Demo whey protein",
    ],
    [
      "DEMO-WHEY-02",
      "demo-isolate",
      proteinId,
      "Դեմո իզոլյատ",
      "Демо изолят",
      "Demo isolate",
    ],
    [
      "DEMO-CASEIN-01",
      "demo-casein",
      proteinId,
      "Դեմո կազեին",
      "Демо казеин",
      "Demo casein",
    ],
    [
      "DEMO-CREATINE-01",
      "demo-creatine",
      performanceId,
      "Դեմո կրեատին",
      "Демо креатин",
      "Demo creatine",
    ],
    [
      "DEMO-BCAA-01",
      "demo-bcaa",
      performanceId,
      "Դեմո BCAA",
      "Демо BCAA",
      "Demo BCAA",
    ],
    [
      "DEMO-EAA-01",
      "demo-eaa",
      performanceId,
      "Դեմո EAA",
      "Демо EAA",
      "Demo EAA",
    ],
    [
      "DEMO-PRE-01",
      "demo-pre-workout",
      performanceId,
      "Դեմո նախամարզումային համալիր",
      "Демо предтренировочный комплекс",
      "Demo pre-workout",
    ],
    [
      "DEMO-GAINER-01",
      "demo-gainer",
      proteinId,
      "Դեմո գեյներ",
      "Демо гейнер",
      "Demo gainer",
    ],
    [
      "DEMO-GLOVE-01",
      "demo-training-gloves",
      trainingAccessoriesId,
      "Դեմո մարզման ձեռնոցներ",
      "Демо тренировочные перчатки",
      "Demo training gloves",
    ],
    [
      "DEMO-BAND-01",
      "demo-resistance-band",
      trainingAccessoriesId,
      "Դեմո դիմադրության ժապավեն",
      "Демо эспандер",
      "Demo resistance band",
    ],
    [
      "DEMO-SHAKER-01",
      "demo-shaker",
      trainingAccessoriesId,
      "Դեմո շեյքեր",
      "Демо шейкер",
      "Demo shaker",
    ],
    [
      "DEMO-BELT-01",
      "demo-training-belt",
      trainingAccessoriesId,
      "Դեմո մարզման գոտի",
      "Демо тренировочный пояс",
      "Demo training belt",
    ],
  ] as const;

  for (const [sku, slug, categoryId, hy, ru, en] of products) {
    const product = await prisma.product.upsert({
      where: { sku },
      create: {
        sku,
        slug,
        categoryId,
        brandId: brand.id,
        price: null,
        currency: "AMD",
        availability: AvailabilityStatus.ON_REQUEST,
        characteristics: { demo: true },
        featured: sku.startsWith("DEMO-WHEY") || sku === "DEMO-CREATINE-01",
        isNew: true,
        published: true,
        displayOrder: products.findIndex((item) => item[0] === sku),
      },
      update: { slug, categoryId, brandId: brand.id, published: true },
    });
    for (const translation of names(hy, ru, en)) {
      await prisma.productTranslation.upsert({
        where: {
          productId_locale: {
            productId: product.id,
            locale: translation.locale,
          },
        },
        create: {
          productId: product.id,
          ...translation,
          shortDescription:
            translation.locale === Locale.RU
              ? "Демонстрационные данные каталога"
              : "Demo catalog data",
        },
        update: { name: translation.name },
      });
    }
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await prisma.adminUser.upsert({
      where: { email: process.env.ADMIN_EMAIL.toLowerCase() },
      create: {
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        passwordHash: await argon2.hash(process.env.ADMIN_PASSWORD),
      },
      update: {
        passwordHash: await argon2.hash(process.env.ADMIN_PASSWORD),
        active: true,
      },
    });
  }
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void run();
