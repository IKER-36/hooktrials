DROP INDEX "events_endpoint_id_idx";--> statement-breakpoint
DROP INDEX "reports_event_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "events_endpoint_correlation_unique" ON "events" USING btree ("endpoint_id","correlation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_event_id_unique" ON "reports" USING btree ("event_id");