import { BadRequestException, ConflictException } from "@nestjs/common";
import { AdminListQueryDto } from "./dto/admin-list-query.dto";

export function adminListEnvelope<T>(
  items: T[],
  total: number,
  query: AdminListQueryDto,
) {
  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export function adminOrderedListEnvelope<T extends { id: string }>(
  ids: readonly string[],
  items: readonly T[],
  total: number,
  query: AdminListQueryDto,
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const orderedItems = ids.flatMap((id) => {
    const item = byId.get(id);
    return item === undefined ? [] : [item];
  });
  return adminListEnvelope(orderedItems, total, query);
}

export function adminListOffset(query: AdminListQueryDto): number {
  const offset = (query.page - 1) * query.pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2_147_483_647)
    throw new BadRequestException(
      "Pagination offset is outside the supported range",
    );
  return offset;
}

type NameKey = {
  id: string;
  name?: string;
  translations: { locale: string; name: string }[];
};

// Prisma cannot order parents by a scalar on a to-many translation relation.
// Sort lightweight keys only, then load the selected page's detailed records.
export function adminNamePage(
  rows: NameKey[],
  query: AdminListQueryDto,
): string[] {
  const name = (row: NameKey) =>
    ["HY", "RU", "EN"]
      .map(
        (locale) =>
          row.translations.find((translation) => translation.locale === locale)
            ?.name,
      )
      .find(Boolean) ??
    row.name ??
    "";
  const offset = adminListOffset(query);
  return rows
    .sort((a, b) => name(a).localeCompare(name(b)) || a.id.localeCompare(b.id))
    .slice(offset, offset + query.pageSize)
    .map((row) => row.id);
}

export function rethrowCatalogConflict(error: unknown): never {
  // adapter-pg can surface a commit-time serialization failure directly,
  // rather than the usual Prisma P2034. Restrict mapping to its exact shape.
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
      ["P2003", "P2034"].includes(String(error.code)))
  ) {
    throw new ConflictException(
      "Catalog dependencies or concurrent changes prevent this operation",
    );
  }
  throw error;
}

// Used only by category/brand create and update, not by global ORM handling.
export function rethrowCategoryBrandWriteConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  ) {
    throw new ConflictException(
      "A category or brand with this slug or code already exists",
    );
  }
  rethrowCatalogConflict(error);
}
