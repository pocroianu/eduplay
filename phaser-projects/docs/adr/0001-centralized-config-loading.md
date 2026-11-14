# Centralize Activity config loading in game-core

EduPlay Activity launches may provide a same-origin `configUrl` override for an exact Activity Version config document, while legacy/static launches still load bundled configs. We decided active Phaser templates should load playable config through `game-core`'s `ConfigLoader` instead of duplicating `configUrl`, static fallback, language, cache, and validation behavior inside each template.

## Consequences

- `configUrl` is read from the iframe query string as boot-time input; it is not delivered only through `ACTIVITY_INIT`.
- `ConfigLoader` owns config override validation and fallback behavior.
- Active templates should migrate away from manual `fetch(${basePath}/${gameId}/config.json)` logic.
- All shipped templates under `templates/` are considered Activity renderers and should be registered in `edu-play-core` Activity types.
- The code-review webhook workflow added on this branch is not needed for this migration and should be deleted rather than hardened here.
