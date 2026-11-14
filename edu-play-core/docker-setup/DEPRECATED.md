# Deprecated docker-setup directory

The `docker-setup/` directory is retained only for historical reference during cleanup work. Do not treat it as the active entrypoint for local development.

Current source-of-truth files in the repo root:
- `../README.md` for active startup/stop/status commands
- `../CLAUDE.md` for current developer guidance
- `../REQUIREMENTS.md` for maintained requirements
- `../docker-compose.yml`, `../Dockerfile`, and `../Dockerfile.dev` for the live Docker artifacts
- `../env.example` for the current environment template filename

## What is stale here

- old `make ...`-based instructions
- references to `.env.example` instead of `env.example`
- references to docs such as `DOCKER.md` that do not exist in the current repo

## What to use now

```bash
cd /path/to/edu-play-core
cp env.example .env
npm run dev:full
# or
npm run dev:docker
```

Use `npm run dev:stop` and `npm run dev:status` for the matching shutdown/status workflow.
