import { SourceSystem } from "@prisma/client";
import { toDateOrNull, computeIndustryDayStatus, extractLocation, extractNaicsCodes, extractContact, extractType, extractDescription, extractTag} from "../utils/filter.js";
import { normalize } from "path";

// todo: normalize SAM Opportunity data from SAM API, extract contact info, description, type or baseType, all naics codes or naics code, location
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
  const externalEventId = opportunity?.noticeId || opportunity?.id || null;
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
    externalEventId,
    title: opportunity?.title || "No Title",
    source: SourceSystem.SAM,
    summary: null,
    location,
    eventDate,
    host,
    status: computeIndustryDayStatus(eventDate),
  };
}