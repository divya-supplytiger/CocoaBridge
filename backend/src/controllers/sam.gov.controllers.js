import { SourceSystem, IndustryDayStatus } from "@prisma/client";
import {
  normalizeSamIndustryDay,
  normalizeOpportunity,
} from "../utils/data-cleaning.js";

import { extractContact, toDateOrNull } from "../utils/filter.js";
export async function upsertContactsForOpportunity(db, samOpportunity, opportunityId) {
  const contacts = extractContact(samOpportunity);
  // 1) Upsert/create the PERSON (Contact)
  // Dedupe strategy: Email-first
  // If email missing, fall back to phone, else just create.
  for (const c of contacts) {
    // Clean fields, remove spaces and treat "" as null
    const phone = c.phone && String(c.phone).trim() ? String(c.phone).trim() : null;

    try {
    let contact;
    if (c.email) {
      contact = await db.contact.upsert({
        where: { email: c.email },
        update: {
          fullName: c.fullName,
          title: c.title,
          phone,
        },
        create: {
          fullName: c.fullName,
          title: c.title,
          email: c.email,
          phone,
        },
      });
    } else {
      // No email, create new contact record
      contact = await db.contact.create({
        data: {
          fullName: c.fullName,
          title: c.title,
          email: c.email,
          phone,
        },
      });
    }

    // 2) Upsert/create the OpportunityContact link
    // Prisma will generate a compound unique selector name:
    // opportunityId_externalId (based on @@unique([opportunityId, externalId]))
    await db.contactLink.upsert({
        where: {
            opportunityId_externalId: {
                opportunityId,
                externalId: c.externalId
            }
        },
        update: {
            type: c.type,
            source: c.source,
            contactId: contact.id,
        },
        create: {
            opportunityId,
            externalId: c.externalId,
            type: c.type,
            source: c.source,
            contactId: contact.id,
        },
    });
} catch (error) {
    console.error("Error in upsertContactsForOpportunity controller: ", {
        opportunityId,
        externalId: c.externalId,
        email: c.email ?? null,
        phone: c.phone ?? null,
        message: error?.message ?? String(error),
    });
    // continue to next contact
  }
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
