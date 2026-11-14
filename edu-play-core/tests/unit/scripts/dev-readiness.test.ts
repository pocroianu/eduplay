import { describe, expect, it, vi } from 'vitest'

import {
  getComposeProjectEnvAnonKey,
  getSupabaseApiHealthUrl,
  getSupabaseStatusAnonKey,
  hasSupabaseCliStack,
  isSupabaseApiReady,
} from '../../../scripts/dev-readiness.mjs'

describe('dev Supabase readiness helpers', () => {
  it('probes the host-facing Supabase Auth health endpoint with GET', async () => {
    const request = vi.fn().mockResolvedValue({ statusCode: 200 })

    await expect(
      isSupabaseApiReady('http://localhost:54421', request)
    ).resolves.toBe(true)

    expect(request).toHaveBeenCalledWith(
      'http://localhost:54421/auth/v1/health',
      { method: 'GET' }
    )
  })

  it('includes Supabase auth headers when probing with an anon key', async () => {
    const request = vi.fn().mockResolvedValue({ statusCode: 200 })

    await expect(
      isSupabaseApiReady('http://localhost:54421', request, {
        apiKey: 'anon-key',
      })
    ).resolves.toBe(true)

    expect(request).toHaveBeenCalledWith(
      'http://localhost:54421/auth/v1/health',
      {
        method: 'GET',
        headers: {
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
        },
      }
    )
  })

  it('rejects empty replies and server errors as not ready', async () => {
    await expect(
      isSupabaseApiReady('http://localhost:54421', async () => null)
    ).resolves.toBe(false)

    await expect(
      isSupabaseApiReady('http://localhost:54421', async () => ({
        statusCode: 503,
      }))
    ).resolves.toBe(false)
  })

  it('normalizes trailing slashes before appending the auth health path', () => {
    expect(getSupabaseApiHealthUrl('http://localhost:54421/')).toBe(
      'http://localhost:54421/auth/v1/health'
    )
  })

  it('detects a Supabase CLI stack from status env output', () => {
    expect(
      hasSupabaseCliStack(
        [
          'ANON_KEY="anon"',
          'API_URL="http://127.0.0.1:54421"',
          'SERVICE_ROLE_KEY="service"',
        ].join('\n')
      )
    ).toBe(true)
  })

  it('treats missing Supabase CLI status output as no stack', () => {
    expect(hasSupabaseCliStack(null)).toBe(false)
    expect(hasSupabaseCliStack('')).toBe(false)
    expect(hasSupabaseCliStack('Stopped services: []')).toBe(false)
  })

  it('extracts the anon key from Supabase CLI status env output', () => {
    expect(
      getSupabaseStatusAnonKey(
        [
          'API_URL="http://127.0.0.1:54421"',
          'ANON_KEY="anon-key"',
          'SERVICE_ROLE_KEY="service"',
        ].join('\n')
      )
    ).toBe('anon-key')
  })

  it('treats missing Supabase CLI anon key output as unavailable', () => {
    expect(getSupabaseStatusAnonKey(null)).toBeNull()
    expect(getSupabaseStatusAnonKey('')).toBeNull()
    expect(getSupabaseStatusAnonKey('Stopped services: []')).toBeNull()
    expect(getSupabaseStatusAnonKey('API_URL="http://127.0.0.1:54421"')).toBeNull()
  })

  it('extracts the anon key from Docker Compose project env content', () => {
    expect(
      getComposeProjectEnvAnonKey(
        [
          'POSTGRES_PASSWORD=postgres',
          'SUPABASE_ANON_KEY=compose-anon-key',
          'SUPABASE_SERVICE_ROLE_KEY=service-key',
        ].join('\n')
      )
    ).toBe('compose-anon-key')
  })

  it('extracts quoted anon keys from Docker Compose project env content', () => {
    expect(
      getComposeProjectEnvAnonKey('SUPABASE_ANON_KEY="quoted-compose-anon-key"')
    ).toBe('quoted-compose-anon-key')
  })

  it('treats missing Docker Compose project anon keys as unavailable', () => {
    expect(getComposeProjectEnvAnonKey(null)).toBeNull()
    expect(getComposeProjectEnvAnonKey('')).toBeNull()
    expect(getComposeProjectEnvAnonKey('POSTGRES_PASSWORD=postgres')).toBeNull()
    expect(getComposeProjectEnvAnonKey('SUPABASE_ANON_KEY=')).toBeNull()
  })
})
