-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('CONFIRMED', 'FABRIC_READY', 'CUTTING', 'STITCHING', 'FIRST_TRIAL', 'ALTERATION', 'FINAL_QC', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "production_jobs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currentStage" "ProductionStage" NOT NULL DEFAULT 'CONFIRMED',
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_stage_history" (
    "id" TEXT NOT NULL,
    "productionJobId" TEXT NOT NULL,
    "fromStage" "ProductionStage",
    "toStage" "ProductionStage" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_jobs_orderId_key" ON "production_jobs"("orderId");

-- CreateIndex
CREATE INDEX "production_jobs_orderId_idx" ON "production_jobs"("orderId");

-- CreateIndex
CREATE INDEX "production_stage_history_productionJobId_idx" ON "production_stage_history"("productionJobId");

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_stage_history" ADD CONSTRAINT "production_stage_history_productionJobId_fkey" FOREIGN KEY ("productionJobId") REFERENCES "production_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
