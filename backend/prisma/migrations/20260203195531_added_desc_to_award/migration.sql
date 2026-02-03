-- DropIndex
DROP INDEX "BuyingOrganization_externalId_key";

-- DropIndex
DROP INDEX "BuyingOrganization_name_key";

-- AlterTable
ALTER TABLE "Award" ADD COLUMN     "description" TEXT;

-- CreateIndex
CREATE INDEX "BuyingOrganization_name_idx" ON "BuyingOrganization"("name");

-- CreateIndex
CREATE INDEX "BuyingOrganization_name_externalId_idx" ON "BuyingOrganization"("name", "externalId");
