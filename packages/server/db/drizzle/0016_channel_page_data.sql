ALTER TABLE "channels" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "video_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "total_views" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "channels" SET "video_count" = "stats"."videos", "total_views" = "stats"."views"
FROM (
  SELECT "owner_id", count(*) AS "videos", coalesce(sum("views_count"), 0) AS "views"
  FROM "videos"
  WHERE "status" = 'READY' AND "visibility" = 'public' AND "deleted_at" IS NULL
  GROUP BY "owner_id"
) AS "stats"
WHERE "channels"."user_id" = "stats"."owner_id";--> statement-breakpoint
CREATE FUNCTION channel_stats_apply(owner uuid, videos_delta integer, views_delta bigint) RETURNS void
  LANGUAGE sql
  AS $$
    UPDATE channels
    SET video_count = video_count + videos_delta, total_views = total_views + views_delta
    WHERE user_id = owner AND (videos_delta <> 0 OR views_delta <> 0)
  $$;--> statement-breakpoint
CREATE FUNCTION channel_stats_follow_video() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    old_videos integer := 0;
    old_views bigint := 0;
    new_videos integer := 0;
    new_views bigint := 0;
  BEGIN
    IF TG_OP <> 'INSERT' AND OLD.status = 'READY' AND OLD.visibility = 'public' AND OLD.deleted_at IS NULL THEN
      old_videos := 1;
      old_views := OLD.views_count;
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.status = 'READY' AND NEW.visibility = 'public' AND NEW.deleted_at IS NULL THEN
      new_videos := 1;
      new_views := NEW.views_count;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.owner_id = NEW.owner_id THEN
      PERFORM channel_stats_apply(NEW.owner_id, new_videos - old_videos, new_views - old_views);
    ELSE
      IF TG_OP <> 'INSERT' THEN
        PERFORM channel_stats_apply(OLD.owner_id, -old_videos, -old_views);
      END IF;
      IF TG_OP <> 'DELETE' THEN
        PERFORM channel_stats_apply(NEW.owner_id, new_videos, new_views);
      END IF;
    END IF;
    RETURN NULL;
  END
  $$;--> statement-breakpoint
CREATE TRIGGER videos_channel_stats
  AFTER INSERT OR DELETE OR UPDATE OF owner_id, status, visibility, deleted_at, views_count ON videos
  FOR EACH ROW EXECUTE FUNCTION channel_stats_follow_video();
