CREATE TABLE "channel_featured_videos" (
	"channel_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_featured_videos_channel_id_video_id_pk" PRIMARY KEY("channel_id","video_id"),
	CONSTRAINT "channel_featured_videos_channel_position_key" UNIQUE("channel_id","position"),
	CONSTRAINT "channel_featured_videos_position_check" CHECK ("channel_featured_videos"."position" BETWEEN 0 AND 5)
);
--> statement-breakpoint
ALTER TABLE "channel_featured_videos" ADD CONSTRAINT "channel_featured_videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_featured_videos" ADD CONSTRAINT "channel_featured_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;