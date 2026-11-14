-- =============================================================================
-- Seed: Phaser template catalog completeness (EDU-6)
-- Adds 10 catalog entries across 5 template families:
--   matching-game    (animals-match-01, food-match-01)
--   memory-game      (animals-memory-01, food-memory-01)
--   categorize-game  (animals-habitat-01, food-vs-animals-01)
--   sequence-order   (numbers-1-to-6, numbers-7-to-12)
--   tracing-game     (shapes-basic, uppercase-a-to-f)
--
-- URL pattern:
--   /api/v1/game-proxy/games/<template>/index.html?game=<variantId>&lang=ro
-- Idempotent: skips rows where an identical game_url already exists.
-- =============================================================================

INSERT INTO games (
  title,
  description,
  game_url,
  category,
  difficulty_level,
  target_age_min,
  target_age_max,
  estimated_duration,
  learning_objectives,
  is_published,
  created_at,
  updated_at
)
SELECT v.title, v.description, v.game_url, v.category, v.difficulty_level,
       v.target_age_min, v.target_age_max, v.estimated_duration,
       v.learning_objectives::jsonb, true, NOW(), NOW()
FROM (VALUES
  -- matching-game ------------------------------------------------------------
  (
    'Nume de animale',
    'Potrivește fiecare animal cu numele lui — un joc simplu de asociere imagine-cuvânt.',
    '/api/v1/game-proxy/games/matching-game/index.html?game=animals-match-01&lang=ro',
    'vocabulary', 1, 3, 7, 4,
    '{"skills": ["asociere imagine-cuvânt", "recunoașterea animalelor", "vocabular"], "tags": ["animals", "matching"], "pairCount": 4}'
  ),
  (
    'Mâncarea mea preferată',
    'Potrivește fructele și alimentele cu numele lor — patru perechi colorate.',
    '/api/v1/game-proxy/games/matching-game/index.html?game=food-match-01&lang=ro',
    'vocabulary', 1, 3, 7, 4,
    '{"skills": ["asociere imagine-cuvânt", "vocabular alimentar"], "tags": ["food", "matching"], "pairCount": 4}'
  ),
  -- memory-game --------------------------------------------------------------
  (
    'Memoria Animalelor',
    'Găsește perechile potrivite într-un joc clasic de memorie cu animale.',
    '/api/v1/game-proxy/games/memory-game/index.html?game=animals-memory-01&lang=ro',
    'vocabulary', 1, 4, 8, 5,
    '{"skills": ["memorie vizuală", "recunoașterea animalelor", "concentrare"], "tags": ["animals", "memory"], "pairCount": 6}'
  ),
  (
    'Memoria Mâncării',
    'Un joc de memorie cu fructe și alimente — găsește toate perechile!',
    '/api/v1/game-proxy/games/memory-game/index.html?game=food-memory-01&lang=ro',
    'vocabulary', 1, 4, 8, 5,
    '{"skills": ["memorie vizuală", "vocabular alimentar", "concentrare"], "tags": ["food", "memory"], "pairCount": 6}'
  ),
  -- categorize-game ----------------------------------------------------------
  (
    'Casele animalelor',
    'Sortează animalele: trăiesc la fermă sau în sălbăticie? Trage fiecare animal la casa lui.',
    '/api/v1/game-proxy/games/categorize-game/index.html?game=animals-habitat-01&lang=ro',
    'vocabulary', 2, 4, 8, 5,
    '{"skills": ["categorizare", "habitat animal", "gândire logică"], "tags": ["animals", "categorization"], "itemCount": 6}'
  ),
  (
    'Mâncare sau animal?',
    'Sortează imaginile în două coșuri: mâncare sau animal? Un exercițiu simplu de clasificare.',
    '/api/v1/game-proxy/games/categorize-game/index.html?game=food-vs-animals-01&lang=ro',
    'vocabulary', 1, 3, 7, 4,
    '{"skills": ["clasificare", "vocabular", "gândire logică"], "tags": ["food", "animals", "categorization"], "itemCount": 6}'
  ),
  -- sequence-order -----------------------------------------------------------
  (
    'Numerele de la 1 la 6',
    'Pune numerele în ordinea corectă, de la 1 la 6 — un joc de bază pentru numărare.',
    '/api/v1/game-proxy/games/sequence-order/index.html?game=numbers-1-to-6&lang=ro',
    'math', 1, 3, 7, 4,
    '{"skills": ["numărare", "ordonare numere", "succesiune numerică"], "tags": ["numbers", "ordering"], "itemCount": 6}'
  ),
  (
    'Numerele de la 7 la 12',
    'Continuă numărătoarea — ordonează numerele de la 7 la 12 pentru învățare progresivă.',
    '/api/v1/game-proxy/games/sequence-order/index.html?game=numbers-7-to-12&lang=ro',
    'math', 2, 4, 8, 5,
    '{"skills": ["numărare", "ordonare numere", "numere peste 10"], "tags": ["numbers", "ordering"], "itemCount": 6}'
  ),
  -- tracing-game -------------------------------------------------------------
  (
    'Trasează Forme de Bază',
    'Învață să desenezi formele: cerc, pătrat, triunghi și stea. Urmărește traseul cu degetul!',
    '/api/v1/game-proxy/games/tracing-game/index.html?game=shapes-basic&lang=ro',
    'shapes', 1, 3, 6, 4,
    '{"skills": ["motricitate fină", "recunoașterea formelor", "trasare"], "tags": ["shapes", "tracing"], "itemCount": 4}'
  ),
  (
    'Trasează Literele A-F',
    'Trasează primele șase litere mari ale alfabetului — A, B, C, D, E, F.',
    '/api/v1/game-proxy/games/tracing-game/index.html?game=uppercase-a-to-f&lang=ro',
    'literacy', 2, 4, 7, 5,
    '{"skills": ["motricitate fină", "recunoașterea literelor", "pre-scriere"], "tags": ["letters", "tracing"], "itemCount": 6}'
  )
) AS v(title, description, game_url, category, difficulty_level,
        target_age_min, target_age_max, estimated_duration, learning_objectives)
WHERE NOT EXISTS (
  SELECT 1 FROM games g WHERE g.game_url = v.game_url
);

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260416000000''';
  END IF;
END
$wa$;
