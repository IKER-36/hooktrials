CREATE TYPE "public"."delivery_kind" AS ENUM('forward', 'retry', 'replay');--> statement-breakpoint
CREATE TYPE "public"."delivery_state" AS ENUM('queued', 'delivering', 'succeeded', 'failed', 'retrying', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."endpoint_mode" AS ENUM('trial', 'observe', 'protect');--> statement-breakpoint
CREATE TABLE "destination_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"inbound_attempt_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"kind" "delivery_kind" DEFAULT 'forward' NOT NULL,
	"state" "delivery_state" DEFAULT 'delivering' NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"error_category" varchar(32),
	"error_message" varchar(512),
	"next_attempt_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "resource_id" uuid;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "mode" "endpoint_mode" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "environment" "integration_environment" DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "encrypted_destination_url" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "encrypted_destination_headers" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "display_destination_host" varchar(255);--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "destination_timeout_ms" integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "allow_private_networks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "allowed_private_cidrs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "production_confirmed_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "integration_resources" ("id", "user_id", "type", "name", "environment", "active", "metadata", "created_at", "updated_at")
SELECT gen_random_uuid(), "user_id", 'webhook_route', "name", 'test', "active", jsonb_build_object('endpointId', "id"::text), "created_at", now()
FROM "endpoints";--> statement-breakpoint
UPDATE "endpoints" AS endpoint
SET "resource_id" = resource."id"
FROM "integration_resources" AS resource
WHERE resource."metadata"->>'endpointId' = endpoint."id"::text;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD CONSTRAINT "destination_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD CONSTRAINT "destination_deliveries_inbound_attempt_id_attempts_id_fk" FOREIGN KEY ("inbound_attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_deliveries" ADD CONSTRAINT "destination_deliveries_resource_id_integration_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."integration_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "destination_deliveries_event_id_idx" ON "destination_deliveries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "destination_deliveries_attempt_id_idx" ON "destination_deliveries" USING btree ("inbound_attempt_id");--> statement-breakpoint
CREATE INDEX "destination_deliveries_resource_id_idx" ON "destination_deliveries" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "destination_deliveries_state_idx" ON "destination_deliveries" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_resource_id_unique" ON "endpoints" USING btree ("resource_id");
