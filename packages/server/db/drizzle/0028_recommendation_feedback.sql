CREATE TABLE "recommendation_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"video_id" uuid,
	"channel_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recommendation_feedback_target_check" CHECK (("recommendation_feedback"."kind" = 'not_interested' AND "recommendation_feedback"."video_id" IS NOT NULL AND "recommendation_feedback"."channel_id" IS NULL) OR ("recommendation_feedback"."kind" = 'hide_channel' AND "recommendation_feedback"."channel_id" IS NOT NULL AND "recommendation_feedback"."video_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_user_video_idx" ON "recommendation_feedback" USING btree ("user_id","video_id") WHERE "recommendation_feedback"."video_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_user_channel_idx" ON "recommendation_feedback" USING btree ("user_id","channel_id") WHERE "recommendation_feedback"."channel_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recommendation_feedback_user_created_idx" ON "recommendation_feedback" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
