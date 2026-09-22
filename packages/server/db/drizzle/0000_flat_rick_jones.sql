CREATE TYPE "public"."rendition_status" AS ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('OPEN', 'COMPLETED', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('UPLOADING', 'UPLOADED', 'PROBING', 'PROCESSING', 'READY', 'FAILED', 'REJECTED', 'ABANDONED', 'DELETED');--> statement-breakpoint
CREATE TABLE "dlq_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"job_id" text NOT NULL,
	"video_id" uuid,
	"payload" jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"stack" text,
	"attempts_made" integer NOT NULL,
	"worker_id" text,
	"status" text DEFAULT 'PARKED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replayed_at" timestamp with time zone,
	CONSTRAINT "dlq_entries_queue_job_id_attempts_made_unique" UNIQUE("queue","job_id","attempts_made")
);
--> statement-breakpoint
CREATE TABLE "processing_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"step" text NOT NULL,
	"rendition" text DEFAULT '-' NOT NULL,
	"job_id" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" "step_status" DEFAULT 'QUEUED' NOT NULL,
	"worker_id" text,
	"lock_token" uuid,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"result" jsonb,
	CONSTRAINT "processing_steps_video_id_step_rendition_unique" UNIQUE("video_id","step","rendition")
);
--> statement-breakpoint
CREATE TABLE "renditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"video_bitrate_kbps" integer NOT NULL,
	"audio_bitrate_kbps" integer NOT NULL,
	"status" "rendition_status" DEFAULT 'PENDING' NOT NULL,
	"playlist_key" text,
	"segment_count" integer,
	"bytes" bigint,
	"processing_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renditions_video_id_name_unique" UNIQUE("video_id","name")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"strategy" text NOT NULL,
	"multipart_upload_id" text,
	"part_size_bytes" integer,
	"parts_expected" integer,
	"declared_size_bytes" bigint NOT NULL,
	"declared_content_type" text NOT NULL,
	"sha256" text,
	"status" "upload_status" DEFAULT 'OPEN' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uploads_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" "video_status" DEFAULT 'UPLOADING' NOT NULL,
	"source_key" text NOT NULL,
	"source_size_bytes" bigint,
	"source_content_type" text,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"fps" numeric(6, 3),
	"video_codec" text,
	"audio_codec" text,
	"ladder" jsonb,
	"master_playlist_key" text,
	"poster_key" text,
	"sprite_key" text,
	"error_code" text,
	"error_message" text,
	"version" integer DEFAULT 0 NOT NULL,
	"ready_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dlq_entries" ADD CONSTRAINT "dlq_entries_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_steps" ADD CONSTRAINT "processing_steps_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renditions" ADD CONSTRAINT "renditions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_events" ADD CONSTRAINT "video_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_events_video_idx" ON "video_events" USING btree ("video_id","id");--> statement-breakpoint
CREATE INDEX "videos_owner_created_idx" ON "videos" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "videos_status_updated_idx" ON "videos" USING btree ("status","updated_at");