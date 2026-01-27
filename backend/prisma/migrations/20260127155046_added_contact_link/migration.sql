/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `inboxItemId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `industryDayId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `opportunityId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Contact` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_inboxItemId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_industryDayId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_organizationId_fkey";

-- DropIndex
DROP INDEX "Contact_externalId_key";

-- DropIndex
DROP INDEX "Contact_inboxItemId_idx";

-- DropIndex
DROP INDEX "Contact_industryDayId_idx";

-- DropIndex
DROP INDEX "Contact_opportunityId_idx";

-- DropIndex
DROP INDEX "Contact_organizationId_idx";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "createdAt",
DROP COLUMN "externalId",
DROP COLUMN "inboxItemId",
DROP COLUMN "industryDayId",
DROP COLUMN "opportunityId",
DROP COLUMN "organizationId",
DROP COLUMN "type",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "ContactLink" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'OTHER',
    "source" "SourceSystem" NOT NULL DEFAULT 'SAM',
    "externalId" TEXT,
    "opportunityId" TEXT,
    "industryDayId" TEXT,
    "inboxItemId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactLink_opportunityId_idx" ON "ContactLink"("opportunityId");

-- CreateIndex
CREATE INDEX "ContactLink_industryDayId_idx" ON "ContactLink"("industryDayId");

-- CreateIndex
CREATE INDEX "ContactLink_inboxItemId_idx" ON "ContactLink"("inboxItemId");

-- CreateIndex
CREATE INDEX "ContactLink_organizationId_idx" ON "ContactLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactLink_opportunityId_externalId_key" ON "ContactLink"("opportunityId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactLink_industryDayId_externalId_key" ON "ContactLink"("industryDayId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactLink_inboxItemId_externalId_key" ON "ContactLink"("inboxItemId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactLink_organizationId_externalId_key" ON "ContactLink"("organizationId", "externalId");

-- AddForeignKey
ALTER TABLE "ContactLink" ADD CONSTRAINT "ContactLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLink" ADD CONSTRAINT "ContactLink_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLink" ADD CONSTRAINT "ContactLink_industryDayId_fkey" FOREIGN KEY ("industryDayId") REFERENCES "IndustryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLink" ADD CONSTRAINT "ContactLink_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLink" ADD CONSTRAINT "ContactLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
