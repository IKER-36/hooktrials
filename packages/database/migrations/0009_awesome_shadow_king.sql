CREATE TYPE "public"."monitor_protocol" AS ENUM('http', 'icmp');--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'icmp_host';--> statement-breakpoint
CREATE TABLE "status_page_monitors" (
	"page_id" uuid NOT NULL,
	"monitor_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"headline" varchar(120) NOT NULL,
	"description" varchar(500),
	"accent_color" varchar(7) DEFAULT '#36e37e' NOT NULL,
	"public_token_hash" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "protocol" "monitor_protocol" DEFAULT 'http' NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "status_page_monitors_page_monitor_unique" ON "status_page_monitors" USING btree ("page_id","monitor_id");--> statement-breakpoint
CREATE INDEX "status_page_monitors_page_position_idx" ON "status_page_monitors" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "status_page_monitors_monitor_id_idx" ON "status_page_monitors" USING btree ("monitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "status_pages_public_token_hash_unique" ON "status_pages" USING btree ("public_token_hash");--> statement-breakpoint
CREATE INDEX "status_pages_user_id_idx" ON "status_pages" USING btree ("user_id");