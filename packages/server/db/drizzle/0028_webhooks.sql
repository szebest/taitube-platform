CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"secret" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "webhooks_url_check" CHECK (char_length("webhooks"."url") BETWEEN 1 AND 2048),
	CONSTRAINT "webhooks_events_check" CHECK (cardinality("webhooks"."events") >= 1 AND "webhooks"."events" <@ ARRAY['video.ready', 'live.started']::text[])
);
--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhooks_owner_created_idx" ON "webhooks" USING btree ("owner_id","created_at");