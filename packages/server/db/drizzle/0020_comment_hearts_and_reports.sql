CREATE TABLE "comment_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"comment_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	CONSTRAINT "comment_reports_reason_check" CHECK ("comment_reports"."reason" IN ('spam', 'harassment', 'hate', 'misinformation', 'other')),
	CONSTRAINT "comment_reports_resolution_check" CHECK (("comment_reports"."resolved_at" IS NULL) = ("comment_reports"."resolution" IS NULL) AND ("comment_reports"."resolution" IS NULL OR "comment_reports"."resolution" IN ('removed', 'dismissed')))
);
--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "hearted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_video_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."video_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reports_one_per_reporter_idx" ON "comment_reports" USING btree ("comment_id","reporter_id");--> statement-breakpoint
CREATE INDEX "comment_reports_open_comment_idx" ON "comment_reports" USING btree ("comment_id") WHERE "comment_reports"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "comment_reports_queue_idx" ON "comment_reports" USING btree (("resolved_at" IS NULL) DESC,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);