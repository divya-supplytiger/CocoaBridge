# Backend
-- DATA INNSERTED FROM SAM.GOV, USASPENDING
-- DATA NORMALIZED AND STORED IN DB AS OPP OR AWARD, RELEVANT ENTITIES (RECEIPTIENTS, CONTACTS, BUYING AGENCIES, IF AN OPP is an industry day ) ARE UPSERTED AS WELL
-- OPP are parsed (opp only) if they have attachments (included in SAM API CALL result). Include info on parsing process
-- SCORING ALG: OPPS AND AWARDS and then scoring using a determinstic alg that checks FLIS Items alignment, if the description aligns with supplytiger aligned keywords, PSC Codes, etc. if scored high enough, added as an inbpx (work ticket) item because it's an opp worth our interest.
- If scored high enough, these parsed docs are stored into our db 
-- ONly manual data that was inserted was the FLIS items, which were inserted via an SQL query. These items were gathered from PUBLOG!
-- DAILY INNGEST CRON FUNCTIONS TRIGGERED TO INNGEST TO FETCH EXTERNAL DATA(THESE FUNCTIONS HAVE A MANUAL EQUIVALENT TRIGGERABLE IN ADMIN panel)

# Frontend
- Login/Account creation process
- Admin Actions (in moderate depth): access control, keyword config/filters, trigger inngest jobs manually without waiting (useful for testing), track system health, company profile, chat retention,

# Page Breakdowns (all subpages):
1. Dashboard
2. Inbox
3. Awards
4. Opps
5. Market
6. Contacts
7. Analytics
8. Metrics
9. CHAT
10. Favorites

# Detailed Views:
1. Inbox: Matched signals, notes tracking/logging, edit form, link to opp
2. Opp: link to inbox item, rlevant contacts, agency link, external link, parsed docs if any, fav toggle
3. Award: link to inbox item, rlevant recipient, agency link, external link, fav toggle
4. Recipeint: Related records with awards, edit
5. Buying org: edit, related recs with opps, parent and child organizations listed
6. FLIS item: NSN, NIIN, desc, etc.
7. Contact: email, phone, edit, related opps, and buying orgs, outreach log, if no associated opps, the contact is marked orphaned and can be deleted. (since potentially no longer useful for SupplyTiger)
8. Industry Day: opp type with link to opp, edit (to update status)
- Calendar: both views: industry days

# MCP (seperately hosted to maintain speration of concerns and reduce latency)
- See MCP.readme for more info