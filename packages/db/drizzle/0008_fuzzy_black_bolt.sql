CREATE TABLE "channel_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_subscriptions_subscriber_channel_unique" UNIQUE("subscriber_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_subscriptions" ADD CONSTRAINT "channel_subscriptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_subscriptions_subscriber_created_idx" ON "channel_subscriptions" USING btree ("subscriber_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "channel_subscriptions_channel_created_idx" ON "channel_subscriptions" USING btree ("channel_id","created_at" DESC NULLS LAST);