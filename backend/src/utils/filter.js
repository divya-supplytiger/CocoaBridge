import { classificationPrefixes, naicsPrefixes, validCountries, industryDayTitleKeywords, solicitationTitleKeywords } from "./globals.js";
import  { IndustryDayStatus, ContactType, Type, OppTag, SourceSystem } from "@prisma/client";
/*
                "pointOfContact": [
                    {
                        "fax": "",
                        "type": "primary",
                        "email": "christopher.s.russell34.civ@us.navy.mil",
                        "phone": "",
                        "title": null,
                        "fullName": "Christopher Russell"
                    },
*/

export const extractContact = (opportunity) => {
  const contacts = [];
  const noticeId = opportunity?.noticeId || opportunity?.id || "";

  if (Array.isArray(opportunity?.pointOfContact)) {
    opportunity.pointOfContact.forEach((contact) => {
      const parsedType = contact?.type
        ? String(contact.type).trim().toLowerCase()
        : "";
      const type =
        parsedType === "primary"
          ? ContactType.PRIMARY
          : parsedType === "secondary"
            ? ContactType.SECONDARY
            : ContactType.OTHER;

      if (type === ContactType.PRIMARY || type === ContactType.SECONDARY) {
        const fullName = contact?.fullName
          ? String(contact.fullName).trim()
          : null;
        const title = contact?.title ? String(contact.title).trim() : null;
        const email = contact?.email
          ? String(contact.email).trim().toLowerCase()
          : null;
        const phone = contact?.phone ? String(contact.phone).trim() : null;

        if (fullName || email || phone) {
          const externalId = `SAM:${noticeId}:${type}:${email || phone || fullName || "unknown"}`;

          contacts.push({
            fullName,
            title,
            email,
            phone,

            // link
            externalId,
            type,
            source: SourceSystem.SAM,
          });
        }
      }
    });
  }

  return contacts;
};

export const extractType = (opportunity) => {
  const typeField = opportunity?.type || opportunity?.baseType || null;
  if(typeField?.includes("Pre")) return Type.PRE_SOLICITATION;
  if(typeField?.includes("Award")) return Type.AWARD_NOTICE;
  if(typeField?.includes("Source")) return Type.SOURCES_SOUGHT;
  if(typeField?.includes("Special")) return Type.SPECIAL_NOTICE;
  if(typeField?.includes("Solicitation")) return Type.SOLICITATION;
  return Type.OTHER;
};

// todo: implement description extraction logic with api call later
export const extractDescription = (opportunity) => {
    return opportunity?.description || null;
};

export const extractTag = (opportunity) => {
  const title = opportunity?.title ? String(opportunity.title).toLowerCase() : "";
  const industryDayKeywords = titleMatchesKeyword(title, industryDayTitleKeywords);
  if(industryDayKeywords) return OppTag.INDUSTRY_DAY;
  return OppTag.GENERAL;
};

export const toDateOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const computeIndustryDayStatus = (eventDate) => {
  if (!eventDate) return IndustryDayStatus.OPEN;
  const now = new Date();
  const cutoff = eventDate.getTime() + 24 * 60 * 60 * 1000 * 7; // +7 days (temp workaround)

  return cutoff < now.getTime()
    ? IndustryDayStatus.PAST_EVENT
    : IndustryDayStatus.OPEN;
};

// Check if a value starts with any of the given prefixes
export const startsWithAny = (value, prefixes = []) => {
    if(value === null || value === undefined) return false;

    const s = String(value).trim();
    return prefixes.some((p) => s.startsWith(String(p)));
};

// Check if a title indicates an industry day or similar event
export const titleMatchesKeyword = (title, keywords) => {
    if(!title) return false;
    const t = String(title).toLowerCase();
    const matches = keywords.some((kw) => t.includes(String(kw).toLowerCase()));
    return matches;
};

export const isValidCountry = (code) => {
    if(!code) return false;
    const c = String(code).trim().toUpperCase();
    return validCountries.includes(c);
};

export const extractCountry = (item) => {
    const countryFields = [];
    if(item?.placeOfPerformance?.country) countryFields.push(String(item.placeOfPerformance.country.code).trim());
    if(item?.officeAddress?.country) countryFields.push(String(item.officeAddress.countryCode).trim());
    return [...new Set(countryFields.map((x) => x.trim()).filter(Boolean))];
};

// Extract NAICS codes from a SAM.gov item
export const extractNaicsCodes = (item) => {
    // SAM.gov items may have NAICS codes in different fields
    const out = [];
    if(item?.naicsCode) out.push(String(item.naicsCode).trim());
    if(Array.isArray(item?.naicsCodes)) {
        item.naicsCodes.forEach((code) => {
            if(code)out.push(String(code).trim());
        });
    }
    // de-duplicate
    return [...new Set(out.map((x) => x.trim()).filter(Boolean))];

};

// Extract location string from SAM.gov item (for events)
// TODO: improve location accuracy
export const extractLocation = (opportunity) => {
   const locationParts = opportunity?.officeAddress
     ? [
         opportunity?.officeAddress?.city,
         opportunity?.officeAddress?.state,
         opportunity?.officeAddress?.zipcode,
         opportunity?.officeAddress?.countryCode,
       ].filter(Boolean)
     : opportunity?.placeOfPerformance
       ? [
           opportunity?.placeOfPerformance?.city?.name,
           opportunity?.placeOfPerformance?.state?.name,
           opportunity?.placeOfPerformance?.zip,
           opportunity?.placeOfPerformance?.country?.code,
         ].filter(Boolean)
       : [];

    return locationParts.length ? locationParts.join(", ") : null;
};

export const matchesOpportunityIndustryDay = (item) => {
    
    const titleMatch = titleMatchesKeyword(item?.title, industryDayTitleKeywords);

    const countryCodes = extractCountry(item);
    const countryMatch = countryCodes.length === 0 ? true: countryCodes.some(isValidCountry);


    const naicsCodes = extractNaicsCodes(item);
    const naicsMatch = naicsCodes.some((code) => startsWithAny(code, naicsPrefixes));
    const classificiationMatch = startsWithAny(item?.classificationCode, classificationPrefixes);

    // Return true if any criteria match
    return (titleMatch || naicsMatch || classificiationMatch) && countryMatch;
}

export const matchesOpportunitySolicitation = (item) => {
  const titleMatch = titleMatchesKeyword(
    item?.title,
    solicitationTitleKeywords,
  );

  const countryCodes = extractCountry(item);
  const countryMatch =
    countryCodes.length === 0 ? true : countryCodes.some(isValidCountry);

  const naicsCodes = extractNaicsCodes(item);
  const naicsMatch = naicsCodes.some((code) =>
    startsWithAny(code, naicsPrefixes),
  );
  const classificiationMatch = startsWithAny(
    item?.classificationCode,
    classificationPrefixes,
  );

  // Return true if any criteria match
  return (titleMatch || naicsMatch || classificiationMatch) && countryMatch;
};


export const matchesOpportunityHistorical = (item) => {

      const titleMatch = titleMatchesKeyword(
        item?.title,
        solicitationTitleKeywords,
      );
    const countryCodes = extractCountry(item);
    const countryMatch = countryCodes.length === 0 ? true: countryCodes.some(isValidCountry);

    const naicsCodes = extractNaicsCodes(item);
    const naicsMatch = naicsCodes.some((code) => startsWithAny(code, naicsPrefixes));
    const classificiationMatch = startsWithAny(item?.classificationCode, classificationPrefixes);

    return (titleMatch || naicsMatch || classificiationMatch) && countryMatch;
}