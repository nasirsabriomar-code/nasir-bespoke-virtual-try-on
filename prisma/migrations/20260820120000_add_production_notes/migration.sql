-- CreateTable
CREATE TABLE "production_notes" (
    "id" TEXT NOT NULL,
    "productionJobId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_notes_productionJobId_idx" ON "production_notes"("productionJobId");

-- AddForeignKey
ALTER TABLE "production_notes" ADD CONSTRAINT "production_notes_productionJobId_fkey" FOREIGN KEY ("productionJobId") REFERENCES "production_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
