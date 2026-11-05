CREATE TYPE "public"."live_stream_status" AS ENUM('IDLE', 'LIVE', 'ENDED');--> statement-breakpoint
ALTER TYPE "public"."video_status" ADD VALUE 'LIVE';--> statement-breakpoint
CREATE TABLE "live_chat_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"live_stream_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"offset_ms" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "live_chat_messages_length_check" CHECK (char_length("live_chat_messages"."message") BETWEEN 1 AND 200),
	CONSTRAINT "live_chat_messages_offset_check" CHECK ("live_chat_messages"."offset_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stream_key" text,
	"status" "live_stream_status" DEFAULT 'IDLE' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"archive_visibility" text DEFAULT 'public' NOT NULL,
	"overlay_token" text,
	"control_token" text,
	"current_viewers" integer DEFAULT 0 NOT NULL,
	"chat_slow_mode_seconds" integer DEFAULT 0 NOT NULL,
	"chat_subscribers_only" boolean DEFAULT false NOT NULL,
	"markers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"stop_requested_at" timestamp with time zone,
	"video_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_streams_overlay_token_unique" UNIQUE("overlay_token"),
	CONSTRAINT "live_streams_control_token_unique" UNIQUE("control_token"),
	CONSTRAINT "live_streams_video_id_unique" UNIQUE("video_id"),
	CONSTRAINT "live_streams_slow_mode_check" CHECK ("live_streams"."chat_slow_mode_seconds" BETWEEN 0 AND 300)
);
--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_live_stream_id_live_streams_id_fk" FOREIGN KEY ("live_stream_id") REFERENCES "public"."live_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_chat_messages_stream_id_idx" ON "live_chat_messages" USING btree ("live_stream_id","id");--> statement-breakpoint
CREATE INDEX "live_chat_messages_stream_offset_idx" ON "live_chat_messages" USING btree ("live_stream_id","offset_ms","id");--> statement-breakpoint
CREATE INDEX "live_streams_channel_status_idx" ON "live_streams" USING btree ("channel_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "live_streams_stream_key_key" ON "live_streams" USING btree ("stream_key");--> statement-breakpoint
CREATE UNIQUE INDEX "live_streams_one_open_per_channel" ON "live_streams" USING btree ("channel_id") WHERE "live_streams"."status" IN ('IDLE', 'LIVE');--> statement-breakpoint
CREATE INDEX "live_streams_live_now_idx" ON "live_streams" USING btree ("started_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "live_streams"."status" = 'LIVE';