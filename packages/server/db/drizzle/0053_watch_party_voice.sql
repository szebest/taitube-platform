ALTER TABLE "watch_party_rooms" ADD COLUMN "voice_mode" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_party_rooms" ADD CONSTRAINT "watch_party_rooms_voice_mode_check" CHECK ("watch_party_rooms"."voice_mode" IN ('open', 'push_to_talk'));
