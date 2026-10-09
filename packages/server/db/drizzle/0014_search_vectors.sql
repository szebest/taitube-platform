CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE FUNCTION search_tags_text(tags text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  RETURN array_to_string(tags, ' ');--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', "title"), 'A') ||
  setweight(to_tsvector('simple', search_tags_text("tags")), 'B') ||
  setweight(to_tsvector('simple', "description"), 'D')
) STORED;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', "handle"), 'A') ||
  setweight(to_tsvector('simple', "display_name"), 'A') ||
  setweight(to_tsvector('simple', coalesce("bio", '')), 'C')
) STORED;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', "title"), 'A') ||
  setweight(to_tsvector('simple', "description"), 'B')
) STORED;--> statement-breakpoint
CREATE INDEX "videos_search_vector_idx" ON "videos" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "channels_search_vector_idx" ON "channels" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "playlists_search_vector_idx" ON "playlists" USING gin ("search_vector") WHERE "visibility" = 'public' AND NOT "is_system";--> statement-breakpoint
CREATE INDEX "videos_title_trgm_idx" ON "videos" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "channels_handle_trgm_idx" ON "channels" USING gin ("handle" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "channels_display_name_trgm_idx" ON "channels" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "channels_handle_lower_idx" ON "channels" (lower("handle") text_pattern_ops);--> statement-breakpoint
CREATE INDEX "channels_display_name_lower_idx" ON "channels" (lower("display_name") text_pattern_ops);--> statement-breakpoint
CREATE INDEX "playlists_title_trgm_idx" ON "playlists" USING gin ("title" gin_trgm_ops) WHERE "visibility" = 'public' AND NOT "is_system";
