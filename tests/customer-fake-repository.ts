import type {
  CustomerRepository,
  CustomerUpdateInput,
  NewCustomerInput,
  NewFabricInput,
  NewFabricVariantInput,
  NewMeasurementInput,
  NewOrderInput,
  NewSavedOutfitInput,
  NewSessionInput,
  SessionUpdateInput,
  SetOrderMaterialInput,
} from "@/lib/customer/repository";
import { DuplicatePhoneError } from "@/lib/customer/repository";
import type {
  Customer,
  Fabric,
  FabricVariant,
  MeasurementProfile,
  Order,
  OrderMaterialSnapshot,
  OrderStatus,
  SavedOutfit,
  ShowroomSession,
} from "@/lib/customer/types";

/**
 * A fully in-memory implementation of CustomerRepository — used by every
 * customer-domain test in this repo instead of a real Postgres connection.
 * Mirrors the real Prisma repository's observable behavior (uniqueness,
 * append-only measurement versioning, not-found handling) closely enough
 * for route-handler-level tests, without ever touching a database.
 */
export function createFakeCustomerRepository(): CustomerRepository & { reset: () => void } {
  let customers = new Map<string, Customer>();
  let measurements = new Map<string, MeasurementProfile[]>();
  let sessions = new Map<string, ShowroomSession>();
  let outfits = new Map<string, SavedOutfit[]>();
  let outfitsById = new Map<string, SavedOutfit>();
  let orders = new Map<string, Order>();
  let fabrics = new Map<string, Fabric>();
  let fabricVariants = new Map<string, FabricVariant>();
  /** Keyed by `${orderId}:${role}` to mirror the real @@unique([orderId, role]) constraint. */
  let orderMaterials = new Map<string, OrderMaterialSnapshot>();

  function now() {
    return new Date().toISOString();
  }

  const repository: CustomerRepository & { reset: () => void } = {
    reset() {
      customers = new Map();
      measurements = new Map();
      sessions = new Map();
      outfits = new Map();
      outfitsById = new Map();
      orders = new Map();
      fabrics = new Map();
      fabricVariants = new Map();
      orderMaterials = new Map();
    },

    async createCustomer(input: NewCustomerInput): Promise<Customer> {
      for (const existing of customers.values()) {
        if (existing.phone === input.phone) throw new DuplicatePhoneError();
      }
      const timestamp = now();
      const customer: Customer = {
        id: crypto.randomUUID(),
        name: input.name,
        phone: input.phone,
        email: input.email,
        preferences: input.preferences,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      customers.set(customer.id, customer);
      return customer;
    },

    async getCustomerById(id: string): Promise<Customer | null> {
      return customers.get(id) ?? null;
    },

    async searchCustomers(query: string | null, limit: number): Promise<Customer[]> {
      const all = [...customers.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const filtered = query
        ? all.filter(
          (customer) =>
            customer.name.toLowerCase().includes(query.toLowerCase()) || customer.phone.includes(query),
        )
        : all;
      return filtered.slice(0, limit);
    },

    async updateCustomer(id: string, patch: CustomerUpdateInput): Promise<Customer | null> {
      const existing = customers.get(id);
      if (!existing) return null;
      const updated: Customer = {
        ...existing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
        updatedAt: now(),
      };
      customers.set(id, updated);
      return updated;
    },

    async createMeasurementVersion(input: NewMeasurementInput): Promise<MeasurementProfile> {
      const history = measurements.get(input.customerId) ?? [];
      const nextVersion = history.reduce((max, entry) => Math.max(max, entry.version), 0) + 1;
      const measurement: MeasurementProfile = {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        version: nextVersion,
        jacketMeasurements: input.jacketMeasurements,
        trouserMeasurements: input.trouserMeasurements,
        shirtMeasurements: input.shirtMeasurements,
        recordedBy: input.recordedBy,
        createdAt: now(),
      };
      measurements.set(input.customerId, [...history, measurement]);
      return measurement;
    },

    async getMeasurementHistory(customerId: string): Promise<MeasurementProfile[]> {
      return [...(measurements.get(customerId) ?? [])].sort((a, b) => b.version - a.version);
    },

    async createSession(input: NewSessionInput): Promise<ShowroomSession> {
      const timestamp = now();
      const session: ShowroomSession = {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        status: "OPEN",
        occasion: input.occasion,
        selectedLookId: null,
        finalOutfitSnapshotId: null,
        createdBy: input.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      sessions.set(session.id, session);
      return session;
    },

    async getSessionById(id: string): Promise<ShowroomSession | null> {
      return sessions.get(id) ?? null;
    },

    async updateSession(id: string, patch: SessionUpdateInput): Promise<ShowroomSession | null> {
      const existing = sessions.get(id);
      if (!existing) return null;
      const updated: ShowroomSession = {
        ...existing,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.occasion !== undefined ? { occasion: patch.occasion } : {}),
        ...(patch.selectedLookId !== undefined ? { selectedLookId: patch.selectedLookId } : {}),
        ...(patch.finalOutfitSnapshotId !== undefined ? { finalOutfitSnapshotId: patch.finalOutfitSnapshotId } : {}),
        updatedAt: now(),
      };
      sessions.set(id, updated);
      return updated;
    },

    async listCustomerSessions(customerId: string): Promise<ShowroomSession[]> {
      return [...sessions.values()]
        .filter((session) => session.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createSavedOutfit(input: NewSavedOutfitInput): Promise<SavedOutfit> {
      const outfit: SavedOutfit = {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        sessionId: input.sessionId,
        sourceType: input.sourceType,
        sourceLookId: input.sourceLookId,
        outfitSnapshot: input.outfitSnapshot,
        tryOnResultUrl: null,
        createdBy: input.createdBy,
        createdAt: now(),
      };
      outfits.set(input.customerId, [...(outfits.get(input.customerId) ?? []), outfit]);
      outfitsById.set(outfit.id, outfit);
      return outfit;
    },

    async listCustomerOutfits(customerId: string): Promise<SavedOutfit[]> {
      return [...(outfits.get(customerId) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getSavedOutfitById(id: string): Promise<SavedOutfit | null> {
      return outfitsById.get(id) ?? null;
    },

    async createOrder(input: NewOrderInput): Promise<Order> {
      const timestamp = now();
      const order: Order = {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        savedOutfitId: input.savedOutfitId,
        outfitSnapshot: input.outfitSnapshot,
        measurementSnapshot: input.measurementSnapshot,
        status: "DRAFT",
        createdBy: input.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      orders.set(order.id, order);
      return order;
    },

    async getOrderById(id: string): Promise<Order | null> {
      return orders.get(id) ?? null;
    },

    async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
      const existing = orders.get(id);
      if (!existing) return null;
      const updated: Order = { ...existing, status, updatedAt: now() };
      orders.set(id, updated);
      return updated;
    },

    async listCustomerOrders(customerId: string): Promise<Order[]> {
      return [...orders.values()]
        .filter((order) => order.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createFabric(input: NewFabricInput): Promise<Fabric> {
      const fabric: Fabric = {
        id: crypto.randomUUID(),
        name: input.name,
        composition: input.composition,
        weight: input.weight,
        season: input.season,
        colour: input.colour,
        supplier: input.supplier,
        status: input.status,
        createdAt: now(),
      };
      fabrics.set(fabric.id, fabric);
      return fabric;
    },

    async getFabricById(id: string): Promise<Fabric | null> {
      return fabrics.get(id) ?? null;
    },

    async listFabrics(): Promise<Fabric[]> {
      return [...fabrics.values()].sort((a, b) => a.name.localeCompare(b.name));
    },

    async createFabricVariant(input: NewFabricVariantInput): Promise<FabricVariant> {
      const variant: FabricVariant = {
        id: crypto.randomUUID(),
        fabricId: input.fabricId,
        colour: input.colour,
        isAvailable: input.isAvailable,
        createdAt: now(),
      };
      fabricVariants.set(variant.id, variant);
      return variant;
    },

    async getFabricVariantById(id: string): Promise<FabricVariant | null> {
      return fabricVariants.get(id) ?? null;
    },

    async listFabricVariants(fabricId: string): Promise<FabricVariant[]> {
      return [...fabricVariants.values()]
        .filter((variant) => variant.fabricId === fabricId)
        .sort((a, b) => a.colour.localeCompare(b.colour));
    },

    async setOrderMaterial(input: SetOrderMaterialInput): Promise<OrderMaterialSnapshot> {
      const key = `${input.orderId}:${input.role}`;
      const existing = orderMaterials.get(key);
      const snapshot: OrderMaterialSnapshot = {
        id: existing?.id ?? crypto.randomUUID(),
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
        selectedAt: now(),
      };
      orderMaterials.set(key, snapshot);
      return snapshot;
    },

    async listOrderMaterials(orderId: string): Promise<OrderMaterialSnapshot[]> {
      return [...orderMaterials.values()]
        .filter((snapshot) => snapshot.orderId === orderId)
        .sort((a, b) => a.role.localeCompare(b.role));
    },
  };

  return repository;
}
