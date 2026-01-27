/*
  Warnings:

  - You are about to drop the column `naicsCode` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `naicsCode` on the `Opportunity` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Award_naicsCode_idx";

-- DropIndex
DROP INDEX "Opportunity_naicsCode_idx";

-- AlterTable
ALTER TABLE "Award" DROP COLUMN "naicsCode",
ADD COLUMN     "naicsCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "naicsCode",
ADD COLUMN     "naicsCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Award_naicsCodes_idx" ON "Award" USING GIN ("naicsCodes");

-- CreateIndex
CREATE INDEX "Opportunity_naicsCodes_idx" ON "Opportunity" USING GIN ("naicsCodes");
