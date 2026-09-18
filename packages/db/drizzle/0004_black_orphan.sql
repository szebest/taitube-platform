CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"banner_url" text,
	"bio" text,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "channels_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_handle_idx" ON "channels" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "channels_user_id_idx" ON "channels" USING btree ("user_id");