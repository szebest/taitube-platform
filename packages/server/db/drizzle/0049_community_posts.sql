ALTER TABLE "video_comments" RENAME TO "comments";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_pkey" TO "comments_pkey";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "video_comments_video_id_videos_id_fk";--> statement-breakpoint
ALTER TABLE "comments" RENAME COLUMN "video_id" TO "target_id";--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "target_type" text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "target_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
UPDATE "comments" SET "channel_id" = "videos"."channel_id" FROM "videos" WHERE "videos"."id" = "comments"."target_id";--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_type_check" CHECK ("comments"."target_type" IN ('video', 'post', 'thread'));--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_moderation_state_check" TO "comments_moderation_state_check";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_moderation_disclosure_check" TO "comments_moderation_disclosure_check";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_moderation_reason_check" TO "comments_moderation_reason_check";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_held_reason_check" TO "comments_held_reason_check";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_author_id_users_id_fk" TO "comments_author_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_author_channel_id_channels_id_fk" TO "comments_author_channel_id_channels_id_fk";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_parent_id_video_comments_id_fk" TO "comments_parent_id_comments_id_fk";--> statement-breakpoint
ALTER TABLE "comments" RENAME CONSTRAINT "video_comments_moderated_by_users_id_fk" TO "comments_moderated_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "comment_reports" RENAME CONSTRAINT "comment_reports_comment_id_video_comments_id_fk" TO "comment_reports_comment_id_comments_id_fk";--> statement-breakpoint
ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_comment_id_video_comments_id_fk" TO "notifications_comment_id_comments_id_fk";--> statement-breakpoint
DROP INDEX "video_comments_top_idx";--> statement-breakpoint
DROP INDEX "video_comments_newest_idx";--> statement-breakpoint
DROP INDEX "video_comments_one_pinned_per_video_idx";--> statement-breakpoint
DROP INDEX "video_comments_moderation_idx";--> statement-breakpoint
ALTER INDEX "video_comments_author_created_idx" RENAME TO "comments_author_created_idx";--> statement-breakpoint
ALTER INDEX "video_comments_author_channel_created_idx" RENAME TO "comments_author_channel_created_idx";--> statement-breakpoint
CREATE TABLE "channel_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_posts_kind_check" CHECK ("channel_posts"."kind" IN ('text', 'images', 'poll', 'quiz', 'video_share', 'playlist_share')),
	CONSTRAINT "channel_posts_status_check" CHECK ("channel_posts"."status" IN ('draft', 'scheduled', 'published')),
	CONSTRAINT "channel_posts_kind_matches_payload" CHECK ("channel_posts"."payload" ->> 'kind' = "channel_posts"."kind")
);
--> statement-breakpoint
CREATE TABLE "post_poll_votes" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_index" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_poll_votes_post_user_unique" UNIQUE("post_id","user_id"),
	CONSTRAINT "post_poll_votes_option_check" CHECK ("post_poll_votes"."option_index" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text DEFAULT 'LIKE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_reactions_pk" PRIMARY KEY("post_id","user_id"),
	CONSTRAINT "post_reactions_type_check" CHECK ("post_reactions"."type" = 'LIKE')
);
--> statement-breakpoint
CREATE TABLE "post_stats_daily" (
	"post_id" uuid NOT NULL,
	"day" date NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL,
	"share_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_stats_daily_pk" PRIMARY KEY("post_id","day")
);
--> statement-breakpoint
CREATE TABLE "video_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_channel_id" uuid NOT NULL,
	"anchor_ms" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned_at" timestamp with time zone,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"moderation_state" text DEFAULT 'published' NOT NULL,
	"moderation_disclosure" text,
	"held_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "video_threads_anchor_check" CHECK ("video_threads"."anchor_ms" >= 0),
	CONSTRAINT "video_threads_title_length" CHECK (char_length("video_threads"."title") BETWEEN 1 AND 100),
	CONSTRAINT "video_threads_body_length" CHECK (char_length("video_threads"."body") <= 1000),
	CONSTRAINT "video_threads_moderation_state_check" CHECK ("video_threads"."moderation_state" IN ('published', 'held', 'hidden')),
	CONSTRAINT "video_threads_moderation_disclosure_check" CHECK ("video_threads"."moderation_disclosure" IS NULL OR "video_threads"."moderation_disclosure" IN ('silent', 'visible')),
	CONSTRAINT "video_threads_held_reason_check" CHECK ("video_threads"."held_reason" IS NULL OR "video_threads"."held_reason" IN ('review_all', 'link', 'blocked_word'))
);
--> statement-breakpoint
ALTER TABLE "comment_removals" ALTER COLUMN "video_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_poll_votes" ADD CONSTRAINT "post_poll_votes_post_id_channel_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."channel_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_poll_votes" ADD CONSTRAINT "post_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_channel_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."channel_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_stats_daily" ADD CONSTRAINT "post_stats_daily_post_id_channel_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."channel_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_threads" ADD CONSTRAINT "video_threads_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_threads" ADD CONSTRAINT "video_threads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_threads" ADD CONSTRAINT "video_threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_threads" ADD CONSTRAINT "video_threads_author_channel_id_channels_id_fk" FOREIGN KEY ("author_channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_top_idx" ON "comments" USING btree ("target_type","target_id","parent_id","is_pinned" DESC NULLS LAST,"like_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comments_newest_idx" ON "comments" USING btree ("target_type","target_id","parent_id","is_pinned" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comments_channel_created_idx" ON "comments" USING btree ("channel_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "comments_one_pinned_per_target_idx" ON "comments" USING btree ("target_type","target_id") WHERE "comments"."is_pinned" AND "comments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "comments_moderation_idx" ON "comments" USING btree ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "comments"."moderation_state" <> 'published';--> statement-breakpoint
CREATE INDEX "channel_posts_channel_published_idx" ON "channel_posts" USING btree ("channel_id","pinned_at" DESC NULLS LAST,"published_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "channel_posts"."status" = 'published';--> statement-breakpoint
CREATE INDEX "channel_posts_channel_created_idx" ON "channel_posts" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "channel_posts_due_idx" ON "channel_posts" USING btree ("publish_at") WHERE "channel_posts"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "video_threads_video_anchor_idx" ON "video_threads" USING btree ("video_id","anchor_ms") WHERE "video_threads"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "video_threads_author_video_idx" ON "video_threads" USING btree ("author_id","video_id") WHERE "video_threads"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "channel_image_uploads" DROP CONSTRAINT "channel_image_uploads_kind_check";--> statement-breakpoint
ALTER TABLE "data_exports" DROP CONSTRAINT "data_exports_kind_check";--> statement-breakpoint
ALTER TABLE "api_tokens" DROP CONSTRAINT "api_tokens_scopes_check";--> statement-breakpoint
ALTER TABLE "channel_image_uploads" ADD COLUMN "variant_urls" jsonb;--> statement-breakpoint
ALTER TABLE "channel_image_uploads" ADD CONSTRAINT "channel_image_uploads_kind_check" CHECK ("channel_image_uploads"."kind" IN ('avatar', 'banner', 'post-image'));--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_kind_check" CHECK ("data_exports"."kind" IN ('video_analytics', 'channel_analytics', 'comments', 'videos', 'posts'));--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_scopes_check" CHECK (cardinality("api_tokens"."scopes") >= 1 AND "api_tokens"."scopes" <@ ARRAY['videos:read', 'videos:write', 'analytics:read', 'comments:read', 'comments:moderate', 'exports:read', 'exports:create', 'webhooks:manage', 'posts:write']::text[]);--> statement-breakpoint
CREATE FUNCTION "delete_target_comments"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "comments" WHERE "target_type" = TG_ARGV[0] AND "target_id" = OLD."id";
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "videos_delete_comments" AFTER DELETE ON "videos" FOR EACH ROW EXECUTE FUNCTION "delete_target_comments"('video');--> statement-breakpoint
CREATE TRIGGER "channel_posts_delete_comments" AFTER DELETE ON "channel_posts" FOR EACH ROW EXECUTE FUNCTION "delete_target_comments"('post');--> statement-breakpoint
CREATE TRIGGER "video_threads_delete_comments" AFTER DELETE ON "video_threads" FOR EACH ROW EXECUTE FUNCTION "delete_target_comments"('thread');
