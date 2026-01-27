/*
  Warnings:

  - You are about to drop the column `naics` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `psc` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `archiveDate` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `fullParentPathCode` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `procurementType` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `setAsideDescription` on the `Opportunity` table. All the data in the column will be lost.
  - Added the required column `tag` to the `InboxItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `InboxItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Type" AS ENUM ('PRE_SOLICITATION', 'AWARD_NOTICE', 'SOURCES_SOUGHT', 'SPECIAL_NOTICE', 'SOLICITATION');

-- CreateEnum
CREATE TYPE "Tag" AS ENUM ('IndustryDay', 'General');

-- DropIndex
DROP INDEX "Award_naics_idx";

-- DropIndex
DROP INDEX "Award_psc_idx";

-- DropIndex
DROP INDEX "Opportunity_archiveDate_idx";

-- DropIndex
DROP INDEX "Opportunity_procurementType_idx";

-- AlterTable
ALTER TABLE "Award" DROP COLUMN "naics",
DROP COLUMN "psc",
ADD COLUMN     "naicsCode" TEXT,
ADD COLUMN     "pscCode" TEXT;

-- AlterTable
ALTER TABLE "InboxItem" ADD COLUMN     "tag" "Tag" NOT NULL,
ADD COLUMN     "type" "Type" NOT NULL;

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "archiveDate",
DROP COLUMN "fullParentPathCode",
DROP COLUMN "procurementType",
DROP COLUMN "setAsideDescription",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "tag" "Tag" NOT NULL DEFAULT 'General',
ADD COLUMN     "type" "Type";

-- DropEnum
DROP TYPE "ProcurementType";

-- CreateIndex
CREATE INDEX "Award_naicsCode_idx" ON "Award"("naicsCode");

-- CreateIndex
CREATE INDEX "Award_pscCode_idx" ON "Award"("pscCode");

-- CreateIndex
CREATE INDEX "InboxItem_type_idx" ON "InboxItem"("type");

-- CreateIndex
CREATE INDEX "InboxItem_tag_idx" ON "InboxItem"("tag");

-- CreateIndex
CREATE INDEX "Opportunity_type_idx" ON "Opportunity"("type");
