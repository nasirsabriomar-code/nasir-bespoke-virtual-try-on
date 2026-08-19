-- CreateEnum
CREATE TYPE "FabricStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MaterialRole" AS ENUM ('SUIT_FABRIC', 'SHIRT_FABRIC');

-- CreateTable
CREATE TABLE "fabrics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "weight" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "supplier" TEXT,
    "status" "FabricStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fabric_variants" (
    "id" TEXT NOT NULL,
    "fabricId" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fabric_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_material_snapshots" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "role" "MaterialRole" NOT NULL,
    "fabricId" TEXT NOT NULL,
    "fabricVariantId" TEXT,
    "fabricName" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "weight" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "supplier" TEXT,
    "variantColour" TEXT,
    "selectedBy" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_material_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fabric_variants_fabricId_idx" ON "fabric_variants"("fabricId");

-- CreateIndex
CREATE INDEX "order_material_snapshots_orderId_idx" ON "order_material_snapshots"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_material_snapshots_orderId_role_key" ON "order_material_snapshots"("orderId", "role");

-- AddForeignKey
ALTER TABLE "fabric_variants" ADD CONSTRAINT "fabric_variants_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_material_snapshots" ADD CONSTRAINT "order_material_snapshots_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_material_snapshots" ADD CONSTRAINT "order_material_snapshots_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_material_snapshots" ADD CONSTRAINT "order_material_snapshots_fabricVariantId_fkey" FOREIGN KEY ("fabricVariantId") REFERENCES "fabric_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
