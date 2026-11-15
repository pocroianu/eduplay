#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import packages from './lib/activity-package.cjs';

type Kind = 'metadata' | 'config' | 'strings' | 'assets' | 'content';
interface Diagnostic { file: string; kind: Kind; message: string }
interface PackageResult {
  files: Array<{ file: string; kind: Kind }>;
  diagnostics: Diagnostic[];
}
const { readActivityPackage } = packages as {
  readActivityPackage: (activityRoot: string, libraryRoot: string) => PackageResult;
};

function main(): void {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--root');
  if (flag >= 0 && !args[flag + 1]) throw new Error('Missing value for --root');
  const root = path.resolve(flag >= 0 ? args[flag + 1] : process.cwd());
  const activitiesRoot = path.join(root, 'activities');
  const packages: PackageResult[] = fs.existsSync(activitiesRoot)
    ? fs.readdirSync(activitiesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => readActivityPackage(path.join(activitiesRoot, entry.name), root))
    : [];
  const files = packages.flatMap(result => result.files);
  const diagnostics = packages.flatMap(result => result.diagnostics);
  const labels: Record<Kind, string> = {
    metadata: 'Activity metadata', config: 'Activity game configs',
    strings: 'Language strings', assets: 'Activity asset manifests', content: 'Activity versions',
  };
  for (const kind of Object.keys(labels) as Kind[]) {
    console.log('\n' + labels[kind]);
    for (const file of files.filter(file => file.kind === kind)) {
      const errors = diagnostics.filter(error => error.file === file.file);
      console.log(`  ${errors.length ? 'FAIL' : 'PASS'} ${path.relative(root, file.file)}`);
    }
    for (const error of diagnostics.filter(error => error.kind === kind)) {
      console.error(`  ${path.relative(root, error.file)}: ${error.message}`);
    }
  }
  console.log(`\nVALIDATION SUMMARY\nTotal files: ${files.length}\nFailed: ${diagnostics.length}`);
  process.exitCode = diagnostics.length ? 1 : 0;
}

main();
