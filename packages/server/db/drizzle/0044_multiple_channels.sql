CREATE TABLE "account_audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" DROP CONSTRAINT "channels_user_id_unique";--> statement-breakpoint
ALTER TABLE "channel_subscriptions" DROP CONSTRAINT "channel_subscriptions_subscriber_channel_unique";--> statement-breakpoint
DROP INDEX "videos_channel_stats_idx";--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "channels" SET "is_primary" = true;--> statement-breakpoint
INSERT INTO "channels" ("id", "user_id", "handle", "display_name", "is_primary")
SELECT gen_random_uuid(), u."id", 'u-' || right(replace(u."id"::text, '-', ''), 12), coalesce(nullif(split_part(u."email", '@', 1), ''), 'User'), true
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "channels" c WHERE c."user_id" = u."id")
  AND (EXISTS (SELECT 1 FROM "videos" v WHERE v."owner_id" = u."id")
    OR EXISTS (SELECT 1 FROM "video_comments" vc WHERE vc."author_id" = u."id")
    OR EXISTS (SELECT 1 FROM "channel_subscriptions" s WHERE s."subscriber_id" = u."id"));--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
UPDATE "videos" v SET "channel_id" = c."id" FROM "channels" c WHERE c."user_id" = v."owner_id" AND c."is_primary";--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD COLUMN "subscriber_channel_id" uuid;--> statement-breakpoint
UPDATE "channel_subscriptions" s SET "subscriber_channel_id" = c."id" FROM "channels" c WHERE c."user_id" = s."subscriber_id" AND c."is_primary";--> statement-breakpoint
UPDATE "channels" c SET "subscriber_count" = greatest(c."subscriber_count" - 1, 0)
WHERE EXISTS (SELECT 1 FROM "channel_subscriptions" s WHERE s."channel_id" = c."id" AND s."subscriber_channel_id" = c."id");--> statement-breakpoint
DELETE FROM "channel_subscriptions" WHERE "subscriber_channel_id" = "channel_id";--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ALTER COLUMN "subscriber_channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_comments" ADD COLUMN "author_channel_id" uuid;--> statement-breakpoint
UPDATE "video_comments" vc SET "author_channel_id" = c."id" FROM "channels" c WHERE c."user_id" = vc."author_id" AND c."is_primary";--> statement-breakpoint
ALTER TABLE "video_comments" ALTER COLUMN "author_channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account_audit_log" ADD CONSTRAINT "account_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_audit_log_user_newest_idx" ON "account_audit_log" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_subscriber_channel_id_channels_id_fk" FOREIGN KEY ("subscriber_channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_author_channel_id_channels_id_fk" FOREIGN KEY ("author_channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_user_primary_unique" ON "channels" USING btree ("user_id") WHERE "channels"."is_primary";--> statement-breakpoint
CREATE INDEX "videos_channel_created_idx" ON "videos" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "video_comments_author_channel_created_idx" ON "video_comments" USING btree ("author_channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "videos_channel_stats_idx" ON "videos" USING btree ("channel_id","views_count") WHERE "videos"."status" = 'READY' AND "videos"."visibility" = 'public' AND "videos"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_subscriber_channel_channel_unique" UNIQUE("subscriber_channel_id","channel_id");--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_not_self" CHECK ("channel_subscriptions"."subscriber_channel_id" <> "channel_subscriptions"."channel_id");
