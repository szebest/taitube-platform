CREATE TABLE "channel_audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"invitee_user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"invited_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "channel_invites_role_check" CHECK ("channel_invites"."role" IN ('manager', 'editor', 'moderator', 'analytics')),
	CONSTRAINT "channel_invites_status_check" CHECK ("channel_invites"."status" IN ('pending', 'accepted', 'declined', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_members_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id"),
	CONSTRAINT "channel_members_role_check" CHECK ("channel_members"."role" IN ('manager', 'editor', 'moderator', 'analytics'))
);
--> statement-breakpoint
ALTER TABLE "channel_audit_log" ADD CONSTRAINT "channel_audit_log_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_audit_log" ADD CONSTRAINT "channel_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_invites" ADD CONSTRAINT "channel_invites_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_invites" ADD CONSTRAINT "channel_invites_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_invites" ADD CONSTRAINT "channel_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_audit_log_channel_newest_idx" ON "channel_audit_log" USING btree ("channel_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "channel_audit_log_created_at_idx" ON "channel_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_invites_one_pending_idx" ON "channel_invites" USING btree ("channel_id","invitee_user_id") WHERE "channel_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "channel_invites_invitee_pending_idx" ON "channel_invites" USING btree ("invitee_user_id") WHERE "channel_invites"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "channel_members_user_idx" ON "channel_members" USING btree ("user_id");