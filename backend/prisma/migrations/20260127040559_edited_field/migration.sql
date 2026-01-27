/*
  Warnings:

  - The values [IndustryDay,General] on the enum `Tag` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `source` on the `Contact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalId]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Tag_new" AS ENUM ('INDUSTRY_DAY', 'GENERAL');
ALTER TABLE "public"."Opportunity" ALTER COLUMN "tag" DROP DEFAULT;
ALTER TABLE "Opportunity" ALTER COLUMN "tag" TYPE "Tag_new" USING ("tag"::text::"Tag_new");
ALTER TABLE "InboxItem" ALTER COLUMN "tag" TYPE "Tag_new" USING ("tag"::text::"Tag_new");
ALTER TYPE "Tag" RENAME TO "Tag_old";
ALTER TYPE "Tag_new" RENAME TO "Tag";
DROP TYPE "public"."Tag_old";
ALTER TABLE "Opportunity" ALTER COLUMN "tag" SET DEFAULT 'GENERAL';
COMMIT;

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "source";

-- AlterTable
ALTER TABLE "Opportunity" ALTER COLUMN "tag" SET DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "Contact_externalId_key" ON "Contact"("externalId");
