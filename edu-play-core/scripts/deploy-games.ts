/**
 * deploy-games.ts — CLI script to build, upload, and deploy Phaser games to Supabase Storage
 *
 * Usage:
 *   npx tsx scripts/deploy-games.ts --template multiple-choice [--build] [--assets] [--clean] [--dry-run]
 *   npx tsx scripts/deploy-games.ts --all [--build] [--assets] [--clean] [--dry-run]
 */

import { config as loadEnv } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_TEMPLATES = [
  'multiple-choice',
  'matching-game',
  'memory-game',
  'categorize-game',
  'sequence-order',
  'tracing-game',
  'counting-game',
  'pattern-game',
  'repeat-sequence',
  'listen-tap',
]

const EDUPLAY_ROOT = process.cwd()
const PHASER_ROOT = path.resolve(EDUPLAY_ROOT, '../phaser-projects')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  template: string | null
  all: boolean
  build: boolean
  assets: boolean
  clean: boolean
  dryRun: boolean
} {
  const args = argv.slice(2)
  let template: string | null = null
  let all = false
  let build = false
  let assets = false
  let clean = false
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--template':
        template = args[++i] || null
        break
      case '--all':
        all = true
        break
      case '--build':
        build = true
        break
      case '--assets':
        assets = true
        break
      case '--clean':
        clean = true
        break
      case '--dry-run':
        dryRun = true
        break
      default:
        console.error(`✗ Unknown argument: ${args[i]}`)
        process.exit(1)
    }
  }

  return { template, all, build, assets, clean, dryRun }
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return CONTENT_TYPES[ext] || 'application/octet-stream'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex').slice(0, 32)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function deterministicActivityId(template: string, catalogId: string): string {
  return deterministicUuid(`activity-renderer:${template}:${catalogId}`)
}

function deterministicActivityVersionId(template: string, catalogId: string): string {
  return deterministicUuid(`activity-renderer-version:${template}:${catalogId}:1`)
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function readTemplateRegistry(): Map<string, { label?: string; gameType?: string }> {
  const registryPath = path.join(PHASER_ROOT, 'packages', 'game-core', 'templates', 'registry.json')
  const registry = readJson(registryPath) as { templates?: Array<{ id: string; label?: string; gameType?: string }> }
  return new Map((registry.templates ?? []).map((entry) => [entry.id, entry]))
}

function printUsage() {
  console.log(`
Usage:
  npx tsx scripts/deploy-games.ts --template <name> [--build] [--assets] [--clean] [--dry-run]
  npx tsx scripts/deploy-games.ts --all [--build] [--assets] [--clean] [--dry-run]

Options:
  --template <name>  Deploy a specific template (e.g., multiple-choice)
  --all              Deploy all known templates
  --build            Run npm run build:template -- --template <template> in phaser-projects first
  --assets           Also upload shared assets to the assets bucket
  --clean            Remove public/games/<template>/ after uploading
  --dry-run          Print what would be uploaded without actually uploading

Known templates: ${ALL_TEMPLATES.join(', ')}
`)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()
  const opts = parseArgs(process.argv)

  // Validate args
  if (!opts.template && !opts.all) {
    console.error('✗ Must specify --template <name> or --all')
    printUsage()
    process.exit(1)
  }

  if (opts.template && opts.all) {
    console.error('✗ Cannot specify both --template and --all')
    process.exit(1)
  }

  const templates = opts.all ? ALL_TEMPLATES : [opts.template!]
  const templateRegistry = readTemplateRegistry()

  // Validate template names
  for (const t of templates) {
    if (!ALL_TEMPLATES.includes(t)) {
      console.error(`✗ Unknown template: ${t}`)
      console.error(`  Known templates: ${ALL_TEMPLATES.join(', ')}`)
      process.exit(1)
    }
  }

  // Validate phaser-projects path
  if (!fs.existsSync(PHASER_ROOT)) {
    console.error(`✗ phaser-projects not found at: ${PHASER_ROOT}`)
    console.error('  Expected sibling directory to edu-play-core')
    process.exit(1)
  }

  // Connect to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54421'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (opts.dryRun ? 'dry-run-service-role-key' : null)

  if (!serviceRoleKey) {
    console.error('✗ SUPABASE_SERVICE_ROLE_KEY not set in environment or .env.local file')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\n🎮 Deploy Activity renderers to Supabase Storage`)
  console.log(`   Supabase: ${supabaseUrl}`)
  console.log(`   Phaser root: ${PHASER_ROOT}`)
  console.log(`   Templates: ${templates.join(', ')}`)
  console.log(`   Options: ${[opts.build && 'build', opts.assets && 'assets', opts.clean && 'clean', opts.dryRun && 'dry-run'].filter(Boolean).join(', ') || 'none'}`)
  console.log('')

  // Ensure buckets exist
  if (!opts.dryRun) {
    const { error: renderersErr } = await supabase.storage.createBucket('activity-renderers', { public: true })
    if (renderersErr && !renderersErr.message.includes('already exists')) {
      console.error(`✗ Failed to create activity-renderers bucket: ${renderersErr.message}`)
      process.exit(1)
    }

    const { error: assetsErr } = await supabase.storage.createBucket('assets', { public: true })
    if (assetsErr && !assetsErr.message.includes('already exists')) {
      console.error(`✗ Failed to create assets bucket: ${assetsErr.message}`)
      process.exit(1)
    }
    console.log('✓ Storage buckets ready (activity-renderers, assets)')
  }

  let totalGameFiles = 0
  let totalGameBytes = 0
  let totalAssetFiles = 0
  let totalAssetBytes = 0
  let totalDbUpdates = 0

  // ── Process each template ──────────────────────────────────────────────────

  for (const template of templates) {
    console.log(`\n── ${template} ${'─'.repeat(60 - template.length)}`)

    // Build step
    if (opts.build) {
      console.log(`\n→ Building ${template}...`)
      try {
        execSync(`npm run build:template -- --template ${template}`, {
          cwd: PHASER_ROOT,
          stdio: 'inherit',
        })
        console.log(`✓ Build succeeded for ${template}`)
      } catch {
        console.error(`✗ Build failed for ${template}, aborting`)
        process.exit(1)
      }
    }

    // Upload Activity renderer bundle
    const distDir = path.join(PHASER_ROOT, 'templates', template, 'dist')
    if (!fs.existsSync(distDir)) {
      console.error(`✗ Dist directory not found: ${distDir}`)
      console.error(`  Did you forget --build or run the build manually?`)
      continue
    }

    const files = walkDir(distDir)
    if (files.length === 0) {
      console.warn(`⚠ No files found in ${distDir}`)
      continue
    }

    console.log(`\n→ Uploading ${files.length} files from ${template}/dist/`)

    for (const filePath of files) {
      const relativePath = path.relative(distDir, filePath).split(path.sep).join('/')
      const storagePath = `${template}/${relativePath}`
      const buffer = fs.readFileSync(filePath)
      const contentType = getContentType(filePath)
      const size = buffer.length

      if (opts.dryRun) {
        console.log(`  [dry-run] activity-renderers/${storagePath} (${formatSize(size)}, ${contentType})`)
      } else {
        const { error } = await supabase.storage
          .from('activity-renderers')
          .upload(storagePath, buffer, { contentType, upsert: true })

        if (error) {
          console.error(`  ✗ activity-renderers/${storagePath} — ${error.message}`)
        } else {
          console.log(`  ✓ activity-renderers/${storagePath} (${formatSize(size)})`)
        }
      }

      totalGameFiles++
      totalGameBytes += size
    }

    // Upsert activities from catalog.json
    const catalogPath = path.join(distDir, 'configs', 'catalog.json')
    if (fs.existsSync(catalogPath)) {
      console.log(`\n→ Syncing activities from catalog.json...`)
      const catalog = readJson(catalogPath) as { games?: Array<Record<string, any>> }
      const games = catalog.games || []
      const templateConfig = templateRegistry.get(template)

      if (opts.dryRun) {
        console.log(`  [dry-run] Would upsert ${games.length} activities and Activity Versions`)
      } else {
        const { error: typeError } = await supabase.from('activity_types').upsert(
          {
            type_id: template,
            display_name: templateConfig?.label ?? template,
            category: templateConfig?.gameType ?? 'activity',
            config_schema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              type: 'object',
            },
            renderer_key: template,
            version: 1,
          },
          { onConflict: 'type_id' },
        )
        if (typeError) {
          console.error(`  ✗ Failed to upsert Activity Type ${template}: ${typeError.message}`)
          continue
        }

        for (const game of games) {
          const configPath = path.join(distDir, 'configs', 'games', game.id, 'config.json')
          if (!fs.existsSync(configPath)) {
            console.error(`  ✗ Missing config for ${template}/${game.id}: ${configPath}`)
            continue
          }

          const configData = readJson(configPath)
          const activityId = deterministicActivityId(template, game.id)
          const versionId = deterministicActivityVersionId(template, game.id)
          const activityRow = {
            id: activityId,
            template,
            title: game.name?.ro || game.name?.en || game.id,
            description: game.description?.ro || game.description?.en || null,
            default_lang: 'ro',
            default_theme: null as string | null,
            category: 'vocabulary',
            difficulty: game.difficulty || 'easy',
            target_age_min: 3,
            target_age_max: 8,
            estimated_duration: 5,
            question_count: game.questionCount || game.roundCount || null,
            tags: game.tags || [],
            subject: 'romanian',
            skills: [] as string[],
            config_data: configData,
            config_schema_version: 1,
            status: 'published',
            is_published: true,
          }

          const { error: upsertErr } = await supabase
            .from('activities')
            .upsert(activityRow, { onConflict: 'id' })

          if (upsertErr) {
            console.error(`  ✗ Failed to upsert activity ${game.id}: ${upsertErr.message}`)
            continue
          }

          const { data: existingVersion, error: inspectVersionError } = await supabase
            .from('activity_versions')
            .select('id, config_data')
            .eq('id', versionId)
            .maybeSingle()

          if (inspectVersionError) {
            console.error(`  ✗ Failed to inspect Activity Version ${game.id}: ${inspectVersionError.message}`)
            continue
          }

          if (!existingVersion) {
            const { error: versionError } = await supabase.from('activity_versions').insert({
              id: versionId,
              activity_id: activityId,
              activity_type_id: template,
              version_number: 1,
              config_data: configData,
              config_schema_version: 1,
            })
            if (versionError) {
              console.error(`  ✗ Failed to insert Activity Version ${game.id}: ${versionError.message}`)
              continue
            }
          }

          console.log(`  ✓ Activity: ${activityRow.title} (${template}/${game.id})`)
          totalDbUpdates++
        }
      }
    }

    // Clean step
    if (opts.clean) {
      const publicGamesDir = path.join(EDUPLAY_ROOT, 'public', 'games', template)
      if (fs.existsSync(publicGamesDir)) {
        if (opts.dryRun) {
          console.log(`\n  [dry-run] Would remove ${publicGamesDir}`)
        } else {
          fs.rmSync(publicGamesDir, { recursive: true, force: true })
          console.log(`\n✓ Cleaned public/games/${template}/`)
        }
      }
    }
  }

  // ── Upload shared assets ───────────────────────────────────────────────────

  if (opts.assets) {
    const assetsDir = path.join(PHASER_ROOT, 'assets')
    if (!fs.existsSync(assetsDir)) {
      console.error(`\n✗ Assets directory not found: ${assetsDir}`)
    } else {
      const assetFiles = walkDir(assetsDir)
      console.log(`\n── shared assets ${'─'.repeat(48)}`)
      console.log(`→ Uploading ${assetFiles.length} asset files`)

      for (const filePath of assetFiles) {
        const relativePath = path.relative(assetsDir, filePath).split(path.sep).join('/')
        const storagePath = relativePath
        const buffer = fs.readFileSync(filePath)
        const contentType = getContentType(filePath)
        const size = buffer.length

        if (opts.dryRun) {
          console.log(`  [dry-run] assets/${storagePath} (${formatSize(size)}, ${contentType})`)
        } else {
          const { error } = await supabase.storage
            .from('assets')
            .upload(storagePath, buffer, { contentType, upsert: true })

          if (error) {
            console.error(`  ✗ assets/${storagePath} — ${error.message}`)
          } else {
            console.log(`  ✓ assets/${storagePath} (${formatSize(size)})`)
          }
        }

        totalAssetFiles++
        totalAssetBytes += size
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  📊 Deployment Summary${opts.dryRun ? ' (DRY RUN)' : ''}`)
  console.log(`${'═'.repeat(64)}`)
  console.log(`  Activity renderers: ${totalGameFiles} files, ${formatSize(totalGameBytes)}`)
  if (opts.assets) {
    console.log(`  Assets bucket: ${totalAssetFiles} files, ${formatSize(totalAssetBytes)}`)
  }
  console.log(`  DB updated:    ${totalDbUpdates} Activity rows`)
  console.log(`  Time:          ${elapsed}s`)
  console.log(`${'═'.repeat(64)}\n`)
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
