CREATE TABLE "entity_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"author_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_revisions_type_check" CHECK ("entity_revisions"."entity_type" IN ('video_metadata')),
	CONSTRAINT "entity_revisions_note_check" CHECK ("entity_revisions"."note" IS NULL OR char_length("entity_revisions"."note") <= 200)
);
--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"video_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "video_chapters_video_id_position_pk" PRIMARY KEY("video_id","position"),
	CONSTRAINT "video_chapters_start_check" CHECK ("video_chapters"."start_ms" >= 0),
	CONSTRAINT "video_chapters_title_check" CHECK (char_length("video_chapters"."title") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "video_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_corrections_range_check" CHECK ("video_corrections"."start_ms" >= 0 AND "video_corrections"."end_ms" - "video_corrections"."start_ms" BETWEEN 2000 AND 30000),
	CONSTRAINT "video_corrections_text_check" CHECK (char_length("video_corrections"."text") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "entity_revisions" ADD CONSTRAINT "entity_revisions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_corrections" ADD CONSTRAINT "video_corrections_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_revisions_entity_version_idx" ON "entity_revisions" USING btree ("entity_type","entity_id","version");--> statement-breakpoint
CREATE INDEX "video_corrections_video_idx" ON "video_corrections" USING btree ("video_id","start_ms");