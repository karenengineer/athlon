import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adminListEnvelope, adminListOffset } from "../../common/admin-list";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierListQueryDto } from "./dto/supplier-list-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SupplierListQueryDto): Promise<unknown> {
    const where: Prisma.SupplierWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.q
        ? {
            OR: ["name", "contactName", "phone", "email"].map((field) => ({
              [field]: { contains: query.q, mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const orderBy: Prisma.SupplierOrderByWithRelationInput[] =
      query.sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : [{ name: "asc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        skip: adminListOffset(query),
        take: query.pageSize,
        orderBy,
      }),
    ]);
    return adminListEnvelope(items, total, query);
  }

  async get(id: string): Promise<unknown> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    return supplier;
  }

  async create(input: CreateSupplierDto): Promise<unknown> {
    try {
      return await this.prisma.supplier.create({
        data: {
          ...input,
          name: input.name.trim(),
          contactName: input.contactName?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    } catch (error) {
      rethrowSupplierConflict(error);
    }
  }

  async update(id: string, input: UpdateSupplierDto): Promise<unknown> {
    await this.ensureExists(id);
    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          ...input,
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.contactName !== undefined
            ? { contactName: input.contactName?.trim() || null }
            : {}),
          ...(input.phone !== undefined
            ? { phone: input.phone?.trim() || null }
            : {}),
          ...(input.email !== undefined
            ? { email: input.email?.trim() || null }
            : {}),
          ...(input.notes !== undefined
            ? { notes: input.notes?.trim() || null }
            : {}),
        },
      });
    } catch (error) {
      rethrowSupplierConflict(error);
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    if (await this.prisma.purchase.count({ where: { supplierId: id } })) {
      throw new ConflictException(
        "Supplier is referenced by purchases; deactivate it instead",
      );
    }
    try {
      await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      rethrowSupplierConflict(error);
    }
  }

  private async ensureExists(id: string): Promise<void> {
    if (
      !(await this.prisma.supplier.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Supplier not found");
  }
}

function rethrowSupplierConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException("A supplier with this name already exists");
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    ["P2003", "P2034"].includes(String(error.code))
  )
    throw new ConflictException(
      "Supplier is referenced by purchases or changed concurrently; deactivate it instead",
    );
  throw error;
}
