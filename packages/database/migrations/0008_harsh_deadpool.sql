ALTER TABLE "monitors" ADD COLUMN "public_status_token_hash" text;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "public_status_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "monitors_public_status_token_hash_unique" ON "monitors" USING btree ("public_status_token_hash");