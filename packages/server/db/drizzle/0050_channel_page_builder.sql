CREATE TABLE "channel_layout_drafts" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"doc" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_layout_drafts_version_check" CHECK ("channel_layout_drafts"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "channel_layout_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"doc" jsonb NOT NULL,
	"publish_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_layout_schedules_status_check" CHECK ("channel_layout_schedules"."status" IN ('pending', 'applied', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "entity_revisions" DROP CONSTRAINT "entity_revisions_type_check";--> statement-breakpoint
ALTER TABLE "channel_layout_drafts" ADD CONSTRAINT "channel_layout_drafts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_layout_drafts" ADD CONSTRAINT "channel_layout_drafts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_layout_schedules" ADD CONSTRAINT "channel_layout_schedules_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_layout_schedules" ADD CONSTRAINT "channel_layout_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_layout_schedules_channel_status_idx" ON "channel_layout_schedules" USING btree ("channel_id","status");--> statement-breakpoint
CREATE INDEX "channel_layout_schedules_due_idx" ON "channel_layout_schedules" USING btree ("publish_at") WHERE "channel_layout_schedules"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "entity_revisions" ADD CONSTRAINT "entity_revisions_type_check" CHECK ("entity_revisions"."entity_type" IN ('video_metadata', 'channel_post', 'channel_layout'));