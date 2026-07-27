ALTER TABLE "attempts" ADD COLUMN "encrypted_headers" text;--> statement-breakpoint
-- Remove legacy plaintext request metadata before the new encrypted capture path is used.
UPDATE "attempts"
SET
  "headers" = '{}'::jsonb,
  "path" = regexp_replace(split_part("path", '?', 1), '^/i/[^/]+', '/i/:token');
