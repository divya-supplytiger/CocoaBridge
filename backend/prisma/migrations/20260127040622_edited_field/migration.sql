/*
  Warnings:

  - The `tag` column on the `Opportunity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `tag` on the `InboxItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OppTag" AS ENUM ('INDUSTRY_DAY', 'GENERAL');

-- AlterTable
ALTER TABLE "InboxItem" DROP COLUMN "tag",
ADD COLUMN     "tag" "OppTag" NOT NULL;

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "tag",
ADD COLUMN     "tag" "OppTag" NOT NULL DEFAULT 'GENERAL';

-- DropEnum
DROP TYPE "Tag";

-- CreateIndex
CREATE INDEX "InboxItem_tag_idx" ON "InboxItem"("tag");
