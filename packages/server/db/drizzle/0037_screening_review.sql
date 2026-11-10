DROP INDEX "video_screenings_open_idx";--> statement-breakpoint
ALTER TABLE "video_screenings" ADD COLUMN "flags_cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_screenings" ADD COLUMN "evidence_purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "video_screenings_purge_idx" ON "video_screenings" USING btree ("decided_at") WHERE "video_screenings"."decision" IS NOT NULL AND "video_screenings"."evidence_purged_at" IS NULL;--> statement-breakpoint
CREATE INDEX "video_screenings_open_idx" ON "video_screenings" USING btree ("created_at" DESC NULLS LAST) WHERE ("video_screenings"."decision" IS NULL AND "video_screenings"."outcome" = 'HOLD') OR ("video_screenings"."flags" <> '[]'::jsonb AND "video_screenings"."flags_cleared_at" IS NULL);