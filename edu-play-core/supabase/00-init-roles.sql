-- Initialize Supabase roles and schemas
-- This runs before the main schema

-- Create roles if they don't exist
DO $$
BEGIN
  -- Create supabase_admin role
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN PASSWORD 'postgres';
  END IF;

  -- Create authenticator role (used by PostgREST)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;

  -- Create anon role
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
    GRANT anon TO authenticator;
  END IF;

  -- Create authenticated role
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
    GRANT authenticated TO authenticator;
  END IF;

  -- Create service_role
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT service_role TO authenticator;
  END IF;

  -- Create storage admin role (used by Storage API)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'postgres';
  END IF;

  -- Create auth admin role (used by GoTrue/Auth service)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'postgres';
  END IF;

  -- Create realtime admin role (used by Realtime service)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin LOGIN PASSWORD 'postgres';
  END IF;
END
$$;

-- Create auth schema (required for Supabase Auth)
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Create storage schema (required for Supabase Storage)
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Create common extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Grant schema permissions to admin roles
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, supabase_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA extensions TO supabase_admin;

-- Grant permissions on auth schema
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin, supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin, supabase_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin, supabase_admin;

-- Grant permissions on storage schema
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin, supabase_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA storage TO supabase_storage_admin, supabase_admin;

-- Set search path for roles
ALTER ROLE supabase_auth_admin SET search_path TO auth, public;
ALTER ROLE supabase_storage_admin SET search_path TO storage, public;
ALTER ROLE authenticator SET search_path TO public;
