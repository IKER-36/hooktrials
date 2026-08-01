ALTER TABLE "monitors" ADD COLUMN "slo_target_bps" integer DEFAULT 9990 NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "slo_window_days" integer DEFAULT 7 NOT NULL;