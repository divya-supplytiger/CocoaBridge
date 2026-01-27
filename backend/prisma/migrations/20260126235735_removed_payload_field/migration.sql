/*
  Warnings:

  - You are about to drop the column `rawPayload` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `rawPayload` on the `InboxItem` table. All the data in the column will be lost.
  - You are about to drop the column `rawPayload` on the `IndustryDay` table. All the data in the column will be lost.
  - You are about to drop the column `rawPayload` on the `Opportunity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Award" DROP COLUMN "rawPayload";

-- AlterTable
ALTER TABLE "InboxItem" DROP COLUMN "rawPayload";

-- AlterTable
ALTER TABLE "IndustryDay" DROP COLUMN "rawPayload";

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "rawPayload";
