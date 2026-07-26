ALTER TABLE "alert_channels" ADD COLUMN "provider" varchar(16) DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD COLUMN "scopes" jsonb DEFAULT '["monitor","webhook"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD COLUMN "events" jsonb DEFAULT '["opened","recovered"]'::jsonb NOT NULL;