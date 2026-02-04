/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `BuyingOrganization` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BuyingOrganization_name_key" ON "BuyingOrganization"("name");
