-- Prevent null-null Favorite rows: exactly one of opportunityId or awardId must be set
ALTER TABLE "Favorite"
  ADD CONSTRAINT "Favorite_one_entity_required"
  CHECK (
    ("opportunityId" IS NOT NULL AND "awardId" IS NULL) OR
    ("opportunityId" IS NULL AND "awardId" IS NOT NULL)
  );
