CREATE INDEX "videos_owner_created_id_idx" ON "videos" USING btree ("owner_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
DROP INDEX "videos_owner_created_idx";