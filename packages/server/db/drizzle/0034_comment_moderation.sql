CREATE TABLE "channel_comment_settings" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"review_mode" text DEFAULT 'none' NOT NULL,
	"blocked_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"link_allowlist" text[] DEFAULT '{}'::text[] NOT NULL,
	"slow_mode_seconds" integer,
	"subscribers_only" boolean DEFAULT false NOT NULL,
	"min_account_age_days" integer DEFAULT 0 NOT NULL,
	"disclosure" jsonb DEFAULT '{"hide":"silent","remove":"visible","manual_hold":"visible","auto.blocked_words":"silent","auto.links":"visible","auto.review_all":"visible"}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_comment_settings_review_mode_check" CHECK ("channel_comment_settings"."review_mode" IN ('none', 'links', 'all')),
	CONSTRAINT "channel_comment_settings_slow_mode_check" CHECK ("channel_comment_settings"."slow_mode_seconds" IS NULL OR "channel_comment_settings"."slow_mode_seconds" > 0),
	CONSTRAINT "channel_comment_settings_min_age_check" CHECK ("channel_comment_settings"."min_account_age_days" BETWEEN 0 AND 30)
);
--> statement-breakpoint
CREATE TABLE "channel_saved_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "channel_saved_replies_title_check" CHECK (char_length("channel_saved_replies"."title") BETWEEN 1 AND 40),
	CONSTRAINT "channel_saved_replies_body_check" CHECK (char_length("channel_saved_replies"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "channel_trusted_commenters" (
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_trusted_commenters_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channel_user_restrictions" (
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_user_restrictions_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id"),
	CONSTRAINT "channel_user_restrictions_kind_check" CHECK ("channel_user_restrictions"."kind" IN ('shadow', 'ban')),
	CONSTRAINT "channel_user_restrictions_expiry_check" CHECK ("channel_user_restrictions"."kind" = 'ban' OR "channel_user_restrictions"."expires_at" IS NULL),
	CONSTRAINT "channel_user_restrictions_reason_check" CHECK ("channel_user_restrictions"."reason" IS NULL OR char_length("channel_user_restrictions"."reason") <= 200)
);
--> statement-breakpoint
CREATE TABLE "comment_removals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"excerpt" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"disclosure" text NOT NULL,
	"removed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_removals_reason_check" CHECK ("comment_removals"."reason" IN ('spam', 'harassment', 'hate', 'misinformation', 'other', 'off_topic')),
	CONSTRAINT "comment_removals_disclosure_check" CHECK ("comment_removals"."disclosure" IN ('silent', 'visible')),
	CONSTRAINT "comment_removals_note_check" CHECK ("comment_removals"."note" IS NULL OR char_length("comment_removals"."note") <= 200)
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderation_state" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderation_disclosure" text;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderated_by" uuid;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "held_reason" text;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "looks_like_question" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_comment_settings" ADD CONSTRAINT "channel_comment_settings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_saved_replies" ADD CONSTRAINT "channel_saved_replies_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_trusted_commenters" ADD CONSTRAINT "channel_trusted_commenters_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_trusted_commenters" ADD CONSTRAINT "channel_trusted_commenters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_trusted_commenters" ADD CONSTRAINT "channel_trusted_commenters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_user_restrictions" ADD CONSTRAINT "channel_user_restrictions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_user_restrictions" ADD CONSTRAINT "channel_user_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_user_restrictions" ADD CONSTRAINT "channel_user_restrictions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_removals" ADD CONSTRAINT "comment_removals_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_removals" ADD CONSTRAINT "comment_removals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_removals" ADD CONSTRAINT "comment_removals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_removals" ADD CONSTRAINT "comment_removals_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_saved_replies_channel_position_idx" ON "channel_saved_replies" USING btree ("channel_id","position");--> statement-breakpoint
CREATE INDEX "channel_user_restrictions_user_idx" ON "channel_user_restrictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "channel_user_restrictions_expires_idx" ON "channel_user_restrictions" USING btree ("expires_at") WHERE "channel_user_restrictions"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "comment_removals_author_created_idx" ON "comment_removals" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "comment_removals_created_at_idx" ON "comment_removals" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_comments_moderation_idx" ON "video_comments" USING btree ("video_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "video_comments"."moderation_state" <> 'published';--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_moderation_state_check" CHECK ("video_comments"."moderation_state" IN ('published', 'held', 'hidden'));--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_moderation_disclosure_check" CHECK ("video_comments"."moderation_disclosure" IS NULL OR "video_comments"."moderation_disclosure" IN ('silent', 'visible'));--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_moderation_reason_check" CHECK ("video_comments"."moderation_reason" IS NULL OR "video_comments"."moderation_reason" IN ('spam', 'harassment', 'hate', 'misinformation', 'other', 'off_topic'));--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_held_reason_check" CHECK ("video_comments"."held_reason" IS NULL OR "video_comments"."held_reason" IN ('review_all', 'link', 'blocked_word'));