# ===========================================
# EduPlay Development Makefile
# ===========================================
# Usage: make <command>

.PHONY: help install dev build start stop restart logs clean reset db-reset db-migrate db-seed db-studio db-types test test-e2e test-unit lint format

# Default target
help:
	@echo "EduPlay Development Commands"
	@echo "============================"
	@echo ""
	@echo "Setup:"
	@echo "  make install      - Install dependencies and setup environment"
	@echo "  make setup        - Full setup (install + start + migrate + seed)"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services (Docker)"
	@echo "  make dev-local    - Start Next.js only (requires external Supabase)"
	@echo "  make stop         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - View all service logs"
	@echo "  make logs-app     - View Next.js logs only"
	@echo "  make logs-db      - View PostgreSQL logs only"
	@echo ""
	@echo "Database:"
	@echo "  make db-studio    - Open Supabase Studio (localhost:54423)"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database with test data"
	@echo "  make db-reset     - Reset database (drop + migrate + seed)"
	@echo "  make db-types     - Generate TypeScript types from schema"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-unit    - Run unit tests"
	@echo "  make test-e2e     - Run E2E tests"
	@echo "  make test-e2e-ui  - Run E2E tests with UI"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint         - Run linter"
	@echo "  make format       - Format code"
	@echo "  make typecheck    - Run TypeScript check"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make reset        - Full reset (clean + remove volumes)"

# ===========================================
# Setup
# ===========================================

install:
	@echo "📦 Installing dependencies..."
	npm ci
	@echo "📄 Creating .env file..."
	@if [ ! -f .env ]; then cp .env.example .env; fi
	@echo "✅ Setup complete!"

setup: install dev db-migrate db-seed
	@echo "🎉 Full setup complete!"
	@echo "   App:     http://localhost:3000"
	@echo "   Studio:  http://localhost:54423"

# ===========================================
# Development
# ===========================================

dev:
	@echo "🚀 Starting all services..."
	docker compose up -d
	@echo "✅ Services started!"
	@echo "   App:     http://localhost:3000"
	@echo "   API:     http://localhost:54421"
	@echo "   Studio:  http://localhost:54423"
	@echo "   Email:   http://localhost:54424"

dev-local:
	@echo "🚀 Starting Next.js (local mode)..."
	npm run dev

stop:
	@echo "🛑 Stopping all services..."
	docker compose down
	@echo "✅ Services stopped!"

restart: stop dev

logs:
	docker compose logs -f

logs-app:
	docker compose logs -f app

logs-db:
	docker compose logs -f supabase-db

# ===========================================
# Database
# ===========================================

db-studio:
	@echo "🎨 Opening Supabase Studio..."
	@open http://localhost:54423 2>/dev/null || xdg-open http://localhost:54423 2>/dev/null || echo "Open http://localhost:54423 in your browser"

db-migrate:
	@echo "🔄 Running migrations..."
	docker compose exec supabase-db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/migrations/*.sql 2>/dev/null || echo "Migrations applied during startup"
	@echo "✅ Migrations complete!"

db-seed:
	@echo "🌱 Seeding database..."
	docker compose exec supabase-db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/seed.sql 2>/dev/null || echo "Seed applied during startup"
	@echo "✅ Seeding complete!"

db-reset:
	@echo "⚠️  Resetting database..."
	docker compose down -v
	docker compose up -d supabase-db
	@sleep 5
	docker compose up -d
	@echo "✅ Database reset complete!"

db-types:
	@echo "📝 Generating TypeScript types..."
	npx supabase gen types typescript --local > src/shared/types/database.ts
	@echo "✅ Types generated!"

# ===========================================
# Testing
# ===========================================

test: test-unit test-e2e

test-unit:
	@echo "🧪 Running unit tests..."
	npm run test:unit

test-e2e:
	@echo "🎭 Running E2E tests..."
	npm run test:e2e

test-e2e-ui:
	@echo "🎭 Running E2E tests with UI..."
	npm run test:e2e:ui

# ===========================================
# Code Quality
# ===========================================

lint:
	@echo "🔍 Linting code..."
	npm run lint

format:
	@echo "✨ Formatting code..."
	npm run format

typecheck:
	@echo "📘 Type checking..."
	npx tsc --noEmit

# ===========================================
# Cleanup
# ===========================================

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf coverage
	rm -rf playwright-report
	rm -rf test-results
	@echo "✅ Clean complete!"

reset: clean
	@echo "🔥 Full reset (removing volumes)..."
	docker compose down -v --remove-orphans
	rm -rf node_modules
	@echo "✅ Reset complete! Run 'make setup' to start fresh."
