CREATE TABLE "video_view_batches" (
	"batch_id" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_views_daily" (
	"video_id" uuid NOT NULL,
	"view_date" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"watch_seconds" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "video_views_daily_video_id_view_date_pk" PRIMARY KEY("video_id","view_date")
);
--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "views_count" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "video_views_daily" ADD CONSTRAINT "video_views_daily_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_view_batches_applied_at_idx" ON "video_view_batches" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "video_views_daily_date_video_idx" ON "video_views_daily" USING btree ("view_date" DESC NULLS LAST,"video_id");--> statement-breakpoint
CREATE INDEX "videos_views_count_idx" ON "videos" USING btree ("views_count" DESC NULLS LAST);