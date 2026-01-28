import {SourceSystem} from "@prisma/client";

/* Structure of an Opportunity */
/* model Opportunity {
  id     String       @id @default(cuid())
  source SourceSystem @default(SAM)

  // Dedup for SAM
  noticeId           String? @unique
  solicitationNumber String?
  title              String?
  type               Type?
  tag                OppTag  @default(GENERAL)
  active             Boolean @default(true)

  description String?

  postedDate       DateTime?
  responseDeadline DateTime?

  // Classification
  naicsCodes String[] @default([])
  pscCode    String?
  setAside   String? // store raw like "NONE", "SBA", etc.

  // Org / office metadata
  fullParentPathName String?
  city               String?
  state              String?
  zip                String?
  countryCode        String?

  // Relationships
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  // Inbox workflow
  inboxItems InboxItem[]

  // Contacts scraped from SAM for this opportunity (optional but useful)
  contactLinks ContactLink[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  industryDay IndustryDay?

  @@index([postedDate])
  @@index([responseDeadline])
  @@index([naicsCodes], type: Gin)
  @@index([pscCode])
  @@index([type])
  @@index([solicitationNumber])
  @@index([title])
} */

/* Structure of an Award */
/* model Award {
  id     String       @id @default(cuid())
  source SourceSystem @default(USASPENDING)

  externalAwardId String? @unique
  awardingAgency  String?
  awardingOffice  String?

  naicsCodes String[] @default([])
  pscCode    String?

  obligatedAmount Decimal?  @db.Decimal(18, 2)
  startDate       DateTime?
  endDate         DateTime?

  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  inboxItems InboxItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([startDate])
  @@index([endDate])
  @@index([naicsCodes], type: Gin)
  @@index([pscCode])
} */

/* Structure of a normalized USAspending Award object:
*/
/*
    {
        "internal_id": 353122771,
        "Award ID": "15B11426P00000008",
        "Recipient Name": "UNION SUPPLY GROUP, INC.",
        "Award Amount": 15680,
        "Description": "FY 26 HOLIDAY BAGS C5",
        "Contract Award Type": "PURCHASE ORDER",
        "Recipient UEI": "DXM9X66ZLR61",
        "Recipient Location": {
        "location_country_code": "USA",
        "country_name": "UNITED STATES",
        "state_code": "TX",
        "state_name": "Texas",
        "city_name": "DALLAS",
        "county_code": "113",
        "county_name": "DALLAS",
        "address_line1": "2500 REGENT BLVD",
        "address_line2": null,
        "address_line3": null,
        "congressional_code": "24",
        "zip4": "4401",
        "zip5": "75261",
        "foreign_postal_code": null,
        "foreign_province": null
        },
        "Primary Place of Performance": {
            "location_country_code": "USA",
            "country_name": "UNITED STATES",
            "state_code": "VA",
            "state_name": "Virginia",
            "city_name": "HOPEWELL",
            "county_code": "670",
            "county_name": "HOPEWELL CITY",
            "congressional_code": "04",
            "zip4": "238605900",
            "zip5": "23860"
        },
            "def_codes": null,
            "Awarding Agency": "Department of Justice",
            "Awarding Sub Agency": "Federal Prison System / Bureau of Prisons",
            "Start Date": "2025-11-24",
            "End Date": "2025-11-24",
            "NAICS": {
                "code": "424450",
                "description": "CONFECTIONERY MERCHANT WHOLESALERS"
            },
            "PSC": {
                "code": "8925",
                "description": "SUGAR, CONFECTIONERY, AND NUTS"
            },
            "recipient_id": "b48bbdf1-ac73-bc80-98a4-dd8a0f22a94f-C",
            "prime_award_recipient_id": null,
            "awarding_agency_id": 252,
            "agency_slug": "department-of-justice",
            "generated_internal_id": "CONT_AWD_15B11426P00000008_1540_-NONE-_-NONE-"
        },
    */
        
/* model Organization {
  id       String  @id @default(cuid())
  name     String
  uei      String? @unique
  cageCode String?
  website  String?

  contactLinks ContactLink[]

  inboxItems    InboxItem[]
  awards        Award[]
  industryDay   IndustryDay[]
  opportunities Opportunity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
  @@index([cageCode])
}
  */