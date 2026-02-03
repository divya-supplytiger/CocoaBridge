/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `BuyingOrganization` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BuyingOrganization_externalId_key" ON "BuyingOrganization"("externalId");
