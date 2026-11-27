CREATE TABLE "playlist_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"playlist_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_activity_action_check" CHECK ("playlist_activity"."action" IN ('item_added', 'item_removed', 'items_reordered', 'note_edited', 'section_added', 'collaborator_added', 'collaborator_removed', 'role_changed', 'settings_changed', 'auto_removed', 'restored'))
);
--> statement-breakpoint
CREATE TABLE "playlist_collaborators" (
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_collaborators_playlist_id_user_id_pk" PRIMARY KEY("playlist_id","user_id"),
	CONSTRAINT "playlist_collaborators_role_check" CHECK ("playlist_collaborators"."role" IN ('editor', 'contributor'))
);
--> statement-breakpoint
CREATE TABLE "playlist_follows" (
	"user_id" uuid NOT NULL,
	"playlist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_follows_user_id_playlist_id_pk" PRIMARY KEY("user_id","playlist_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"playlist_id" uuid NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"invitee_user_id" uuid,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_invites_role_check" CHECK ("playlist_invites"."role" IN ('editor', 'contributor')),
	CONSTRAINT "playlist_invites_token_check" CHECK (char_length("playlist_invites"."token") = 22),
	CONSTRAINT "playlist_invites_max_uses_check" CHECK ("playlist_invites"."max_uses" IS NULL OR "playlist_invites"."max_uses" BETWEEN 1 AND 20),
	CONSTRAINT "playlist_invites_use_count_check" CHECK ("playlist_invites"."use_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "playlist_plays_daily" (
	"playlist_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"day" date NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "playlist_plays_daily_playlist_id_video_id_day_pk" PRIMARY KEY("playlist_id","video_id","day")
);
--> statement-breakpoint
CREATE TABLE "playlist_stats_daily" (
	"playlist_id" uuid NOT NULL,
	"day" date NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"follows" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "playlist_stats_daily_playlist_id_day_pk" PRIMARY KEY("playlist_id","day")
);
--> statement-breakpoint
ALTER TABLE "channel_image_uploads" DROP CONSTRAINT "channel_image_uploads_kind_check";--> statement-breakpoint
ALTER TABLE "share_links" DROP CONSTRAINT "share_links_target_type_check";--> statement-breakpoint
ALTER TABLE "playlist_items" ALTER COLUMN "video_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "kind" text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "added_by" uuid;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "start_ms" integer;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD COLUMN "end_ms" integer;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "rules" jsonb;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "auto_remove_watched" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "forked_from_playlist_id" uuid;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "cover_mode" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "cover_video_id" uuid;--> statement-breakpoint
ALTER TABLE "playlist_activity" ADD CONSTRAINT "playlist_activity_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_activity" ADD CONSTRAINT "playlist_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_follows" ADD CONSTRAINT "playlist_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_follows" ADD CONSTRAINT "playlist_follows_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_invites" ADD CONSTRAINT "playlist_invites_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_invites" ADD CONSTRAINT "playlist_invites_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_invites" ADD CONSTRAINT "playlist_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_plays_daily" ADD CONSTRAINT "playlist_plays_daily_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_plays_daily" ADD CONSTRAINT "playlist_plays_daily_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_stats_daily" ADD CONSTRAINT "playlist_stats_daily_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_activity_playlist_idx" ON "playlist_activity" USING btree ("playlist_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "playlist_activity_created_idx" ON "playlist_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "playlist_collaborators_user_idx" ON "playlist_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlist_follows_playlist_idx" ON "playlist_follows" USING btree ("playlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_invites_token_idx" ON "playlist_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_invites_one_per_invitee_idx" ON "playlist_invites" USING btree ("playlist_id","invitee_user_id") WHERE "playlist_invites"."invitee_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "playlist_invites_playlist_idx" ON "playlist_invites" USING btree ("playlist_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_forked_from_playlist_id_playlists_id_fk" FOREIGN KEY ("forked_from_playlist_id") REFERENCES "public"."playlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_cover_video_id_videos_id_fk" FOREIGN KEY ("cover_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlists_owner_pinned_idx" ON "playlists" USING btree ("owner_id","pinned_at") WHERE "playlists"."pinned_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_kind_check" CHECK ("playlist_items"."kind" IN ('video', 'section'));--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_shape_check" CHECK (("playlist_items"."kind" = 'video' AND "playlist_items"."video_id" IS NOT NULL AND "playlist_items"."title" IS NULL) OR ("playlist_items"."kind" = 'section' AND "playlist_items"."video_id" IS NULL AND "playlist_items"."title" IS NOT NULL AND "playlist_items"."start_ms" IS NULL AND "playlist_items"."end_ms" IS NULL));--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_title_check" CHECK ("playlist_items"."title" IS NULL OR char_length("playlist_items"."title") BETWEEN 1 AND 80);--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_note_check" CHECK ("playlist_items"."note" IS NULL OR char_length("playlist_items"."note") <= 300);--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_segment_check" CHECK (("playlist_items"."start_ms" IS NULL OR "playlist_items"."start_ms" >= 0) AND ("playlist_items"."end_ms" IS NULL OR "playlist_items"."end_ms" >= 1000) AND ("playlist_items"."start_ms" IS NULL OR "playlist_items"."end_ms" IS NULL OR "playlist_items"."end_ms" - "playlist_items"."start_ms" >= 1000));--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_cover_mode_check" CHECK ("playlists"."cover_mode" IN ('auto', 'item', 'custom'));--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_target_type_check" CHECK ("share_links"."target_type" IN ('video', 'playlist'));--> statement-breakpoint
ALTER TABLE "channel_image_uploads" ADD CONSTRAINT "channel_image_uploads_kind_check" CHECK ("channel_image_uploads"."kind" IN ('avatar', 'banner', 'playlist-cover'));