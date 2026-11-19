CREATE TABLE "video_views_device_daily" (
	"video_id" uuid NOT NULL,
	"view_date" date NOT NULL,
	"device" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "video_views_device_daily_video_id_view_date_device_pk" PRIMARY KEY("video_id","view_date","device"),
	CONSTRAINT "video_views_device_daily_device_check" CHECK ("video_views_device_daily"."device" IN ('desktop', 'mobile', 'tablet', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "video_views_device_daily" ADD CONSTRAINT "video_views_device_daily_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;