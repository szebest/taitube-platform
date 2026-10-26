CREATE TABLE "video_retention_milestones" (
	"video_id" uuid NOT NULL,
	"percent" smallint NOT NULL,
	"viewers" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "video_retention_milestones_video_id_percent_pk" PRIMARY KEY("video_id","percent")
);
--> statement-breakpoint
ALTER TABLE "video_retention_milestones" ADD CONSTRAINT "video_retention_milestones_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;