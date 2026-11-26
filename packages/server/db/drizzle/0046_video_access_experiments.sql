CREATE TABLE "share_link_stats" (
	"link_id" uuid NOT NULL,
	"day" date NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"watch_seconds" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "share_link_stats_link_id_day_pk" PRIMARY KEY("link_id","day")
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_target_type_check" CHECK ("share_links"."target_type" IN ('video')),
	CONSTRAINT "share_links_token_check" CHECK (char_length("share_links"."token") = 22),
	CONSTRAINT "share_links_label_check" CHECK ("share_links"."label" IS NULL OR char_length("share_links"."label") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "video_experiment_stats" (
	"experiment_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"day" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"starts" integer DEFAULT 0 NOT NULL,
	"watch_seconds" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "video_experiment_stats_experiment_id_variant_id_day_pk" PRIMARY KEY("experiment_id","variant_id","day"),
	CONSTRAINT "video_experiment_stats_variant_check" CHECK ("video_experiment_stats"."variant_id" IN ('a', 'b', 'c'))
);
--> statement-breakpoint
CREATE TABLE "video_experiments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"variants" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"winner_variant_id" text,
	CONSTRAINT "video_experiments_kind_check" CHECK ("video_experiments"."kind" IN ('title', 'thumbnail', 'both')),
	CONSTRAINT "video_experiments_status_check" CHECK ("video_experiments"."status" IN ('running', 'finished', 'stopped')),
	CONSTRAINT "video_experiments_winner_check" CHECK ("video_experiments"."winner_variant_id" IS NULL OR "video_experiments"."winner_variant_id" IN ('a', 'b', 'c'))
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "access_password_hash" text;--> statement-breakpoint
ALTER TABLE "share_link_stats" ADD CONSTRAINT "share_link_stats_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_experiment_stats" ADD CONSTRAINT "video_experiment_stats_experiment_id_video_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."video_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_experiments" ADD CONSTRAINT "video_experiments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "share_links_target_idx" ON "share_links" USING btree ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "video_experiments_running_idx" ON "video_experiments" USING btree ("video_id") WHERE "video_experiments"."status" = 'running';--> statement-breakpoint
CREATE INDEX "video_experiments_video_idx" ON "video_experiments" USING btree ("video_id","started_at" DESC NULLS LAST);