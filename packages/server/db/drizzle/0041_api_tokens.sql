CREATE TABLE "api_token_usage" (
	"token_id" uuid NOT NULL,
	"day" date NOT NULL,
	"requests" integer NOT NULL,
	CONSTRAINT "api_token_usage_token_id_day_pk" PRIMARY KEY("token_id","day")
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"secret_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_tokens_name_check" CHECK (char_length("api_tokens"."name") BETWEEN 1 AND 60),
	CONSTRAINT "api_tokens_prefix_check" CHECK ("api_tokens"."prefix" ~ '^[0-9a-f]{8}$'),
	CONSTRAINT "api_tokens_scopes_check" CHECK (cardinality("api_tokens"."scopes") >= 1 AND "api_tokens"."scopes" <@ ARRAY['videos:read', 'videos:write', 'analytics:read', 'comments:read', 'comments:moderate', 'exports:read', 'exports:create', 'webhooks:manage']::text[])
);
--> statement-breakpoint
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_events_check";--> statement-breakpoint
ALTER TABLE "channel_audit_log" ADD COLUMN "actor_token_id" uuid;--> statement-breakpoint
ALTER TABLE "api_token_usage" ADD CONSTRAINT "api_token_usage_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_tokens_prefix_idx" ON "api_tokens" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "api_tokens_user_newest_idx" ON "api_tokens" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "api_tokens"."revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "channel_audit_log" ADD CONSTRAINT "channel_audit_log_actor_token_id_api_tokens_id_fk" FOREIGN KEY ("actor_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_events_check" CHECK (cardinality("webhooks"."events") >= 1 AND "webhooks"."events" <@ ARRAY['video.ready', 'live.started', 'export.ready', 'comment.held']::text[]);