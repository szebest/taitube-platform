CREATE TABLE "picks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "picks_window_check" CHECK ("picks"."ends_at" > "picks"."starts_at"),
	CONSTRAINT "picks_note_check" CHECK ("picks"."note" IS NULL OR char_length("picks"."note") BETWEEN 1 AND 280)
);
--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "picks_starts_at_idx" ON "picks" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "picks_video_idx" ON "picks" USING btree ("video_id");--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_window_no_overlap" EXCLUDE USING gist (tstzrange("starts_at", "ends_at") WITH &&);