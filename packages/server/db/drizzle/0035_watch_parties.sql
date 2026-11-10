CREATE TABLE "watch_party_bans" (
	"room_id" uuid NOT NULL,
	"member_key" text NOT NULL,
	"ip_hash" text,
	"banned_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_bans_room_id_member_key_pk" PRIMARY KEY("room_id","member_key")
);
--> statement-breakpoint
CREATE TABLE "watch_party_member_roles" (
	"room_id" uuid NOT NULL,
	"member_key" text NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_member_roles_room_id_member_key_role_id_pk" PRIMARY KEY("room_id","member_key","role_id")
);
--> statement-breakpoint
CREATE TABLE "watch_party_members" (
	"room_id" uuid NOT NULL,
	"member_key" text NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"discord_user_id" text,
	"display_name" text,
	"avatar_url" text,
	"ip_hash" text,
	"joined_via" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "watch_party_members_room_id_member_key_pk" PRIMARY KEY("room_id","member_key")
);
--> statement-breakpoint
CREATE TABLE "watch_party_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "watch_party_role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "watch_party_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"key" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"colour" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_roles_room_position_key" UNIQUE("room_id","position")
);
--> statement-breakpoint
CREATE TABLE "watch_party_rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_key" text NOT NULL,
	"as_channel_id" uuid,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"password_hash" text,
	"capacity" integer,
	"allow_guests" boolean NOT NULL,
	"chat_enabled" boolean DEFAULT true NOT NULL,
	"slow_mode_seconds" integer DEFAULT 0 NOT NULL,
	"buffer_policy" text DEFAULT 'wait' NOT NULL,
	"autoplay" boolean DEFAULT true NOT NULL,
	"skip_vote_percent" integer DEFAULT 50 NOT NULL,
	"idle_close" text DEFAULT '15m' NOT NULL,
	"language" text,
	"accent" text,
	"scheduled_for" timestamp with time zone,
	"auto_start" boolean DEFAULT false NOT NULL,
	"phase" text DEFAULT 'lobby' NOT NULL,
	"playback" jsonb NOT NULL,
	"playback_version" bigint DEFAULT 0 NOT NULL,
	"roles_version" bigint DEFAULT 0 NOT NULL,
	"permissions_version" integer NOT NULL,
	"queue_length" integer DEFAULT 0 NOT NULL,
	"queue_version" bigint DEFAULT 0 NOT NULL,
	"current_video_id" uuid,
	"present_count" integer DEFAULT 0 NOT NULL,
	"trend_score" double precision DEFAULT 0 NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_reason" text,
	"hidden_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"last_present_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "watch_party_rooms_capacity_check" CHECK ("watch_party_rooms"."capacity" IS NULL OR "watch_party_rooms"."capacity" >= 2),
	CONSTRAINT "watch_party_rooms_slow_mode_check" CHECK ("watch_party_rooms"."slow_mode_seconds" IN (0, 5, 10, 30, 60)),
	CONSTRAINT "watch_party_rooms_skip_vote_check" CHECK ("watch_party_rooms"."skip_vote_percent" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "watch_party_interest" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_interest_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "watch_party_invite_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_invite_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "watch_party_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"watching" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_invites_room_invitee_key" UNIQUE("room_id","invitee_id")
);
--> statement-breakpoint
CREATE TABLE "watch_party_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"author_key" text,
	"source" text DEFAULT 'app' NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"system" jsonb,
	"video_id" uuid,
	"position_ms" integer,
	"pinned" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_messages_length_check" CHECK ("watch_party_messages"."kind" = 'system' OR char_length("watch_party_messages"."body") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "watch_party_personal_controls" (
	"user_id" uuid NOT NULL,
	"target_key" text NOT NULL,
	"room_id" uuid,
	"voice_muted" boolean DEFAULT false NOT NULL,
	"volume" integer DEFAULT 100 NOT NULL,
	"hide_messages" boolean DEFAULT false NOT NULL,
	"hide_reactions" boolean DEFAULT false NOT NULL,
	"hide_avatar" boolean DEFAULT false NOT NULL,
	"hide_requests" boolean DEFAULT false NOT NULL,
	"block_invites" boolean DEFAULT false NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_party_personal_controls_scope_key" UNIQUE NULLS NOT DISTINCT("user_id","target_key","room_id"),
	CONSTRAINT "watch_party_personal_controls_volume_check" CHECK ("watch_party_personal_controls"."volume" BETWEEN 0 AND 200)
);
--> statement-breakpoint
CREATE TABLE "watch_party_queue_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"added_by" text NOT NULL,
	"position" integer NOT NULL,
	"start_ms" integer DEFAULT 0 NOT NULL,
	"played_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_party_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_key" text,
	"context" text DEFAULT 'room' NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "watch_party_reports_once_key" UNIQUE NULLS NOT DISTINCT("room_id","reporter_id","target_key")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "watch_party_id" uuid;--> statement-breakpoint
ALTER TABLE "watch_party_bans" ADD CONSTRAINT "watch_party_bans_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_member_roles" ADD CONSTRAINT "watch_party_member_roles_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_member_roles" ADD CONSTRAINT "watch_party_member_roles_role_id_watch_party_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."watch_party_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_members" ADD CONSTRAINT "watch_party_members_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_members" ADD CONSTRAINT "watch_party_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_role_permissions" ADD CONSTRAINT "watch_party_role_permissions_role_id_watch_party_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."watch_party_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_roles" ADD CONSTRAINT "watch_party_roles_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_rooms" ADD CONSTRAINT "watch_party_rooms_as_channel_id_channels_id_fk" FOREIGN KEY ("as_channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_rooms" ADD CONSTRAINT "watch_party_rooms_current_video_id_videos_id_fk" FOREIGN KEY ("current_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_interest" ADD CONSTRAINT "watch_party_interest_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_interest" ADD CONSTRAINT "watch_party_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_invite_links" ADD CONSTRAINT "watch_party_invite_links_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_invites" ADD CONSTRAINT "watch_party_invites_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_invites" ADD CONSTRAINT "watch_party_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_invites" ADD CONSTRAINT "watch_party_invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_messages" ADD CONSTRAINT "watch_party_messages_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_messages" ADD CONSTRAINT "watch_party_messages_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_personal_controls" ADD CONSTRAINT "watch_party_personal_controls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_personal_controls" ADD CONSTRAINT "watch_party_personal_controls_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_queue_items" ADD CONSTRAINT "watch_party_queue_items_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_queue_items" ADD CONSTRAINT "watch_party_queue_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_reports" ADD CONSTRAINT "watch_party_reports_room_id_watch_party_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_reports" ADD CONSTRAINT "watch_party_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watch_party_bans_ip_idx" ON "watch_party_bans" USING btree ("room_id","ip_hash") WHERE "watch_party_bans"."ip_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "watch_party_member_roles_expires_idx" ON "watch_party_member_roles" USING btree ("expires_at") WHERE "watch_party_member_roles"."expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "watch_party_members_user_idx" ON "watch_party_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_party_roles_room_key_key" ON "watch_party_roles" USING btree ("room_id","key") WHERE "watch_party_roles"."key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "watch_party_rooms_owner_open_idx" ON "watch_party_rooms" USING btree ("owner_key") WHERE "watch_party_rooms"."status" = 'open';--> statement-breakpoint
CREATE INDEX "watch_party_rooms_open_last_present_idx" ON "watch_party_rooms" USING btree ("last_present_at") WHERE "watch_party_rooms"."status" = 'open';--> statement-breakpoint
CREATE INDEX "watch_party_rooms_closed_at_idx" ON "watch_party_rooms" USING btree ("closed_at") WHERE "watch_party_rooms"."status" = 'closed';--> statement-breakpoint
CREATE INDEX "watch_party_rooms_members_keyset_idx" ON "watch_party_rooms" USING btree ("present_count" DESC NULLS LAST,"id") WHERE "watch_party_rooms"."status" = 'open' AND "watch_party_rooms"."visibility" = 'public' AND "watch_party_rooms"."hidden_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watch_party_rooms_newest_keyset_idx" ON "watch_party_rooms" USING btree ("created_at" DESC NULLS LAST,"id") WHERE "watch_party_rooms"."status" = 'open' AND "watch_party_rooms"."visibility" = 'public' AND "watch_party_rooms"."hidden_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watch_party_rooms_starting_soon_keyset_idx" ON "watch_party_rooms" USING btree ("scheduled_for","id") WHERE "watch_party_rooms"."status" = 'open' AND "watch_party_rooms"."visibility" = 'public' AND "watch_party_rooms"."hidden_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watch_party_rooms_trending_keyset_idx" ON "watch_party_rooms" USING btree ("trend_score" DESC NULLS LAST,"id") WHERE "watch_party_rooms"."status" = 'open' AND "watch_party_rooms"."visibility" = 'public' AND "watch_party_rooms"."hidden_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watch_party_invite_links_room_idx" ON "watch_party_invite_links" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "watch_party_invites_inviter_created_idx" ON "watch_party_invites" USING btree ("inviter_id","created_at");--> statement-breakpoint
CREATE INDEX "watch_party_messages_room_id_idx" ON "watch_party_messages" USING btree ("room_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_party_messages_one_pinned" ON "watch_party_messages" USING btree ("room_id") WHERE "watch_party_messages"."pinned";--> statement-breakpoint
CREATE INDEX "watch_party_messages_created_at_idx" ON "watch_party_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "watch_party_queue_items_room_position_idx" ON "watch_party_queue_items" USING btree ("room_id","position") WHERE "watch_party_queue_items"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watch_party_queue_items_video_idx" ON "watch_party_queue_items" USING btree ("video_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_watch_party_id_watch_party_rooms_id_fk" FOREIGN KEY ("watch_party_id") REFERENCES "public"."watch_party_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_party_rooms" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', "name"), 'A') ||
  setweight(to_tsvector('simple', "search_text"), 'B')
) STORED;--> statement-breakpoint
CREATE INDEX "watch_party_rooms_search_vector_idx" ON "watch_party_rooms" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "watch_party_rooms_search_text_trgm_idx" ON "watch_party_rooms" USING gin ("search_text" gin_trgm_ops);
