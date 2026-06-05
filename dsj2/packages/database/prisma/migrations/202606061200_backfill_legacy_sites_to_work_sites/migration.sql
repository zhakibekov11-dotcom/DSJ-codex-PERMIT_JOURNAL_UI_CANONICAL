-- Preserve the legacy Site table while making its records available to canonical document flows.
INSERT INTO "WorkSite" (
  "id",
  "organizationId",
  "branchId",
  "code",
  "name",
  "location",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-' || legacy_site."id",
  organization."id",
  NULL,
  'LEGACY-' || UPPER(SUBSTRING(MD5(legacy_site."id") FROM 1 FOR 12)),
  legacy_site."name",
  legacy_site."location",
  legacy_site."isActive",
  legacy_site."createdAt",
  legacy_site."updatedAt"
FROM "Site" AS legacy_site
JOIN "Organization" AS organization
  ON organization."id" = legacy_site."companyId"
  OR organization."legacyCompanyId" = legacy_site."companyId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "WorkSite" AS work_site
  WHERE work_site."organizationId" = organization."id"
    AND (
      work_site."id" = 'legacy-' || legacy_site."id"
      OR work_site."name" = legacy_site."name"
    )
)
ON CONFLICT DO NOTHING;
