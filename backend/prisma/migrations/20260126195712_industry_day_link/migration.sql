/*
  Warnings:

  - A unique constraint covering the columns `[opportunityId]` on the table `IndustryDay` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "IndustryDay" ADD COLUMN     "opportunityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDay_opportunityId_key" ON "IndustryDay"("opportunityId");

-- AddForeignKey
ALTER TABLE "IndustryDay" ADD CONSTRAINT "IndustryDay_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
