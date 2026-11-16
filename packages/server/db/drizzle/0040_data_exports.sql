CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"requested_by" uuid,
	"kind" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"object_key" text,
	"row_count" integer,
	"failure" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_exports_kind_check" CHECK ("data_exports"."kind" IN ('video_analytics', 'channel_analytics', 'comments', 'videos')),
	CONSTRAINT "data_exports_format_check" CHECK ("data_exports"."format" IN ('csv', 'json')),
	CONSTRAINT "data_exports_status_check" CHECK ("data_exports"."status" IN ('queued', 'running', 'ready', 'failed', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_events_check";--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_exports_one_active_idx" ON "data_exports" USING btree ("channel_id") WHERE "data_exports"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "data_exports_channel_newest_idx" ON "data_exports" USING btree ("channel_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "data_exports_ready_expiry_idx" ON "data_exports" USING btree ("expires_at") WHERE "data_exports"."status" = 'ready';--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_events_check" CHECK (cardinality("webhooks"."events") >= 1 AND "webhooks"."events" <@ ARRAY['video.ready', 'live.started', 'export.ready']::text[]);