import type { FinalOutfitSnapshot } from "@/lib/showroom/final-outfit";
import type {
  Customer,
  CustomerPreferences,
  Fabric,
  FabricStatus,
  FabricVariant,
  MaterialRole,
  MeasurementBlock,
  MeasurementProfile,
  Order,
  OrderMaterialSnapshot,
  OrderMeasurementSnapshot,
  OrderStatus,
  ProductionJob,
  ProductionStage,
  ProductionStageHistoryEntry,
  SavedOutfit,
  SavedOutfitSourceType,
  ShowroomSession,
  ShowroomSessionStatus,
} from "./types";

/**
 * Thrown by getPrismaClient() (lib/customer/db.ts) whenever DATABASE_URL is
 * not configured. Mirrors the existing AuthConfigurationError/
 * RateLimitConfigurationError pattern (lib/auth/config.ts, lib/rate-limit.ts)
 * — every customer-domain route handler catches this and returns a safe 503
 * rather than crashing. This is the deliberate "safe by default" gate for
 * this milestone: the full domain ships now, but nothing is reachable in a
 * live deployment until a real Postgres database is provisioned and
 * DATABASE_URL is set (the same pattern used for SPLIT_GENERATION_ENABLED).
 */
export class DatabaseConfigurationError extends Error {
  constructor() {
    super("The customer database is not configured.");
    this.name = "DatabaseConfigurationError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor() {
    super("Customer not found.");
    this.name = "CustomerNotFoundError";
  }
}

export class DuplicatePhoneError extends Error {
  constructor() {
    super("A customer with this phone number already exists.");
    this.name = "DuplicatePhoneError";
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("Showroom session not found.");
    this.name = "SessionNotFoundError";
  }
}

export class SavedOutfitNotFoundError extends Error {
  constructor() {
    super("Saved outfit not found.");
    this.name = "SavedOutfitNotFoundError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

/** Thrown when an order is requested but the customer has no measurement on file yet — an order can never be created without one. */
export class MeasurementRequiredError extends Error {
  constructor() {
    super("This customer has no measurements on file yet. Record a measurement before creating an order.");
    this.name = "MeasurementRequiredError";
  }
}

export class FabricNotFoundError extends Error {
  constructor() {
    super("Fabric not found.");
    this.name = "FabricNotFoundError";
  }
}

export class FabricVariantNotFoundError extends Error {
  constructor() {
    super("Fabric variant not found.");
    this.name = "FabricVariantNotFoundError";
  }
}

/** Thrown when a selection targets a retired fabric, an unavailable variant, or a variant that doesn't belong to the given fabric. */
export class InvalidMaterialSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMaterialSelectionError";
  }
}

export class ProductionJobNotFoundError extends Error {
  constructor() {
    super("Production job not found.");
    this.name = "ProductionJobNotFoundError";
  }
}

/** Thrown when a POST attempts to create a second production job for an order that already has one — the Order:ProductionJob relationship is 1:1. */
export class ProductionJobAlreadyExistsError extends Error {
  constructor() {
    super("A production job already exists for this order.");
    this.name = "ProductionJobAlreadyExistsError";
  }
}

/**
 * Thrown when a write references another record that does not exist, or
 * exists but belongs to a different customer — e.g. a SavedOutfit citing a
 * sessionId that is not actually this customer's session.
 */
export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReferenceError";
  }
}

export type NewCustomerInput = {
  name: string;
  phone: string;
  email: string | null;
  preferences: CustomerPreferences;
};

export type CustomerUpdateInput = {
  name?: string;
  email?: string | null;
  preferences?: CustomerPreferences;
};

export type NewMeasurementInput = {
  customerId: string;
  jacketMeasurements: MeasurementBlock;
  trouserMeasurements: MeasurementBlock;
  shirtMeasurements: MeasurementBlock;
  recordedBy: string;
};

export type NewSessionInput = {
  customerId: string;
  occasion: string | null;
  createdBy: string;
};

export type SessionUpdateInput = {
  status?: ShowroomSessionStatus;
  occasion?: string | null;
  selectedLookId?: string | null;
  finalOutfitSnapshotId?: string | null;
};

export type NewSavedOutfitInput = {
  customerId: string;
  sessionId: string | null;
  sourceType: SavedOutfitSourceType;
  sourceLookId: string | null;
  outfitSnapshot: FinalOutfitSnapshot;
  createdBy: string;
};

export type NewOrderInput = {
  customerId: string;
  savedOutfitId: string;
  outfitSnapshot: FinalOutfitSnapshot;
  measurementSnapshot: OrderMeasurementSnapshot;
  createdBy: string;
};

export type NewFabricInput = {
  name: string;
  composition: string;
  weight: string;
  season: string;
  colour: string;
  supplier: string | null;
  status: FabricStatus;
};

export type NewFabricVariantInput = {
  fabricId: string;
  colour: string;
  isAvailable: boolean;
};

export type FabricUpdateInput = {
  name?: string;
  composition?: string;
  weight?: string;
  season?: string;
  colour?: string;
  supplier?: string | null;
  status?: FabricStatus;
};

export type FabricVariantUpdateInput = {
  colour?: string;
  isAvailable?: boolean;
};

export type SetOrderMaterialInput = {
  orderId: string;
  role: MaterialRole;
  fabricId: string;
  fabricVariantId: string | null;
  fabricName: string;
  composition: string;
  weight: string;
  season: string;
  colour: string;
  supplier: string | null;
  variantColour: string | null;
  selectedBy: string;
};

export type NewProductionJobInput = {
  orderId: string;
  assignedStaffId: string | null;
  createdBy: string;
};

export type UpdateProductionJobStageInput = {
  toStage: ProductionStage;
  changedBy: string;
  /** undefined = leave assignment unchanged; null = explicitly clear it. */
  assignedStaffId?: string | null;
};

export type ProductionJobFilter = {
  stage?: ProductionStage;
  assignedStaffId?: string;
};

/**
 * The customer-domain persistence contract. lib/customer/prisma-repository.ts
 * is the only production implementation (Postgres via Prisma). Route
 * handlers accept a repository as an injected dependency (same DI pattern
 * as split-try-on-handler.ts's `referenceReader` / `generate`), so every
 * handler is fully unit-testable against an in-memory fake — no test in
 * this repo ever needs a real database connection.
 */
export interface CustomerRepository {
  createCustomer(input: NewCustomerInput): Promise<Customer>;
  getCustomerById(id: string): Promise<Customer | null>;
  searchCustomers(query: string | null, limit: number): Promise<Customer[]>;
  updateCustomer(id: string, patch: CustomerUpdateInput): Promise<Customer | null>;

  createMeasurementVersion(input: NewMeasurementInput): Promise<MeasurementProfile>;
  getMeasurementHistory(customerId: string): Promise<MeasurementProfile[]>;

  createSession(input: NewSessionInput): Promise<ShowroomSession>;
  getSessionById(id: string): Promise<ShowroomSession | null>;
  updateSession(id: string, patch: SessionUpdateInput): Promise<ShowroomSession | null>;
  listCustomerSessions(customerId: string): Promise<ShowroomSession[]>;

  createSavedOutfit(input: NewSavedOutfitInput): Promise<SavedOutfit>;
  getSavedOutfitById(id: string): Promise<SavedOutfit | null>;
  listCustomerOutfits(customerId: string): Promise<SavedOutfit[]>;

  createOrder(input: NewOrderInput): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null>;
  listCustomerOrders(customerId: string): Promise<Order[]>;

  createFabric(input: NewFabricInput): Promise<Fabric>;
  getFabricById(id: string): Promise<Fabric | null>;
  updateFabric(id: string, patch: FabricUpdateInput): Promise<Fabric | null>;
  listFabrics(): Promise<Fabric[]>;

  createFabricVariant(input: NewFabricVariantInput): Promise<FabricVariant>;
  getFabricVariantById(id: string): Promise<FabricVariant | null>;
  updateFabricVariant(id: string, patch: FabricVariantUpdateInput): Promise<FabricVariant | null>;
  listFabricVariants(fabricId: string): Promise<FabricVariant[]>;

  setOrderMaterial(input: SetOrderMaterialInput): Promise<OrderMaterialSnapshot>;
  listOrderMaterials(orderId: string): Promise<OrderMaterialSnapshot[]>;

  createProductionJob(input: NewProductionJobInput): Promise<ProductionJob>;
  getProductionJobById(id: string): Promise<ProductionJob | null>;
  getProductionJobByOrderId(orderId: string): Promise<ProductionJob | null>;
  listProductionJobs(filter: ProductionJobFilter): Promise<ProductionJob[]>;
  /** Atomically updates currentStage AND appends the corresponding ProductionStageHistory row. */
  updateProductionJobStage(id: string, input: UpdateProductionJobStageInput): Promise<ProductionJob | null>;
  listProductionStageHistory(productionJobId: string): Promise<ProductionStageHistoryEntry[]>;
}
