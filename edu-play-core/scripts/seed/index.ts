import { logSection, logError } from './config';
import type { SeedTierData } from './types';
import { seedAuthUsers } from './seeders/auth-users';
import { seedClasses } from './seeders/classes';
import { seedStudents } from './seeders/students';
import { seedParentLinks } from './seeders/parent-links';
import { seedActivities } from './seeders/activities';
import { seedAssignments } from './seeders/assignments';
import { seedActivityProgress } from './seeders/activity-progress';
import { seedNotifications } from './seeders/notifications';
import { cleanSeedData } from './clean';
import { loadSeedActivities, resolvePhaserRoot } from './phaser-catalog';
import { syncActivityRenderers } from './renderer-sync';

async function loadTierData(tier: string): Promise<SeedTierData> {
  switch (tier) {
    case 'minimal': {
      const mod = await import('./data/minimal');
      return mod.minimalData;
    }
    case 'medium': {
      const mod = await import('./data/medium');
      return mod.mediumData;
    }
    case 'full': {
      const mod = await import('./data/full');
      return mod.fullData;
    }
    default:
      throw new Error(`Unknown tier: ${tier}. Use: minimal, medium, full`);
  }
}

function printCredentials(data: SeedTierData): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  EduPlay Seed Data — ${data.tier.toUpperCase()} tier`.padEnd(59) + '║');
  console.log('╠══════════════════════════════════════════════════════════╣');

  console.log('║  TEACHERS:'.padEnd(59) + '║');
  for (const t of data.teachers) {
    console.log(`║    ${t.email.padEnd(30)} pw: ${t.password}`.padEnd(59) + '║');
  }

  console.log('║'.padEnd(59) + '║');
  console.log('║  PARENTS:'.padEnd(59) + '║');
  for (const p of data.parents) {
    console.log(`║    ${p.email.padEnd(30)} pw: ${p.password}`.padEnd(59) + '║');
  }

  console.log('║'.padEnd(59) + '║');
  console.log('║  LEARNERS:'.padEnd(59) + '║');
  for (const s of data.students.slice(0, 10)) {
    console.log(`║    ${s.username.padEnd(20)} PIN: ${s.pin}`.padEnd(59) + '║');
  }
  if (data.students.length > 10) {
    console.log(`║    ... and ${data.students.length - 10} more`.padEnd(59) + '║');
  }

  console.log('╚══════════════════════════════════════════════════════════╝');
}

function parseArgs(args: string[]): {
  isClean: boolean;
  tier: string;
  syncRenderers: boolean;
  buildRenderers: boolean;
  phaserRoot: string;
} {
  const isClean = args.includes('--clean');
  const tierIndex = args.indexOf('--tier');
  const phaserRootIndex = args.indexOf('--phaser-root');
  return {
    isClean,
    tier: tierIndex !== -1 ? args[tierIndex + 1] : 'medium',
    syncRenderers: !args.includes('--no-renderers'),
    buildRenderers: !args.includes('--no-build'),
    phaserRoot: phaserRootIndex !== -1 ? args[phaserRootIndex + 1] : resolvePhaserRoot(),
  };
}

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
    console.log(`Seed the local EduPlay database from the repository root:

  npm run db:setup               Start Supabase, prepare local env, seed medium
  npm run db:seed                Seed medium (Supabase must already be running)
  npm run db:seed:minimal        Seed the smallest demo dataset
  npm run db:seed:full           Seed the full demo dataset
  npm run db:seed -- --tier minimal --dry-run

Options:
  --tier minimal|medium|full     Dataset size (default: medium)
  --dry-run                     Validate configs and show counts; no writes/builds
  --no-build                    Reuse the existing Activity host build
  --no-renderers                Skip renderer build/upload (Activities may not launch)
  --phaser-root <path>           Override the sibling Phaser project directory
  --clean                       Delete the selected tier's seed data and users
  --help, -h                    Show this help

Normal seeding builds and uploads the Activity host and prints demo logins.
The seed API target is local: http://127.0.0.1:54421`);
    return;
  }
  const args = parseArgs(cliArgs);

  if (cliArgs.includes('--dry-run')) {
    const data = await loadTierData(args.tier);
    const activities = loadSeedActivities(data.tier, { phaserRoot: args.phaserRoot });
    logSection(`Dry run: ${args.isClean ? 'clean' : 'seed'} ${data.tier}`);
    console.log(`  Teachers: ${data.teachers.length}; parents: ${data.parents.length}; learners: ${data.students.length}; Activities: ${activities.length}`);
    console.log('  Configs validated. No database/storage writes or builds performed.');
    return;
  }

  if (args.isClean) {
    console.log('\n🧹 Cleaning seed data...');
    const data = await loadTierData(args.tier);
    await cleanSeedData(data, { phaserRoot: args.phaserRoot });
    console.log('\n✅ Clean complete!\n');
    return;
  }

  console.log(`\n🌱 Seeding EduPlay database — ${args.tier} tier\n`);
  const startTime = Date.now();

  const data = await loadTierData(args.tier);

  // Validate selected Phaser Activity configs before any partial DB writes.
  const selectedActivities = loadSeedActivities(data.tier, { phaserRoot: args.phaserRoot });
  console.log(`  ✓ Validated ${selectedActivities.length} Phaser Activity config(s)`);

  if (args.syncRenderers) {
    await syncActivityRenderers(selectedActivities, {
      phaserRoot: args.phaserRoot,
      build: args.buildRenderers,
    });
  } else {
    console.log('  ⚠ Renderer sync skipped (--no-renderers). Seeded Activities will not launch until renderers are synced.');
  }

  const userIds = await seedAuthUsers(data);
  const classMap = await seedClasses(data, userIds);
  await seedStudents(data, userIds, classMap);
  await seedParentLinks(data, userIds);
  const activities = await seedActivities(selectedActivities);
  await seedAssignments(data, userIds, classMap, activities);
  await seedActivityProgress(data, userIds, activities);
  await seedNotifications(data, userIds);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logSection(`Seeding complete in ${elapsed}s`);
  printCredentials(data);
}

main().catch((err) => {
  logError(`Seed failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
