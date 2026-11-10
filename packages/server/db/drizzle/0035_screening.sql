ALTER TYPE "public"."video_status" ADD VALUE 'HELD';--> statement-breakpoint
CREATE TABLE "screening_appeals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"screening_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"message" text NOT NULL,
	"rejected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "video_audio_fingerprints" (
	"video_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"term" integer NOT NULL,
	CONSTRAINT "video_audio_fingerprints_video_id_idx_pk" PRIMARY KEY("video_id","idx")
);
--> statement-breakpoint
CREATE TABLE "video_frame_hashes" (
	"video_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"hash" bigint NOT NULL,
	"b0" integer NOT NULL,
	"b1" integer NOT NULL,
	"b2" integer NOT NULL,
	"b3" integer NOT NULL,
	CONSTRAINT "video_frame_hashes_video_id_idx_pk" PRIMARY KEY("video_id","idx")
);
--> statement-breakpoint
CREATE TABLE "video_screenings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"source_checksum" text NOT NULL,
	"outcome" text NOT NULL,
	"score" double precision NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_version" text,
	"threshold_version" text NOT NULL,
	"decision" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_screenings_outcome_check" CHECK ("video_screenings"."outcome" IN ('PASS', 'HOLD')),
	CONSTRAINT "video_screenings_decision_check" CHECK ("video_screenings"."decision" IS NULL OR "video_screenings"."decision" IN ('approved', 'rejected', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "screening_appeals" ADD CONSTRAINT "screening_appeals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_appeals" ADD CONSTRAINT "screening_appeals_screening_id_video_screenings_id_fk" FOREIGN KEY ("screening_id") REFERENCES "public"."video_screenings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_appeals" ADD CONSTRAINT "screening_appeals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_appeals" ADD CONSTRAINT "screening_appeals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_appeals" ADD CONSTRAINT "screening_appeals_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_audio_fingerprints" ADD CONSTRAINT "video_audio_fingerprints_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_frame_hashes" ADD CONSTRAINT "video_frame_hashes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_screenings" ADD CONSTRAINT "video_screenings_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_screenings" ADD CONSTRAINT "video_screenings_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screening_appeals_video_idx" ON "screening_appeals" USING btree ("video_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "screening_appeals_open_idx" ON "screening_appeals" USING btree ("video_id") WHERE "screening_appeals"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "video_audio_fingerprints_term_idx" ON "video_audio_fingerprints" USING btree ("term");--> statement-breakpoint
CREATE INDEX "video_frame_hashes_b0_idx" ON "video_frame_hashes" USING btree ("b0");--> statement-breakpoint
CREATE INDEX "video_frame_hashes_b1_idx" ON "video_frame_hashes" USING btree ("b1");--> statement-breakpoint
CREATE INDEX "video_frame_hashes_b2_idx" ON "video_frame_hashes" USING btree ("b2");--> statement-breakpoint
CREATE INDEX "video_frame_hashes_b3_idx" ON "video_frame_hashes" USING btree ("b3");--> statement-breakpoint
CREATE UNIQUE INDEX "video_screenings_video_checksum_idx" ON "video_screenings" USING btree ("video_id","source_checksum");--> statement-breakpoint
CREATE INDEX "video_screenings_open_idx" ON "video_screenings" USING btree ("created_at" DESC NULLS LAST) WHERE "video_screenings"."decision" IS NULL AND ("video_screenings"."outcome" = 'HOLD' OR "video_screenings"."flags" <> '[]'::jsonb);