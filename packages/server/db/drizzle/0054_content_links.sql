CREATE TABLE "channel_link_settings" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"link_policy" text DEFAULT 'approve' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_link_settings_policy_check" CHECK ("channel_link_settings"."link_policy" IN ('allow', 'approve', 'block'))
);
--> statement-breakpoint
CREATE TABLE "content_link_dismissals" (
	"channel_id" uuid NOT NULL,
	"suggestion_key" text NOT NULL,
	"dismissed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_link_dismissals_channel_id_suggestion_key_pk" PRIMARY KEY("channel_id","suggestion_key")
);
--> statement-breakpoint
CREATE TABLE "content_link_stats_daily" (
	"link_id" uuid NOT NULL,
	"day" date NOT NULL,
	"impressions" bigint DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"watch_seconds" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "content_link_stats_daily_link_id_day_pk" PRIMARY KEY("link_id","day")
);
--> statement-breakpoint
CREATE TABLE "content_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_aux_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_aux_id" uuid,
	"relation" text NOT NULL,
	"params" jsonb NOT NULL,
	"source_start_ms" integer,
	"source_end_ms" integer,
	"target_start_ms" integer,
	"target_end_ms" integer,
	"status" text NOT NULL,
	"source_channel_id" uuid NOT NULL,
	"target_channel_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_links_source_type_check" CHECK ("content_links"."source_type" IN ('video', 'clip', 'post', 'thread', 'playlist', 'live', 'episode')),
	CONSTRAINT "content_links_target_type_check" CHECK ("content_links"."target_type" IN ('video', 'clip', 'post', 'thread', 'playlist', 'live', 'episode')),
	CONSTRAINT "content_links_relation_check" CHECK ("content_links"."relation" IN ('full_video', 'part_of', 'previous', 'follow_up', 'recap', 'extended_cut', 'behind_the_scenes', 'translation', 'corrects', 'response_to', 'reaction_to', 'remix_of', 'discussion', 'related')),
	CONSTRAINT "content_links_status_check" CHECK ("content_links"."status" IN ('active', 'pending', 'declined', 'suggested', 'broken')),
	CONSTRAINT "content_links_params_relation_check" CHECK ("content_links"."params" ->> 'relation' = "content_links"."relation"),
	CONSTRAINT "content_links_source_span_check" CHECK ("content_links"."source_end_ms" IS NULL OR ("content_links"."source_start_ms" IS NOT NULL AND "content_links"."source_end_ms" > "content_links"."source_start_ms")),
	CONSTRAINT "content_links_target_span_check" CHECK ("content_links"."target_end_ms" IS NULL OR ("content_links"."target_start_ms" IS NOT NULL AND "content_links"."target_end_ms" > "content_links"."target_start_ms"))
);
--> statement-breakpoint
CREATE TABLE "video_end_screens" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"layout" text NOT NULL,
	"starts_at_ms" integer NOT NULL,
	"items" jsonb NOT NULL,
	"show_subscribe" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_end_screens_layout_check" CHECK ("video_end_screens"."layout" IN ('grid', 'row', 'hero')),
	CONSTRAINT "video_end_screens_items_check" CHECK (jsonb_array_length("video_end_screens"."items") <= 4)
);
--> statement-breakpoint
ALTER TABLE "channel_link_settings" ADD CONSTRAINT "channel_link_settings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_link_dismissals" ADD CONSTRAINT "content_link_dismissals_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_link_dismissals" ADD CONSTRAINT "content_link_dismissals_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_link_stats_daily" ADD CONSTRAINT "content_link_stats_daily_link_id_content_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."content_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_source_channel_id_channels_id_fk" FOREIGN KEY ("source_channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_target_channel_id_channels_id_fk" FOREIGN KEY ("target_channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_links" ADD CONSTRAINT "content_links_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_end_screens" ADD CONSTRAINT "video_end_screens_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_links_source_target_relation_unique" ON "content_links" USING btree ("source_type","source_id",coalesce("source_aux_id", '00000000-0000-0000-0000-000000000000'::uuid),"target_type","target_id",coalesce("target_aux_id", '00000000-0000-0000-0000-000000000000'::uuid),"relation");--> statement-breakpoint
CREATE INDEX "content_links_source_idx" ON "content_links" USING btree ("source_type","source_id","status");--> statement-breakpoint
CREATE INDEX "content_links_target_idx" ON "content_links" USING btree ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "content_links_queue_idx" ON "content_links" USING btree ("target_channel_id","status","created_at");--> statement-breakpoint
CREATE INDEX "content_links_source_channel_idx" ON "content_links" USING btree ("source_channel_id","status");