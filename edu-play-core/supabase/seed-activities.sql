-- Seed Activities for EduPlay
-- Idempotent: uses ON CONFLICT DO UPDATE

INSERT INTO activities (
  template, title, description, thumbnail_url,
  default_lang, default_theme, category, difficulty,
  target_age_min, target_age_max, estimated_duration,
  question_count, tags, subject, skills,
  is_published, created_at, updated_at
) VALUES
  (
    'multiple-choice',
    'Fructe Colorate',
    'Învață fructele colorate într-un mod distractiv!',
    NULL,
    'ro', 'nature', 'vocabulary', 'easy',
    3, 8, 5,
    3, '{fruits,food}', 'romanian', '{recunoașterea fructelor,vocabular alimentar}',
    true, now(), now()
  ),
  (
    'multiple-choice',
    'Prietenii Animale',
    'Descoperă animalele și învață cum se numesc!',
    NULL,
    'ro', 'nature', 'vocabulary', 'easy',
    3, 8, 5,
    5, '{animals,nature}', 'romanian', '{recunoașterea animalelor,vocabular despre natură}',
    true, now(), now()
  ),
  (
    'multiple-choice',
    'Curcubeul Culorilor',
    'Explorează culorile curcubeului și învață să le recunoști!',
    NULL,
    'ro', 'candy', 'colors', 'easy',
    3, 8, 5,
    4, '{colors,visual}', 'romanian', '{recunoașterea culorilor,percepție vizuală}',
    true, now(), now()
  ),
  (
    'multiple-choice',
    'La Piață',
    'Hai la piață să învățăm despre alimente!',
    NULL,
    'ro', 'nature', 'vocabulary', 'easy',
    3, 8, 5,
    4, '{food,shopping}', 'romanian', '{recunoașterea alimentelor,vocabular de cumpărături}',
    true, now(), now()
  ),
  (
    'multiple-choice',
    'Obiecte din Jur',
    'Învață numele obiectelor pe care le vezi în fiecare zi!',
    NULL,
    'ro', 'forest', 'vocabulary', 'easy',
    3, 8, 5,
    5, '{objects,vocabulary}', 'romanian', '{recunoașterea obiectelor,vocabular de uz zilnic}',
    true, now(), now()
  ),
  (
    'multiple-choice',
    'Minunile Naturii',
    'Descoperă minunile naturii și învață despre mediul înconjurător!',
    NULL,
    'ro', 'nature', 'vocabulary', 'easy',
    3, 8, 5,
    3, '{nature,environment}', 'romanian', '{elemente din natură,conștientizare ecologică}',
    true, now(), now()
  );
