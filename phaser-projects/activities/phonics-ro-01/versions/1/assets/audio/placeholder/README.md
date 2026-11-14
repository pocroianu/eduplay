# Placeholder audio — TEMPORARY

These MP3s are **copies of shared SFX** used as placeholders so the Phaser loader has something to cache and so the e2e golden-path spec can verify the audio-playback wiring without waiting on real TTS or voice talent.

**Do not ship these to production.**

Phase 2 of EDU-64 replaces this whole folder with Romanian TTS generated via `scripts/generate-ro-tts.ts`, writing into `static/assets/audio/generated/`. Phase 6 (blocked on EDU-62) swaps in human recordings as an asset-only change.

## File list

| File | Stand-in for |
|---|---|
| `letter-a.mp3` | Romanian sound for "A" |
| `letter-m.mp3` | Romanian sound for "M" |
| `letter-p.mp3` | Romanian sound for "P" |
| `letter-l.mp3` | Romanian sound for "L" |
| `letter-s.mp3` | Romanian sound for "S" |
| `animal-dog.mp3` | "câine" + (optional dog bark) |
| `animal-cat.mp3` | "pisică" + (optional cat meow) |
| `animal-cow.mp3` | "vacă" + (optional cow moo) |
| `animal-sheep.mp3` | "oaie" + (optional sheep baa) |
