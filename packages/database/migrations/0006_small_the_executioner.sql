CREATE TYPE "public"."alert_event" AS ENUM('opened', 'recovered');--> statement-breakpoint
CREATE TYPE "public"."alert_state" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."signature_provider" AS ENUM('none', 'github', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."signature_status" AS ENUM('not_configured', 'valid', 'invalid', 'missing', 'stale');--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_url" text NOT NULL,
	"display_host" varchar(255) NOT NULL,
	"encrypted_headers" text,
	"active" boolean DEFAULT true NOT NULL,
	"allow_private_networks" boolean DEFAULT false NOT NULL,
	"allowed_private_cidrs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"event" "alert_event" NOT NULL,
	"state" "alert_state" DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"error_category" varchar(32),
	"attempted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "contract_result" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "signature_provider" "signature_provider" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "signature_status" "signature_status" DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "encrypted_contract" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "signature_provider" "signature_provider" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "encrypted_signature_secret" text;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "signature_tolerance_seconds" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "destination_expected_min_status" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "destination_expected_max_status" integer DEFAULT 299 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "public_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_channels_user_id_unique" ON "alert_channels" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_deliveries_incident_event_unique" ON "alert_deliveries" USING btree ("incident_id","event");--> statement-breakpoint
CREATE INDEX "alert_deliveries_state_idx" ON "alert_deliveries" USING btree ("state");