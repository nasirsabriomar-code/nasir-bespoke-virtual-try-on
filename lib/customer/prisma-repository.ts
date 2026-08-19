import "server-only";

import type { FinalOutfitSnapshot } from "@/lib/showroom/final-outfit";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Customer as PrismaCustomer,
  Fabric as PrismaFabric,
  FabricVariant as PrismaFabricVariant,
  MeasurementProfile as PrismaMeasurementProfile,
  Order as PrismaOrder,
  OrderMaterialSnapshot as PrismaOrderMaterialSnapshot,
  ProductionJob as PrismaProductionJob,
  ProductionStageHistory as PrismaProductionStageHistory,
  SavedOutfit as PrismaSavedOutfit,
  ShowroomSession as PrismaShowroomSession,
} from "@/lib/generated/prisma/client";
import { getPrismaClient } from "./db";
import {
  DuplicatePhoneError,
  ProductionJobAlreadyExistsError,
  type CustomerRepository,
  type NewCustomerInput,
  type NewFabricInput,
  type NewFabricVariantInput,
  type NewMeasurementInput,
  type NewOrderInput,
  type NewProductionJobInput,
  type NewSavedOutfitInput,
  type NewSessionInput,
  type ProductionJobFilter,
  type SetOrderMaterialInput,
  type UpdateProductionJobStageInput,
  type CustomerUpdateInput,
  type FabricUpdateInput,
  type FabricVariantUpdateInput,
  type SessionUpdateInput,
} from "./repository";
import type {
  Customer,
  Fabric,
  FabricStatus,
  FabricVariant,
  MeasurementBlock,
  MeasurementProfile,
  Order,
  OrderMaterialSnapshot,
  OrderMeasurementSnapshot,
  OrderStatus,
  MaterialRole,
  ProductionJob,
  ProductionStage,
  ProductionStageHistoryEntry,
  SavedOutfit,
  SavedOutfitSourceType,
  ShowroomSession,
} from "./types";

// ============================================================
// MAPPERS — Prisma row shapes -> safe, serializable app-level types
// ============================================================

function asMeasurementBlock(value: Prisma.JsonValue): MeasurementBlock {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: MeasurementBlock = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number") result[key] = raw;
  }
  return result;
}

function mapCustomer(row: PrismaCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    preferences: {
      preferredStyles: row.preferredStyles as Customer["preferences"]["preferredStyles"],
      preferredColours: row.preferredColours as Customer["preferences"]["preferredColours"],
      preferredFit: row.preferredFit as Customer["preferences"]["preferredFit"],
      preferredOccasions: row.preferredOccasions as Customer["preferences"]["preferredOccasions"],
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMeasurement(row: PrismaMeasurementProfile): MeasurementProfile {
  return {
    id: row.id,
    customerId: row.customerId,
    version: row.version,
    jacketMeasurements: asMeasurementBlock(row.jacketMeasurements),
    trouserMeasurements: asMeasurementBlock(row.trouserMeasurements),
    shirtMeasurements: asMeasurementBlock(row.shirtMeasurements),
    recordedBy: row.recordedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSession(row: PrismaShowroomSession): ShowroomSession {
  return {
    id: row.id,
    customerId: row.customerId,
    status: row.status,
    occasion: row.occasion,
    selectedLookId: row.selectedLookId,
    finalOutfitSnapshotId: row.finalOutfitSnapshotId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SOURCE_TYPE_TO_DB: Record<SavedOutfitSourceType, "MANUAL" | "SIGNATURE_LOOK"> = {
  manual: "MANUAL",
  "signature-look": "SIGNATURE_LOOK",
};
const SOURCE_TYPE_FROM_DB: Record<"MANUAL" | "SIGNATURE_LOOK", SavedOutfitSourceType> = {
  MANUAL: "manual",
  SIGNATURE_LOOK: "signature-look",
};

function mapSavedOutfit(row: PrismaSavedOutfit): SavedOutfit {
  return {
    id: row.id,
    customerId: row.customerId,
    sessionId: row.sessionId,
    sourceType: SOURCE_TYPE_FROM_DB[row.sourceType],
    sourceLookId: row.sourceLookId,
    outfitSnapshot: row.outfitSnapshot as unknown as FinalOutfitSnapshot,
    tryOnResultUrl: row.tryOnResultUrl,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapOrder(row: PrismaOrder): Order {
  return {
    id: row.id,
    customerId: row.customerId,
    savedOutfitId: row.savedOutfitId,
    outfitSnapshot: row.outfitSnapshot as unknown as FinalOutfitSnapshot,
    measurementSnapshot: row.measurementSnapshot as unknown as OrderMeasurementSnapshot,
    status: row.status as OrderStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFabric(row: PrismaFabric): Fabric {
  return {
    id: row.id,
    name: row.name,
    composition: row.composition,
    weight: row.weight,
    season: row.season,
    colour: row.colour,
    supplier: row.supplier,
    status: row.status as FabricStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapFabricVariant(row: PrismaFabricVariant): FabricVariant {
  return {
    id: row.id,
    fabricId: row.fabricId,
    colour: row.colour,
    isAvailable: row.isAvailable,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapOrderMaterialSnapshot(row: PrismaOrderMaterialSnapshot): OrderMaterialSnapshot {
  return {
    id: row.id,
    orderId: row.orderId,
    role: row.role as MaterialRole,
    fabricId: row.fabricId,
    fabricVariantId: row.fabricVariantId,
    fabricName: row.fabricName,
    composition: row.composition,
    weight: row.weight,
    season: row.season,
    colour: row.colour,
    supplier: row.supplier,
    variantColour: row.variantColour,
    selectedBy: row.selectedBy,
    selectedAt: row.selectedAt.toISOString(),
  };
}

function mapProductionJob(row: PrismaProductionJob): ProductionJob {
  return {
    id: row.id,
    orderId: row.orderId,
    currentStage: row.currentStage as ProductionStage,
    assignedStaffId: row.assignedStaffId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProductionStageHistory(row: PrismaProductionStageHistory): ProductionStageHistoryEntry {
  return {
    id: row.id,
    productionJobId: row.productionJobId,
    fromStage: row.fromStage as ProductionStage | null,
    toStage: row.toStage as ProductionStage,
    changedBy: row.changedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The real, Postgres-backed CustomerRepository implementation. Only ever
 * imported by route handlers' DEFAULT dependencies — every test in this
 * repo injects an in-memory fake instead (see tests/customer-*.test.ts),
 * so this file is never exercised by the test suite and never needs a real
 * database connection to run `npm test`.
 */
export const prismaCustomerRepository: CustomerRepository = {
  async createCustomer(input: NewCustomerInput): Promise<Customer> {
    const client = getPrismaClient();
    try {
      const row = await client.customer.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          preferredStyles: input.preferences.preferredStyles,
          preferredColours: input.preferences.preferredColours,
          preferredFit: input.preferences.preferredFit,
          preferredOccasions: input.preferences.preferredOccasions,
        },
      });
      return mapCustomer(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new DuplicatePhoneError();
      throw error;
    }
  },

  async getCustomerById(id: string): Promise<Customer | null> {
    const client = getPrismaClient();
    const row = await client.customer.findUnique({ where: { id } });
    return row ? mapCustomer(row) : null;
  },

  async searchCustomers(query: string | null, limit: number): Promise<Customer[]> {
    const client = getPrismaClient();
    const rows = await client.customer.findMany({
      where: query
        ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
          ],
        }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapCustomer);
  },

  async updateCustomer(id: string, patch: CustomerUpdateInput): Promise<Customer | null> {
    const client = getPrismaClient();
    try {
      const row = await client.customer.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.preferences !== undefined
            ? {
              preferredStyles: patch.preferences.preferredStyles,
              preferredColours: patch.preferences.preferredColours,
              preferredFit: patch.preferences.preferredFit,
              preferredOccasions: patch.preferences.preferredOccasions,
            }
            : {}),
        },
      });
      return mapCustomer(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async createMeasurementVersion(input: NewMeasurementInput): Promise<MeasurementProfile> {
    const client = getPrismaClient();
    const latest = await client.measurementProfile.findFirst({
      where: { customerId: input.customerId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const row = await client.measurementProfile.create({
      data: {
        customerId: input.customerId,
        version: nextVersion,
        jacketMeasurements: input.jacketMeasurements,
        trouserMeasurements: input.trouserMeasurements,
        shirtMeasurements: input.shirtMeasurements,
        recordedBy: input.recordedBy,
      },
    });
    return mapMeasurement(row);
  },

  async getMeasurementHistory(customerId: string): Promise<MeasurementProfile[]> {
    const client = getPrismaClient();
    const rows = await client.measurementProfile.findMany({
      where: { customerId },
      orderBy: { version: "desc" },
    });
    return rows.map(mapMeasurement);
  },

  async createSession(input: NewSessionInput): Promise<ShowroomSession> {
    const client = getPrismaClient();
    const row = await client.showroomSession.create({
      data: {
        customerId: input.customerId,
        occasion: input.occasion,
        createdBy: input.createdBy,
      },
    });
    return mapSession(row);
  },

  async getSessionById(id: string): Promise<ShowroomSession | null> {
    const client = getPrismaClient();
    const row = await client.showroomSession.findUnique({ where: { id } });
    return row ? mapSession(row) : null;
  },

  async updateSession(id: string, patch: SessionUpdateInput): Promise<ShowroomSession | null> {
    const client = getPrismaClient();
    try {
      const row = await client.showroomSession.update({
        where: { id },
        data: {
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.occasion !== undefined ? { occasion: patch.occasion } : {}),
          ...(patch.selectedLookId !== undefined ? { selectedLookId: patch.selectedLookId } : {}),
          ...(patch.finalOutfitSnapshotId !== undefined ? { finalOutfitSnapshotId: patch.finalOutfitSnapshotId } : {}),
        },
      });
      return mapSession(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async listCustomerSessions(customerId: string): Promise<ShowroomSession[]> {
    const client = getPrismaClient();
    const rows = await client.showroomSession.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapSession);
  },

  async createSavedOutfit(input: NewSavedOutfitInput): Promise<SavedOutfit> {
    const client = getPrismaClient();
    const row = await client.savedOutfit.create({
      data: {
        customerId: input.customerId,
        sessionId: input.sessionId,
        sourceType: SOURCE_TYPE_TO_DB[input.sourceType],
        sourceLookId: input.sourceLookId,
        outfitSnapshot: input.outfitSnapshot as unknown as Prisma.InputJsonValue,
        createdBy: input.createdBy,
      },
    });
    return mapSavedOutfit(row);
  },

  async listCustomerOutfits(customerId: string): Promise<SavedOutfit[]> {
    const client = getPrismaClient();
    const rows = await client.savedOutfit.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapSavedOutfit);
  },

  async getSavedOutfitById(id: string): Promise<SavedOutfit | null> {
    const client = getPrismaClient();
    const row = await client.savedOutfit.findUnique({ where: { id } });
    return row ? mapSavedOutfit(row) : null;
  },

  async createOrder(input: NewOrderInput): Promise<Order> {
    const client = getPrismaClient();
    const row = await client.order.create({
      data: {
        customerId: input.customerId,
        savedOutfitId: input.savedOutfitId,
        outfitSnapshot: input.outfitSnapshot as unknown as Prisma.InputJsonValue,
        measurementSnapshot: input.measurementSnapshot as unknown as Prisma.InputJsonValue,
        createdBy: input.createdBy,
      },
    });
    return mapOrder(row);
  },

  async getOrderById(id: string): Promise<Order | null> {
    const client = getPrismaClient();
    const row = await client.order.findUnique({ where: { id } });
    return row ? mapOrder(row) : null;
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const client = getPrismaClient();
    try {
      const row = await client.order.update({ where: { id }, data: { status } });
      return mapOrder(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async listCustomerOrders(customerId: string): Promise<Order[]> {
    const client = getPrismaClient();
    const rows = await client.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapOrder);
  },

  async createFabric(input: NewFabricInput): Promise<Fabric> {
    const client = getPrismaClient();
    const row = await client.fabric.create({
      data: {
        name: input.name,
        composition: input.composition,
        weight: input.weight,
        season: input.season,
        colour: input.colour,
        supplier: input.supplier,
        status: input.status,
      },
    });
    return mapFabric(row);
  },

  async getFabricById(id: string): Promise<Fabric | null> {
    const client = getPrismaClient();
    const row = await client.fabric.findUnique({ where: { id } });
    return row ? mapFabric(row) : null;
  },

  async updateFabric(id: string, patch: FabricUpdateInput): Promise<Fabric | null> {
    const client = getPrismaClient();
    try {
      const row = await client.fabric.update({ where: { id }, data: patch });
      return mapFabric(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async listFabrics(): Promise<Fabric[]> {
    const client = getPrismaClient();
    const rows = await client.fabric.findMany({ orderBy: { name: "asc" } });
    return rows.map(mapFabric);
  },

  async createFabricVariant(input: NewFabricVariantInput): Promise<FabricVariant> {
    const client = getPrismaClient();
    const row = await client.fabricVariant.create({
      data: {
        fabricId: input.fabricId,
        colour: input.colour,
        isAvailable: input.isAvailable,
      },
    });
    return mapFabricVariant(row);
  },

  async getFabricVariantById(id: string): Promise<FabricVariant | null> {
    const client = getPrismaClient();
    const row = await client.fabricVariant.findUnique({ where: { id } });
    return row ? mapFabricVariant(row) : null;
  },

  async updateFabricVariant(id: string, patch: FabricVariantUpdateInput): Promise<FabricVariant | null> {
    const client = getPrismaClient();
    try {
      const row = await client.fabricVariant.update({ where: { id }, data: patch });
      return mapFabricVariant(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async listFabricVariants(fabricId: string): Promise<FabricVariant[]> {
    const client = getPrismaClient();
    const rows = await client.fabricVariant.findMany({
      where: { fabricId },
      orderBy: { colour: "asc" },
    });
    return rows.map(mapFabricVariant);
  },

  async setOrderMaterial(input: SetOrderMaterialInput): Promise<OrderMaterialSnapshot> {
    const client = getPrismaClient();
    const row = await client.orderMaterialSnapshot.upsert({
      where: { orderId_role: { orderId: input.orderId, role: input.role } },
      create: {
        orderId: input.orderId,
        role: input.role,
        fabricId: input.fabricId,
        fabricVariantId: input.fabricVariantId,
        fabricName: input.fabricName,
        composition: input.composition,
        weight: input.weight,
        season: input.season,
        colour: input.colour,
        supplier: input.supplier,
        variantColour: input.variantColour,
        selectedBy: input.selectedBy,
      },
      update: {
        fabricId: input.fabricId,
        fabricVariantId: input.fabricVariantId,
        fabricName: input.fabricName,
        composition: input.composition,
        weight: input.weight,
        season: input.season,
        colour: input.colour,
        supplier: input.supplier,
        variantColour: input.variantColour,
        selectedBy: input.selectedBy,
        selectedAt: new Date(),
      },
    });
    return mapOrderMaterialSnapshot(row);
  },

  async listOrderMaterials(orderId: string): Promise<OrderMaterialSnapshot[]> {
    const client = getPrismaClient();
    const rows = await client.orderMaterialSnapshot.findMany({
      where: { orderId },
      orderBy: { role: "asc" },
    });
    return rows.map(mapOrderMaterialSnapshot);
  },

  async createProductionJob(input: NewProductionJobInput): Promise<ProductionJob> {
    const client = getPrismaClient();
    try {
      const row = await client.$transaction(async (tx) => {
        const job = await tx.productionJob.create({
          data: {
            orderId: input.orderId,
            assignedStaffId: input.assignedStaffId,
          },
        });
        await tx.productionStageHistory.create({
          data: {
            productionJobId: job.id,
            fromStage: null,
            toStage: job.currentStage,
            changedBy: input.createdBy,
          },
        });
        return job;
      });
      return mapProductionJob(row);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ProductionJobAlreadyExistsError();
      throw error;
    }
  },

  async getProductionJobById(id: string): Promise<ProductionJob | null> {
    const client = getPrismaClient();
    const row = await client.productionJob.findUnique({ where: { id } });
    return row ? mapProductionJob(row) : null;
  },

  async getProductionJobByOrderId(orderId: string): Promise<ProductionJob | null> {
    const client = getPrismaClient();
    const row = await client.productionJob.findUnique({ where: { orderId } });
    return row ? mapProductionJob(row) : null;
  },

  async listProductionJobs(filter: ProductionJobFilter): Promise<ProductionJob[]> {
    const client = getPrismaClient();
    const rows = await client.productionJob.findMany({
      where: {
        ...(filter.stage !== undefined ? { currentStage: filter.stage } : {}),
        ...(filter.assignedStaffId !== undefined ? { assignedStaffId: filter.assignedStaffId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProductionJob);
  },

  async updateProductionJobStage(id: string, input: UpdateProductionJobStageInput): Promise<ProductionJob | null> {
    const client = getPrismaClient();
    try {
      const row = await client.$transaction(async (tx) => {
        const existing = await tx.productionJob.findUnique({ where: { id } });
        if (!existing) return null;

        const updated = await tx.productionJob.update({
          where: { id },
          data: {
            currentStage: input.toStage,
            ...(input.assignedStaffId !== undefined ? { assignedStaffId: input.assignedStaffId } : {}),
          },
        });
        await tx.productionStageHistory.create({
          data: {
            productionJobId: id,
            fromStage: existing.currentStage,
            toStage: input.toStage,
            changedBy: input.changedBy,
          },
        });
        return updated;
      });
      return row ? mapProductionJob(row) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
  },

  async listProductionStageHistory(productionJobId: string): Promise<ProductionStageHistoryEntry[]> {
    const client = getPrismaClient();
    const rows = await client.productionStageHistory.findMany({
      where: { productionJobId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapProductionStageHistory);
  },
};
