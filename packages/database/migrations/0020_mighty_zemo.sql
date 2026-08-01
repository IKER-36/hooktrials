CREATE TYPE "public"."delivery_strategy" AS ENUM('single', 'fanout', 'failover');--> statement-breakpoint
CREATE TYPE "public"."idempotency_scope" AS ENUM('destination', 'event');--> statement-breakpoint
ALTER TYPE "public"."delivery_kind" ADD VALUE 'failover';--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "delivery_strategy" "delivery_strategy" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "idempotency_scope" "idempotency_scope" DEFAULT 'destination' NOT NULL;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN "encrypted_delivery_policy" text;