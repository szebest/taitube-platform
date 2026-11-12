DROP INDEX "outbox_drain_idx";--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "claimable_at" timestamp with time zone;--> statement-breakpoint
UPDATE "outbox" SET "status" = 'PUBLISHED' WHERE "published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outbox_drain_idx" ON "outbox" USING btree ("status","created_at");