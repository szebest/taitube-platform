CREATE TYPE "public"."caption_kind" AS ENUM('auto', 'edited', 'uploaded');--> statement-breakpoint
CREATE TYPE "public"."caption_status" AS ENUM('pending', 'ready', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "video_captions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"language" text,
	"detected_language" text,
	"kind" "caption_kind" NOT NULL,
	"status" "caption_status" NOT NULL,
	"model_version" text,
	"reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_transcript_cues" (
	"caption_id" uuid NOT NULL,
	"cue_index" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "video_transcript_cues_caption_id_cue_index_pk" PRIMARY KEY("caption_id","cue_index")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "auto_captions_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "auto_captions" boolean;--> statement-breakpoint
ALTER TABLE "video_captions" ADD CONSTRAINT "video_captions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_transcript_cues" ADD CONSTRAINT "video_transcript_cues_caption_id_video_captions_id_fk" FOREIGN KEY ("caption_id") REFERENCES "public"."video_captions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_captions_video_language_idx" ON "video_captions" USING btree ("video_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "video_captions_generated_idx" ON "video_captions" USING btree ("video_id") WHERE "video_captions"."kind" <> 'uploaded';--> statement-breakpoint
CREATE INDEX "video_captions_pending_idx" ON "video_captions" USING btree ("updated_at") WHERE "video_captions"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "video_transcript_cues" ADD COLUMN "text_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "text")) STORED;--> statement-breakpoint
CREATE INDEX "video_transcript_cues_text_vector_idx" ON "video_transcript_cues" USING gin ("text_vector");