/*
  Warnings:

  - You are about to drop the column `awardingAgency` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `awardingOffice` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `externalAwardId` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `externalEventId` on the `IndustryDay` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalId]` on the table `Award` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `IndustryDay` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Award_externalAwardId_key";

-- DropIndex
DROP INDEX "IndustryDay_externalEventId_key";

-- AlterTable
ALTER TABLE "Award" DROP COLUMN "awardingAgency",
DROP COLUMN "awardingOffice",
DROP COLUMN "externalAwardId",
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "opportunityId" TEXT;

-- AlterTable
ALTER TABLE "IndustryDay" DROP COLUMN "externalEventId",
ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Award_externalId_key" ON "Award"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDay_externalId_key" ON "IndustryDay"("externalId");

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
