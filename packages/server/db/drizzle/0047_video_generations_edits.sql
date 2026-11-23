CREATE TABLE "video_edits" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"base_generation" integer NOT NULL,
	"generation" integer NOT NULL,
	"trim" jsonb,
	"blurs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_edits_status_check" CHECK ("video_edits"."status" IN ('rendering', 'applied', 'failed', 'reverted')),
	CONSTRAINT "video_edits_blurs_check" CHECK (jsonb_array_length("video_edits"."blurs") <= 20)
);
--> statement-breakpoint
CREATE TABLE "video_generations" (
	"video_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"source_key" text,
	"base_generation" integer,
	"replaces_generation" integer NOT NULL,
	"playback" jsonb,
	"timeline" jsonb,
	"retention" jsonb,
	"needs_review" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"lock_token" uuid,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_generations_video_id_generation_pk" PRIMARY KEY("video_id","generation"),
	CONSTRAINT "video_generations_kind_check" CHECK ("video_generations"."kind" IN ('upload', 'replacement', 'edit')),
	CONSTRAINT "video_generations_status_check" CHECK ("video_generations"."status" IN ('uploading', 'rendering', 'failed', 'active', 'retired', 'purged')),
	CONSTRAINT "video_generations_generation_check" CHECK ("video_generations"."generation" >= 1)
);
--> statement-breakpoint
ALTER TABLE "video_edits" ADD CONSTRAINT "video_edits_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_in_flight_idx" ON "video_generations" USING btree ("video_id") WHERE "video_generations"."status" IN ('uploading', 'rendering');--> statement-breakpoint
CREATE INDEX "video_generations_purge_idx" ON "video_generations" USING btree ("purge_after") WHERE "video_generations"."purge_after" IS NOT NULL;