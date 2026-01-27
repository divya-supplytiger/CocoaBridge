import { SourceSystem, IndustryDayStatus } from "@prisma/client";
import {
  normalizeSamIndustryDay,
  normalizeOpportunity,
} from "../utils/data-cleaning.js";

import { extractContact, toDateOrNull } from "../utils/filter.js";
export async function upsertContactsForOpportunity(db, samOpportunity, opportunityId) {
  const contacts = extractContact(samOpportunity);

    for (const c of contacts) {
        await db.contact.upsert({
            where: { externalId: c.externalId},
            update: {
                type: c.type,
                fullName: c.fullName,
                title: c.title,
                email: c.email,
                phone: c.phone,
                opportunityId, // attach/update link
            },
            create: {
                ...c,
                opportunityId,
            },
        });
    }
};


export async function upsertOpportunityFromSam(prisma, opportunity) {
  const normalized = normalizeOpportunity(opportunity);

  if (!normalized.noticeId) {
    throw new Error("Missing noticeId for Opportunity upsert");
  }

  const data = {
    source: SourceSystem.SAM,

    noticeId: normalized.noticeId,
    solicitationNumber: normalized.solicitationNumber ?? null,
    title: normalized.title ?? null,
    type: normalized.type ?? null,
    tag: normalized.tag,
    active: normalized.active,

    description: normalized.description ?? null,

    // Dates (still derived from raw SAM payload)
    postedDate: toDateOrNull(opportunity?.postedDate),
    responseDeadline: toDateOrNull(
      opportunity?.responseDeadLine || opportunity?.responseDeadline,
    ),

    // Classification
    naicsCodes: normalized.naicsCodes ?? [],
    pscCode: normalized.pscCode ?? null,
    setAside: opportunity?.typeOfSetAside ?? null,

    // Org / office metadata
    fullParentPathName: normalized.fullParentPathName ?? null,
    city: normalized.city ?? null,
    state: normalized.state ?? null,
    zip: normalized.zip ?? null,
    countryCode: normalized.countryCode ?? null,
  };

  const opp = await prisma.opportunity.upsert({
    where: { noticeId: normalized.noticeId },
    update: data,
    create: data,
  });

  // Upsert contacts associated with this opportunity
  await upsertContactsForOpportunity(prisma, opportunity, opp.id);
  return opp;
};


export async function upsertIndustryDayFromSam(
  prisma,
  opportunity,
  opportunityId,
) {
  const normalized = normalizeSamIndustryDay(opportunity);

  if (!normalized.externalEventId) {
    throw new Error("Missing externalEventId (noticeId/id)");
  }

  // Ensure the opportunityId unique constraint won't be violated
  if (opportunityId) {
    await prisma.industryDay.updateMany({
      where: {
        opportunityId,
        externalEventId: { not: normalized.externalEventId },
      },
      data: { opportunityId: null },
    });
  }

  const data = {
    source: normalized.source, // SourceSystem.SAM
    title: normalized.title,
    summary: normalized.summary,
    location: normalized.location,
    eventDate: normalized.eventDate,
    host: normalized.host,
    status: normalized.status,
    opportunityId: opportunityId ?? null,
  };

  return prisma.industryDay.upsert({
    where: { externalEventId: normalized.externalEventId },
    update: data,
    create: {
      externalEventId: normalized.externalEventId,
      ...data,
    },
  });
}
