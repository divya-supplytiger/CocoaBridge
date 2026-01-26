import { SourceSystem, IndustryDayStatus } from "@prisma/client";
import { toDateOrNull, normalizeSamIndustryDay } from "../utils/data-cleaning.js";

export async function upsertOpportunityFromSam(prisma, opportunity) {
  const noticeId = opportunity?.noticeId || opportunity?.id || null;

  if (!noticeId) {
    throw new Error("Missing noticeId for Opportunity upsert");
  }

  const data = {
    source: SourceSystem.SAM,

    noticeId,
    solicitationNumber: opportunity?.solicitationNumber ?? null,
    title: opportunity?.title ?? null,

    active: String(opportunity?.active).toLowerCase() === "yes",

    postedDate: toDateOrNull(opportunity?.postedDate),
    responseDeadline: toDateOrNull(
      opportunity?.responseDeadLine || opportunity?.responseDeadline,
    ),
    archiveDate: toDateOrNull(opportunity?.archiveDate),

    naicsCode: opportunity?.naicsCode ?? null,
    pscCode: opportunity?.classificationCode ?? null,

    setAside: opportunity?.typeOfSetAside ?? null,
    setAsideDescription: opportunity?.typeOfSetAsideDescription ?? null,

    fullParentPathName: opportunity?.fullParentPathName ?? null,
    fullParentPathCode: opportunity?.fullParentPathCode ?? null,

    city: opportunity?.officeAddress?.city ?? null,
    state: opportunity?.officeAddress?.state ?? null,
    zip: opportunity?.officeAddress?.zipcode ?? null,
    countryCode: opportunity?.officeAddress?.countryCode ?? null,

    rawPayload: opportunity,
  };

  return prisma.opportunity.upsert({
    where: { noticeId },
    update: data,
    create: data,
  });
};

export async function upsertIndustryDayFromSam(prisma, opportunity, opportunityId) {
  const normalized = normalizeSamIndustryDay(opportunity);

  if (!normalized.externalEventId) {
    throw new Error("Missing externalEventId (noticeId/id)");
  }

  const data = {
    source: normalized.source, // SourceSystem.SAM
    title: normalized.title,
    summary: normalized.summary,
    location: normalized.location,
    eventDate: normalized.eventDate,
    host: normalized.host,
    status: normalized.status,
    opportunityId,
    rawPayload: normalized.rawPayload,
  };

  return prisma.industryDay.upsert({
    where: { externalEventId: normalized.externalEventId },
    update: data,
    create: {
      externalEventId: normalized.externalEventId,
      ...data,
    },
  });
};