import { parse as parseDotenv } from 'dotenv'

const SUPABASE_AUTH_HEALTH_PATH = '/auth/v1/health'

export function getWindowsListeningPids(netstatOutput, port) {
  const pids = new Set()
  for (const line of (netstatOutput ?? '').split(/\r?\n/)) {
    const [protocol, localAddress, , state, rawPid] = line.trim().split(/\s+/)
    if (protocol !== 'TCP' || state !== 'LISTENING') continue
    const localPort = Number(localAddress.slice(localAddress.lastIndexOf(':') + 1))
    const pid = Number(rawPid)
    if (localPort === port && Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

export function getSupabaseApiHealthUrl(apiUrl) {
  return `${apiUrl.replace(/\/+$/, '')}${SUPABASE_AUTH_HEALTH_PATH}`
}

export async function isSupabaseApiReady(apiUrl, requestUrl, options = {}) {
  const requestOptions = {
    method: 'GET',
  }

  if (options.apiKey) {
    requestOptions.headers = {
      apikey: options.apiKey,
      Authorization: `Bearer ${options.apiKey}`,
    }
  }

  const response = await requestUrl(getSupabaseApiHealthUrl(apiUrl), requestOptions)

  return Boolean(
    response && response.statusCode >= 200 && response.statusCode < 300,
  )
}

export function hasSupabaseCliStack(statusEnvOutput) {
  return Boolean(statusEnvOutput && /^API_URL=/m.test(statusEnvOutput))
}

export function getSupabaseStatusAnonKey(statusEnvOutput) {
  if (!statusEnvOutput) {
    return null
  }

  const match = statusEnvOutput.match(/^ANON_KEY=(.*)$/m)
  if (!match) {
    return null
  }

  let value = match[1].trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return value || null
}

export function getComposeProjectEnvAnonKey(envFileContent) {
  if (!envFileContent) {
    return null
  }

  const values = parseDotenv(envFileContent)
  const value = values.SUPABASE_ANON_KEY?.trim()
  return value || null
}
