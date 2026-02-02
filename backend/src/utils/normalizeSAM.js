import { SourceSystem } from "@prisma/client";
import { toDateOrNull, computeIndustryDayStatus, extractLocation, extractNaicsCodes, extractContact, extractType, extractDescription, extractTag, extractAwardAndRelatedFields} from "./extractSAM.js";

export const normalizeOpportunity = (opportunity) => {
    const noticeId = opportunity?.noticeId || opportunity?.id || null;
    const solicitationNumber = opportunity?.solicitationNumber || null;
    const title = opportunity?.title || "No Title";
    const type = extractType(opportunity);
    const tag = extractTag(opportunity);
    const active = String(opportunity?.active).toLowerCase() === "yes" ? true : false;
    const description = extractDescription(opportunity);
    const naicsCodes = extractNaicsCodes(opportunity);
    const pscCode = opportunity?.classificationCode || null;

    const postedDate = toDateOrNull(opportunity?.postedDate);
    const responseDeadline = toDateOrNull(
      opportunity?.responseDeadLine || opportunity?.responseDeadline,
    );

    const setAside = opportunity?.typeOfSetAside || null;
    const fullParentPathName = opportunity?.fullParentPathName || null;
    const city = opportunity?.officeAddress?.city || opportunity?.placeOfPerformance?.city?.name || null;
    const state = opportunity?.officeAddress?.state || opportunity?.placeOfPerformance?.state?.name || null;
    const zip = opportunity?.officeAddress?.zipcode || opportunity?.placeOfPerformance?.zip || null;
    const countryCode = opportunity?.officeAddress?.countryCode || opportunity?.placeOfPerformance?.country?.code || null;

    return {
        source: SourceSystem.SAM,
        noticeId,
        solicitationNumber,
        title,
        type,
        tag,
        active,
        description,
        naicsCodes,
        pscCode,
        fullParentPathName,
        city,
        state,
        zip,
        countryCode,
        postedDate,
        responseDeadline,
        setAside,
    }
};

// ADAPT
export const normalizeSamRecipient = (awardee) => {
    if (!awardee) {
        return null;
    }
    return {
        name: awardee?.name || "Unknown Recipient",
        uei: awardee?.ueiSAM || null,
    };
};

export const normalizeSamAward = (opportunity) => {
  const award = opportunity?.award;
  if (!award?.number) {
    return null;
  }

  return {
    externalId: award.number,
    startDate: toDateOrNull(award.date),
    endDate: toDateOrNull(award.date), // sam.gov usually doesn't provide endDate
    obligatedAmount: award.amount ? Number(award.amount) : 0,
    naicsCodes: extractNaicsCodes(opportunity) ?? [],
    pscCode: opportunity?.classificationCode || null,

  };
};
export const normalizeSamHistoricalOpportunity = (opportunity) => {
    // For now, reuse the same normalization as regular opportunities
    // but set active to false if the opportunity is past its response deadline
    const normalized = normalizeOpportunity(opportunity);

    const responseDeadline = normalized.responseDeadline;

    if (!responseDeadline) {
      normalized.active = false;
      return normalized;
    }
    const now = new Date();

    normalized.active = now <= responseDeadline;
    return normalized;
};

// Normalize SAM Industry Day opportunity data from SAM API
export const normalizeSamIndustryDay = (opportunity) => {
  const externalId = opportunity?.noticeId || opportunity?.id || null;
  // Use responseDeadLine as best-available placeholder for eventDate 
  // TODO: (optimize later for accuracy)
    const eventDate = toDateOrNull(
      opportunity?.responseDeadLine || opportunity?.responseDeadline,
    );

    const host = opportunity?.fullParentPathName
    || opportunity?.fullParentPathCode ||
    null;

    const location = extractLocation(opportunity);

  return {
    externalId,
    title: opportunity?.title || "No Title",
    source: SourceSystem.SAM,
    summary: null,
    location,
    eventDate,
    host,
    status: computeIndustryDayStatus(eventDate),
  };
}