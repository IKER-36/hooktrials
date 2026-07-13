ALTER TABLE "destination_deliveries" ADD COLUMN "requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD COLUMN "replay_of_delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD COLUMN "audit_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "retry_max_attempts" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "retry_base_delay_ms" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "retry_max_delay_ms" integer DEFAULT 300000 NOT NULL;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD CONSTRAINT "destination_deliveries_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;