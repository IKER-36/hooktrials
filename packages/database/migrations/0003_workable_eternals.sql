CREATE TYPE "public"."integration_environment" AS ENUM('test', 'staging', 'production');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'recovered');--> statement-breakpoint
CREATE TYPE "public"."monitor_method" AS ENUM('GET', 'HEAD', 'POST');--> statement-breakpoint
CREATE TYPE "public"."monitor_outcome" AS ENUM('healthy', 'degraded', 'down');--> statement-breakpoint
CREATE TYPE "public"."monitor_state" AS ENUM('new', 'healthy', 'degraded', 'down', 'paused');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('external_api', 'internal_api', 'http_route', 'webhook_route', 'webhook_destination');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"cause" varchar(32) NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"name" varchar(80) NOT NULL,
	"environment" "integration_environment" DEFAULT 'test' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"outcome" "monitor_outcome" NOT NULL,
	"error_category" varchar(32),
	"contract_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"encrypted_url" text NOT NULL,
	"display_host" varchar(255) NOT NULL,
	"method" "monitor_method" DEFAULT 'GET' NOT NULL,
	"encrypted_headers" text,
	"interval_seconds" integer DEFAULT 300 NOT NULL,
	"timeout_ms" integer DEFAULT 10000 NOT NULL,
	"expected_min_status" integer DEFAULT 200 NOT NULL,
	"expected_max_status" integer DEFAULT 299 NOT NULL,
	"expected_text" varchar(256),
	"expected_json_path" varchar(255),
	"consecutive_failures_to_open" integer DEFAULT 2 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"allow_private_networks" boolean DEFAULT false NOT NULL,
	"allowed_private_cidrs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "monitor_state" DEFAULT 'new' NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resource_id_integration_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."integration_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_resources" ADD CONSTRAINT "integration_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD CONSTRAINT "monitor_checks_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_resource_id_integration_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."integration_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_resource_id_idx" ON "incidents" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_resources_user_id_idx" ON "integration_resources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "monitor_checks_monitor_id_idx" ON "monitor_checks" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "monitor_checks_started_at_idx" ON "monitor_checks" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monitors_resource_id_unique" ON "monitors" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "monitors_next_check_at_idx" ON "monitors" USING btree ("next_check_at");