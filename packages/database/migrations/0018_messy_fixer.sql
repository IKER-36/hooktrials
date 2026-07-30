ALTER TABLE "incidents" ADD COLUMN "assignee_user_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_assignee_user_id_idx" ON "incidents" USING btree ("assignee_user_id");