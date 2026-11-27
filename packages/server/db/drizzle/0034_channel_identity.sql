CREATE TABLE "channel_handle_history" (
	"handle" text PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"retired_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_image_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"width" integer,
	"height" integer,
	"crops" jsonb,
	"version" integer,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_image_uploads_version_key" UNIQUE("channel_id","kind","version"),
	CONSTRAINT "channel_image_uploads_kind_check" CHECK ("channel_image_uploads"."kind" IN ('avatar', 'banner')),
	CONSTRAINT "channel_image_uploads_status_check" CHECK ("channel_image_uploads"."status" IN ('issued', 'queued', 'ready', 'failed', 'superseded', 'purged'))
);
--> statement-breakpoint
CREATE TABLE "channel_localizations" (
	"channel_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"description" text,
	"trailer_video_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_localizations_channel_id_locale_pk" PRIMARY KEY("channel_id","locale")
);
--> statement-breakpoint
CREATE TABLE "channel_page_settings" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"trailer_video_id" uuid,
	"returning_video_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "avatar_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner_crops" jsonb;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner_link" jsonb;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "handle_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "kind" text DEFAULT 'playlist' NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_handle_history" ADD CONSTRAINT "channel_handle_history_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_image_uploads" ADD CONSTRAINT "channel_image_uploads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_image_uploads" ADD CONSTRAINT "channel_image_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_localizations" ADD CONSTRAINT "channel_localizations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_localizations" ADD CONSTRAINT "channel_localizations_trailer_video_id_videos_id_fk" FOREIGN KEY ("trailer_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_page_settings" ADD CONSTRAINT "channel_page_settings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_page_settings" ADD CONSTRAINT "channel_page_settings_trailer_video_id_videos_id_fk" FOREIGN KEY ("trailer_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_page_settings" ADD CONSTRAINT "channel_page_settings_returning_video_id_videos_id_fk" FOREIGN KEY ("returning_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_handle_history_retired_at_idx" ON "channel_handle_history" USING btree ("retired_at");--> statement-breakpoint
CREATE INDEX "channel_image_uploads_channel_idx" ON "channel_image_uploads" USING btree ("channel_id","kind");--> statement-breakpoint
CREATE INDEX "channel_image_uploads_status_idx" ON "channel_image_uploads" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_kind_check" CHECK ("playlists"."kind" IN ('playlist', 'series'));