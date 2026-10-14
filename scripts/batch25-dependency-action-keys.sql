-- Optional ops script: set customer dashboard links on existing dependencies by id suffix.
-- Safe to re-run; does not resolve dependencies or alter milestone completion.

UPDATE "ProjectDependency"
SET "customerActionKey" = 'WEBSITE_REVIEW', "allowsCustomerAck" = false
WHERE id LIKE '%-dep-studies' OR id LIKE '%dep-studies';

UPDATE "ProjectDependency"
SET "customerActionKey" = 'FILES', "allowsCustomerAck" = false
WHERE id LIKE '%-dep-media' OR id LIKE '%dep-media';

UPDATE "ProjectDependency"
SET "customerActionKey" = 'APPROVALS', "allowsCustomerAck" = false
WHERE id LIKE '%-dep-privacy' OR id LIKE '%dep-privacy';
