-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ShowroomSessionStatus" AS ENUM ('OPEN', 'EXPLORING', 'OUTFIT_SELECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SavedOutfitSourceType" AS ENUM ('MANUAL', 'SIGNATURE_LOOK');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "preferredStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredColours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredFit" TEXT,
    "preferredOccasions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_profiles" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "jacketMeasurements" JSONB NOT NULL DEFAULT '{}',
    "trouserMeasurements" JSONB NOT NULL DEFAULT '{}',
    "shirtMeasurements" JSONB NOT NULL DEFAULT '{}',
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showroom_sessions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ShowroomSessionStatus" NOT NULL DEFAULT 'OPEN',
    "occasion" TEXT,
    "selectedLookId" TEXT,
    "finalOutfitSnapshotId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showroom_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_outfits" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sourceType" "SavedOutfitSourceType" NOT NULL,
    "sourceLookId" TEXT,
    "outfitSnapshot" JSONB NOT NULL,
    "tryOnResultUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "measurement_profiles_customerId_idx" ON "measurement_profiles"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_profiles_customerId_version_key" ON "measurement_profiles"("customerId", "version");

-- CreateIndex
CREATE INDEX "showroom_sessions_customerId_idx" ON "showroom_sessions"("customerId");

-- CreateIndex
CREATE INDEX "saved_outfits_customerId_idx" ON "saved_outfits"("customerId");

-- CreateIndex
CREATE INDEX "saved_outfits_sessionId_idx" ON "saved_outfits"("sessionId");

-- AddForeignKey
ALTER TABLE "measurement_profiles" ADD CONSTRAINT "measurement_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showroom_sessions" ADD CONSTRAINT "showroom_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "showroom_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

