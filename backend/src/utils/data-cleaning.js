import { SourceSystem, IndustryDayStatus } from "@prisma/client";

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

  const locationParts = opportunity?.officeAddress ? [
    opportunity?.officeAddress?.city,
    opportunity?.officeAddress?.state,
    opportunity?.officeAddress?.zipcode,
    opportunity?.officeAddress?.countryCode,
  ].filter(Boolean) : opportunity?.placeOfPerformance ? [
    opportunity?.placeOfPerformance?.city?.name,
    opportunity?.placeOfPerformance?.state?.name,
    opportunity?.placeOfPerformance?.zip,
    opportunity?.placeOfPerformance?.country?.code,
  ].filter(Boolean) : [];

    const location = locationParts.length ? locationParts.join(", ") : null;

  return {
    externalEventId,
    title: opportunity?.title || "No Title",
    source: SourceSystem.SAM,
    summary: null,
    location,
    eventDate,
    host,
    status: computeIndustryDayStatus(eventDate),
    rawPayload: opportunity,
  };
}

export const toDateOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null: d;
};

export const computeIndustryDayStatus = (eventDate) => {
  if (!eventDate) return IndustryDayStatus.OPEN;
  const now = new Date();
  const cutoff = eventDate.getTime() + (24 * 60 * 60 * 1000) * 7; // +7 days (temp workaround)

  return cutoff < now.getTime()
    ? IndustryDayStatus.PAST_EVENT
    : IndustryDayStatus.OPEN;
};