ALTER TYPE "public"."auth_token_purpose" ADD VALUE 'email_change' BEFORE 'password_reset';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email" varchar(254);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(512);