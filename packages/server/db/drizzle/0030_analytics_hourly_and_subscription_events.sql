CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"delta" smallint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_events_delta_check" CHECK ("subscription_events"."delta" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "video_views_hourly" (
	"video_id" uuid NOT NULL,
	"view_hour" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "video_views_hourly_video_id_view_hour_pk" PRIMARY KEY("video_id","view_hour")
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_views_hourly" ADD CONSTRAINT "video_views_hourly_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_events_channel_occurred_idx" ON "subscription_events" USING btree ("channel_id","occurred_at");--> statement-breakpoint
CREATE INDEX "video_views_hourly_hour_idx" ON "video_views_hourly" USING btree ("view_hour");--> statement-breakpoint
INSERT INTO "subscription_events" ("id", "channel_id", "delta", "occurred_at")
SELECT gen_random_uuid(), "channel_id", 1, "created_at" FROM "channel_subscriptions";