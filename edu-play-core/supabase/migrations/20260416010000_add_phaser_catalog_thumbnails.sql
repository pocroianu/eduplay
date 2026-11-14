-- =============================================================================
-- Set thumbnail_url on the 10 Phaser template catalog rows seeded by EDU-6.
-- Additive, idempotent: only updates rows whose thumbnail_url is still NULL
-- so a later ops migration that swaps thumbnails cannot be accidentally
-- overwritten by re-running this one.
--
-- Assets live under /public/thumbnails/games/<variantId>.png and are served
-- by Next.js as static files.
-- =============================================================================

UPDATE games SET thumbnail_url = t.thumbnail_url, updated_at = NOW()
FROM (VALUES
  -- matching-game
  ('/api/v1/game-proxy/games/matching-game/index.html?game=animals-match-01&lang=ro', '/thumbnails/games/animals-match-01.png'),
  ('/api/v1/game-proxy/games/matching-game/index.html?game=food-match-01&lang=ro',    '/thumbnails/games/food-match-01.png'),
  -- memory-game
  ('/api/v1/game-proxy/games/memory-game/index.html?game=animals-memory-01&lang=ro',  '/thumbnails/games/animals-memory-01.png'),
  ('/api/v1/game-proxy/games/memory-game/index.html?game=food-memory-01&lang=ro',     '/thumbnails/games/food-memory-01.png'),
  -- categorize-game
  ('/api/v1/game-proxy/games/categorize-game/index.html?game=animals-habitat-01&lang=ro', '/thumbnails/games/animals-habitat-01.png'),
  ('/api/v1/game-proxy/games/categorize-game/index.html?game=food-vs-animals-01&lang=ro', '/thumbnails/games/food-vs-animals-01.png'),
  -- sequence-order
  ('/api/v1/game-proxy/games/sequence-order/index.html?game=numbers-1-to-6&lang=ro',  '/thumbnails/games/numbers-1-to-6.png'),
  ('/api/v1/game-proxy/games/sequence-order/index.html?game=numbers-7-to-12&lang=ro', '/thumbnails/games/numbers-7-to-12.png'),
  -- tracing-game
  ('/api/v1/game-proxy/games/tracing-game/index.html?game=shapes-basic&lang=ro',      '/thumbnails/games/shapes-basic.png'),
  ('/api/v1/game-proxy/games/tracing-game/index.html?game=uppercase-a-to-f&lang=ro',  '/thumbnails/games/uppercase-a-to-f.png')
) AS t(game_url, thumbnail_url)
WHERE games.game_url = t.game_url
  AND games.thumbnail_url IS NULL;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260416010000''';
  END IF;
END
$wa$;
