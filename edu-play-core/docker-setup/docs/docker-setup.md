# Deprecated historical Docker guide

This guide documents an older `docker-setup/`-first process and is no longer the source of truth.

Use these current docs instead:
- `../../README.md` for the supported local startup flow (`npm run dev:full`, `npm run dev:docker`, `npm run dev:stop`, `npm run dev:status`)
- `../../CLAUDE.md` for current developer conventions
- `../../env.example` for the current environment template filename

Historical notes remain below for context only.

# Docker Setup Guide

## Quick Start

```bash
# 1. Clone and enter project
git clone <repo-url>
cd eduplay

# 2. Copy environment file
cp .env.example .env

# 3. Start everything
make setup
# Or manually:
# docker compose up -d

# 4. Open in browser
# App:     http://localhost:3000
# Studio:  http://localhost:54423
# Email:   http://localhost:54424
```

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **App** | 3000 | Next.js application |
| **Supabase API** | 54421 | Main API endpoint |
| **Supabase Studio** | 54423 | Database GUI |
| **PostgreSQL** | 54422 | Database (direct access) |
| **Inbucket** | 54424 | Email testing UI |
| **Auth** | 54424 | GoTrue auth service |
| **REST** | 54325 | PostgREST API |
| **Realtime** | 54326 | Realtime subscriptions |
| **Storage** | 54327 | File storage API |

## Common Commands

### Using Make (Recommended)

```bash
make dev          # Start all services
make stop         # Stop all services
make restart      # Restart all services
make logs         # View all logs
make logs-app     # View app logs only

make db-studio    # Open Supabase Studio
make db-migrate   # Run migrations
make db-seed      # Seed database
make db-reset     # Reset database completely
make db-types     # Generate TypeScript types

make test         # Run all tests
make test-e2e     # Run E2E tests
make test-unit    # Run unit tests

make clean        # Remove build artifacts
make reset        # Full reset (removes volumes)
```

### Using Docker Compose Directly

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d app

# View logs
docker compose logs -f
docker compose logs -f app

# Stop services
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# Rebuild after Dockerfile changes
docker compose up -d --build

# Execute command in container
docker compose exec app npm run lint
docker compose exec supabase-db psql -U postgres
```

## Development Workflows

### Starting Fresh

```bash
make reset        # Remove everything
make setup        # Full setup from scratch
```

### After Pulling New Code

```bash
docker compose up -d --build    # Rebuild and start
make db-migrate                  # Run any new migrations
```

### After Schema Changes

```bash
make db-types     # Regenerate TypeScript types
```

### Viewing Emails (Password Reset, etc.)

1. Open http://localhost:54424
2. Emails appear automatically in Inbucket

### Connecting to Database

```bash
# Via psql in container
docker compose exec supabase-db psql -U postgres

# Via external tool
Host: localhost
Port: 54422
User: postgres
Password: postgres
Database: postgres
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3000

# Kill the process or change ports in docker-compose.yml
```

### Database Connection Issues

```bash
# Check if database is healthy
docker compose ps

# View database logs
docker compose logs supabase-db

# Restart database
docker compose restart supabase-db
```

### App Not Connecting to Supabase

1. Ensure `.env` file exists with correct values
2. Check that `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54421`
3. Verify Kong is running: `docker compose ps supabase-kong`

### Reset Everything

```bash
# Nuclear option - removes all data
docker compose down -v --remove-orphans
docker system prune -f
make setup
```

## Production Deployment

For production, use the production Dockerfile:

```bash
# Build production image
docker build -t eduplay:latest .

# Run production container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  eduplay:latest
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌─────────────────────────────────┐    │
│  │   Next.js   │────▶│         Kong Gateway            │    │
│  │   (App)     │     │         (Port 54421)            │    │
│  │  Port 3000  │     └──────────────┬──────────────────┘    │
│  └─────────────┘                    │                       │
│                                     ▼                       │
│         ┌───────────────────────────────────────────┐       │
│         │              Supabase Services            │       │
│         ├───────────┬───────────┬───────────┬───────┤       │
│         │   Auth    │   REST    │ Realtime  │Storage│       │
│         └─────┬─────┴─────┬─────┴─────┬─────┴───┬───┘       │
│               │           │           │         │           │
│               └───────────┴───────────┴─────────┘           │
│                           │                                  │
│                           ▼                                  │
│               ┌─────────────────────┐                       │
│               │    PostgreSQL       │                       │
│               │    (Port 54422)     │                       │
│               └─────────────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables Reference

See `.env.example` for all available variables.

**Required for local development:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side API key
- `JWT_SECRET` - JWT signing secret
