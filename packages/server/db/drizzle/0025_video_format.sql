ALTER TABLE "videos" ADD COLUMN "format" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
UPDATE "videos" SET "format" = 'short' WHERE "status" = 'READY' AND "width" IS NOT NULL AND "height" IS NOT NULL AND "duration_ms" IS NOT NULL AND "height" > "width" AND "duration_ms" <= 180000;
