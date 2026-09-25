CREATE TABLE "playlist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"playlist_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_items_playlist_video_key" UNIQUE("playlist_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"custom_thumbnail_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlists_visibility_check" CHECK ("playlists"."visibility" IN ('private', 'unlisted', 'public'))
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"progress_seconds" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "watch_history_user_video_key" UNIQUE("user_id","video_id"),
	CONSTRAINT "watch_history_progress_check" CHECK ("watch_history"."progress_seconds" >= 0 AND "watch_history"."duration_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_items_playlist_position_idx" ON "playlist_items" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE INDEX "playlist_items_video_idx" ON "playlist_items" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "playlists_owner_visibility_idx" ON "playlists" USING btree ("owner_id","visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_one_system_per_owner_idx" ON "playlists" USING btree ("owner_id") WHERE "playlists"."is_system";--> statement-breakpoint
CREATE INDEX "watch_history_user_watched_idx" ON "watch_history" USING btree ("user_id","watched_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "watch_history_video_idx" ON "watch_history" USING btree ("video_id");--> statement-breakpoint
INSERT INTO "playlists" ("id", "owner_id", "title", "visibility", "is_system") SELECT gen_random_uuid(), "id", 'Watch Later', 'private', true FROM "users" ON CONFLICT DO NOTHING;