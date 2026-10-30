CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"query_key" text NOT NULL,
	"query" text NOT NULL,
	"searched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "search_history_user_query_key" UNIQUE("user_id","query_key")
);
--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_history_user_searched_idx" ON "search_history" USING btree ("user_id","searched_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "search_history_searched_at_idx" ON "search_history" USING btree ("searched_at");--> statement-breakpoint
CREATE INDEX "video_reactions_user_type_updated_idx" ON "video_reactions" USING btree ("user_id","type","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "video_comments_author_created_idx" ON "video_comments" USING btree ("author_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "video_comments"."deleted_at" IS NULL;