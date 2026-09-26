ALTER TABLE "videos" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "custom_thumbnail_key" text;--> statement-breakpoint
CREATE INDEX "videos_tags_idx" ON "videos" USING gin ("tags");