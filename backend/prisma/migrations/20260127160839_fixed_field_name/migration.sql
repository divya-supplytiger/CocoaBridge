/*
  Warnings:

  - Added the required column `updatedAt` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Made the column `externalId` on table `ContactLink` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ContactLink" ALTER COLUMN "externalId" SET NOT NULL;
