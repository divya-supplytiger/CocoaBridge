-- CreateEnum
CREATE TYPE "AcquisitionPath" AS ENUM ('MICROPURCHASE', 'GSA', 'OPEN_MARKET', 'SUBCONTRACTING');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('NEW', 'IN_REVIEW', 'QUALIFIED', 'DISMISSED', 'CONTACTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProcurementType" AS ENUM ('U', 'P', 'A', 'R', 'S', 'O', 'G', 'K', 'I');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PRIMARY', 'SECONDARY', 'OTHER');

-- CreateEnum
CREATE TYPE "IndustryDayStatus" AS ENUM ('OPEN', 'NOT_ATTENDING', 'ATTENDING', 'ATTENDED', 'PAST_EVENT');

-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('SAM', 'USASPENDING', 'MANUAL');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'OTHER',
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "organizationId" TEXT,
    "inboxItemId" TEXT,
    "opportunityId" TEXT,
    "industryDayId" TEXT,
    "source" "SourceSystem" NOT NULL DEFAULT 'SAM',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uei" TEXT,
    "cageCode" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL DEFAULT 'USASPENDING',
    "externalAwardId" TEXT,
    "awardingAgency" TEXT,
    "awardingOffice" TEXT,
    "naics" TEXT,
    "psc" TEXT,
    "obligatedAmount" DECIMAL(18,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "organizationId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryDay" (
    "id" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL DEFAULT 'SAM',
    "externalEventId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "location" TEXT,
    "eventDate" TIMESTAMP(3),
    "host" TEXT,
    "status" "IndustryDayStatus" NOT NULL DEFAULT 'OPEN',
    "organizationId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL DEFAULT 'SAM',
    "noticeId" TEXT,
    "solicitationNumber" TEXT,
    "title" TEXT,
    "procurementType" "ProcurementType",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "postedDate" TIMESTAMP(3),
    "responseDeadline" TIMESTAMP(3),
    "archiveDate" TIMESTAMP(3),
    "naicsCode" TEXT,
    "pscCode" TEXT,
    "setAside" TEXT,
    "setAsideDescription" TEXT,
    "fullParentPathName" TEXT,
    "fullParentPathCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "countryCode" TEXT,
    "organizationId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "source" "SourceSystem" NOT NULL,
    "acquisitionPath" "AcquisitionPath" NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "notes" TEXT,
    "reviewStatus" "InboxStatus" NOT NULL DEFAULT 'NEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "organizationId" TEXT,
    "awardId" TEXT,
    "opportunityId" TEXT,
    "industryDayId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "Contact"("organizationId");

-- CreateIndex
CREATE INDEX "Contact_opportunityId_idx" ON "Contact"("opportunityId");

-- CreateIndex
CREATE INDEX "Contact_industryDayId_idx" ON "Contact"("industryDayId");

-- CreateIndex
CREATE INDEX "Contact_inboxItemId_idx" ON "Contact"("inboxItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_uei_key" ON "Organization"("uei");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_cageCode_idx" ON "Organization"("cageCode");

-- CreateIndex
CREATE UNIQUE INDEX "Award_externalAwardId_key" ON "Award"("externalAwardId");

-- CreateIndex
CREATE INDEX "Award_startDate_idx" ON "Award"("startDate");

-- CreateIndex
CREATE INDEX "Award_endDate_idx" ON "Award"("endDate");

-- CreateIndex
CREATE INDEX "Award_naics_idx" ON "Award"("naics");

-- CreateIndex
CREATE INDEX "Award_psc_idx" ON "Award"("psc");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryDay_externalEventId_key" ON "IndustryDay"("externalEventId");

-- CreateIndex
CREATE INDEX "IndustryDay_eventDate_idx" ON "IndustryDay"("eventDate");

-- CreateIndex
CREATE INDEX "IndustryDay_status_idx" ON "IndustryDay"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_noticeId_key" ON "Opportunity"("noticeId");

-- CreateIndex
CREATE INDEX "Opportunity_postedDate_idx" ON "Opportunity"("postedDate");

-- CreateIndex
CREATE INDEX "Opportunity_responseDeadline_idx" ON "Opportunity"("responseDeadline");

-- CreateIndex
CREATE INDEX "Opportunity_archiveDate_idx" ON "Opportunity"("archiveDate");

-- CreateIndex
CREATE INDEX "Opportunity_naicsCode_idx" ON "Opportunity"("naicsCode");

-- CreateIndex
CREATE INDEX "Opportunity_pscCode_idx" ON "Opportunity"("pscCode");

-- CreateIndex
CREATE INDEX "Opportunity_procurementType_idx" ON "Opportunity"("procurementType");

-- CreateIndex
CREATE INDEX "Opportunity_solicitationNumber_idx" ON "Opportunity"("solicitationNumber");

-- CreateIndex
CREATE INDEX "Opportunity_title_idx" ON "Opportunity"("title");

-- CreateIndex
CREATE INDEX "InboxItem_reviewStatus_idx" ON "InboxItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "InboxItem_acquisitionPath_idx" ON "InboxItem"("acquisitionPath");

-- CreateIndex
CREATE INDEX "InboxItem_createdAt_idx" ON "InboxItem"("createdAt");

-- CreateIndex
CREATE INDEX "InboxItem_organizationId_idx" ON "InboxItem"("organizationId");

-- CreateIndex
CREATE INDEX "InboxItem_awardId_idx" ON "InboxItem"("awardId");

-- CreateIndex
CREATE INDEX "InboxItem_opportunityId_idx" ON "InboxItem"("opportunityId");

-- CreateIndex
CREATE INDEX "InboxItem_industryDayId_idx" ON "InboxItem"("industryDayId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_industryDayId_fkey" FOREIGN KEY ("industryDayId") REFERENCES "IndustryDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndustryDay" ADD CONSTRAINT "IndustryDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_industryDayId_fkey" FOREIGN KEY ("industryDayId") REFERENCES "IndustryDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
