import { spawn } from 'child_process';
import { mkdir, readFile, writeFile, appendFile } from 'fs/promises';
import { isAbsolute, join, relative, resolve } from 'path';

import { PromptBuilder } from '../src/training/PromptBuilder';
import { ComfyUIProvider } from '../src/providers/image/ComfyUIProvider';

type BenchmarkStatus = 'completed' | 'failed' | 'skipped';

interface BenchmarkArgs {
  subjects: string[];
  outputDir: string;
  promptPreset: keyof typeof PROMPT_PRESETS;
  width: number;
  height: number;
  qwenPython: string;
  qwenDiffusersSource: string;
  qwenBaseSteps: number;
  qwenBaseMemoryMode: 'model-offload' | 'sequential-offload' | 'full-gpu' | 'auto';
  qwenLightningSteps: number;
  qwenLightningMemoryMode: 'model-offload' | 'sequential-offload' | 'full-gpu' | 'auto';
  qwenBaseLocalFilesOnly: boolean;
  qwenLightningLocalFilesOnly: boolean;
  qwenLightningLoraPath: string;
  seedBase: number;
  sdxlPromptMode: 'same-as-qwen' | 'existing-template';
  skipQwenBase: boolean;
  skipQwenLightning: boolean;
  skipSdxl: boolean;
}

interface SubjectPlan {
  subject: string;
  seed: number;
  prompt: string;
  negativePrompt: string;
}

interface VariantSummary {
  status: BenchmarkStatus;
  variant: string;
  outputDir: string;
  manifestPath?: string;
  durationMs?: number;
  command?: string;
  error?: string;
  settings: Record<string, unknown>;
}

interface BenchmarkSummary {
  startedAt: string;
  completedAt?: string;
  outputDir: string;
  subjects: SubjectPlan[];
  promptPreset: string;
  variants: Record<string, VariantSummary>;
}

interface AiContentConfig {
  providers?: {
    image?: {
      config?: {
        baseUrl?: string;
      };
    };
  };
}

const packageRoot = resolve(__dirname, '..');
const runtimeRoot = join(packageRoot, '.runtime');
const qwenRuntimeRoot = join(runtimeRoot, 'qwen-image');
const promptBuilder = new PromptBuilder();

const PROMPT_PRESETS = {
  'bulk-baseline':
    "friendly cartoon {subject}, flat children's picture book illustration, centered on a clean white background",
  'bulk-house':
    "friendly cartoon {subject}, flat children's picture book illustration, bold clean outline, flat colors, isolated single subject, centered on a clean white background",
  'sticker-flashcard':
    "friendly cartoon {subject}, clean sticker-style illustration, bold outline, flat colors, isolated single subject, children's flashcard art, centered on a pure white background",
} as const;

const DEFAULT_NEGATIVE_PROMPT =
  'photo, realistic, dark scene, text, watermark, cluttered background, scenery, extra objects, detailed background, dramatic lighting, heavy shadows, painterly texture, 3d render';

function parseArgs(argv: string[]): BenchmarkArgs {
  const options = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags.add(token);
      continue;
    }

    options.set(token, next);
    index += 1;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const subjects = (options.get('--subjects') || 'fox,elephant')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (subjects.length === 0) {
    throw new Error('At least one subject is required.');
  }

  const promptPreset =
    (options.get('--prompt-preset') as keyof typeof PROMPT_PRESETS | undefined) || 'bulk-house';
  if (!(promptPreset in PROMPT_PRESETS)) {
    throw new Error(`Unsupported prompt preset: ${promptPreset}`);
  }

  const sdxlPromptMode =
    (options.get('--sdxl-prompt-mode') as 'same-as-qwen' | 'existing-template' | undefined)
    || 'same-as-qwen';

  return {
    subjects,
    outputDir: resolve(
      options.get('--output-dir') || join(runtimeRoot, 'image-benchmarks', timestamp)
    ),
    promptPreset,
    width: Number(options.get('--width') || '512'),
    height: Number(options.get('--height') || '512'),
    qwenPython: resolve(
      options.get('--qwen-python')
      || join(qwenRuntimeRoot, '.venv', 'Scripts', 'python.exe')
    ),
    qwenDiffusersSource: options.get('--qwen-diffusers-source') || 'installed',
    qwenBaseSteps: Number(options.get('--qwen-base-steps') || '12'),
    qwenBaseMemoryMode:
      (options.get('--qwen-base-memory-mode') as BenchmarkArgs['qwenBaseMemoryMode'] | undefined)
      || 'sequential-offload',
    qwenLightningSteps: Number(options.get('--qwen-lightning-steps') || '4'),
    qwenLightningMemoryMode:
      (options.get('--qwen-lightning-memory-mode') as BenchmarkArgs['qwenLightningMemoryMode'] | undefined)
      || 'model-offload',
    qwenBaseLocalFilesOnly: !flags.has('--allow-qwen-base-downloads'),
    qwenLightningLocalFilesOnly: !flags.has('--allow-qwen-lightning-downloads'),
    qwenLightningLoraPath: resolve(
      options.get('--qwen-lightning-lora-path')
      || join(
        qwenRuntimeRoot,
        'adapters',
        'Qwen-Image-Lightning',
        'Qwen-Image-Lightning-4steps-V1.0.safetensors'
      )
    ),
    seedBase: Number(options.get('--seed-base') || '510000'),
    sdxlPromptMode,
    skipQwenBase: flags.has('--skip-qwen-base'),
    skipQwenLightning: flags.has('--skip-qwen-lightning'),
    skipSdxl: flags.has('--skip-sdxl'),
  };
}

function buildSubjectPlan(args: BenchmarkArgs): SubjectPlan[] {
  const promptTemplate = PROMPT_PRESETS[args.promptPreset];

  return args.subjects.map((subject, index) => ({
    subject,
    seed: args.seedBase + index,
    prompt: promptTemplate.replace('{subject}', subject),
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  }));
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function appendLog(filePath: string, message: string): Promise<void> {
  await appendFile(filePath, `${message}\n`, 'utf-8');
}

function toPackageRelativePath(filePath: string): string {
  if (!isAbsolute(filePath)) {
    return filePath;
  }

  const relativePath = relative(packageRoot, filePath);
  if (!relativePath.startsWith('..')) {
    return relativePath;
  }

  return filePath;
}

function buildQwenCommand(
  args: BenchmarkArgs,
  variantOutputDir: string,
  variant: 'qwen-base' | 'qwen-lightning'
): { command: string; argv: string[] } {
  const commandArgs = [
    '-X',
    'faulthandler',
    'scripts/qwen-image-spike.py',
    '--execute',
    '--subjects',
    args.subjects.join(','),
    '--prompt-preset',
    args.promptPreset,
    '--width',
    String(args.width),
    '--height',
    String(args.height),
    '--device',
    'cuda',
    '--diffusers-source',
    args.qwenDiffusersSource,
    '--output-dir',
    toPackageRelativePath(variantOutputDir),
    '--seed-base',
    String(args.seedBase),
  ];

  if (variant === 'qwen-base') {
    commandArgs.push('--steps', String(args.qwenBaseSteps));
    commandArgs.push('--memory-mode', args.qwenBaseMemoryMode);
    if (args.qwenBaseLocalFilesOnly) {
      commandArgs.push('--local-files-only');
    }
  } else {
    commandArgs.push('--steps', String(args.qwenLightningSteps));
    commandArgs.push('--memory-mode', args.qwenLightningMemoryMode);
    commandArgs.push('--true-cfg-scale', '1.0');
    commandArgs.push('--negative-prompt', '');
    commandArgs.push('--lora-path', toPackageRelativePath(args.qwenLightningLoraPath));
    if (args.qwenLightningLocalFilesOnly) {
      commandArgs.push('--local-files-only');
    }
  }

  return {
    command: `${args.qwenPython} ${commandArgs.join(' ')}`,
    argv: commandArgs,
  };
}

async function runProcess(
  command: string,
  argv: string[],
  cwd: string,
  logFilePath: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, argv, {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONFAULTHANDLER: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', async (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      await appendLog(logFilePath, text.trimEnd());
    });

    child.stderr.on('data', async (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      await appendLog(logFilePath, text.trimEnd());
    });

    child.on('error', (error) => {
      rejectProcess(error);
    });

    child.on('close', (code) => {
      resolveProcess({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function runQwenVariant(
  args: BenchmarkArgs,
  summary: BenchmarkSummary,
  variant: 'qwen-base' | 'qwen-lightning'
): Promise<void> {
  const variantOutputDir = join(args.outputDir, variant);
  const wrapperLogPath = join(variantOutputDir, 'wrapper.log');
  const startTime = Date.now();

  await ensureDir(variantOutputDir);

  const { command, argv } = buildQwenCommand(args, variantOutputDir, variant);
  await appendLog(wrapperLogPath, `[benchmark] command=${command}`);

  try {
    const result = await runProcess(args.qwenPython, argv, packageRoot, wrapperLogPath);
    const manifestPath = join(variantOutputDir, 'manifest.json');

    summary.variants[variant] = {
      status: result.exitCode === 0 ? 'completed' : 'failed',
      variant,
      outputDir: variantOutputDir,
      manifestPath,
      durationMs: Date.now() - startTime,
      command,
      error: result.exitCode === 0 ? undefined : result.stderr.trim() || result.stdout.trim(),
      settings: {
        diffusersSource: args.qwenDiffusersSource,
        width: args.width,
        height: args.height,
        steps: variant === 'qwen-base' ? args.qwenBaseSteps : args.qwenLightningSteps,
        memoryMode:
          variant === 'qwen-base'
            ? args.qwenBaseMemoryMode
            : args.qwenLightningMemoryMode,
      },
    };
  } catch (error) {
    summary.variants[variant] = {
      status: 'failed',
      variant,
      outputDir: variantOutputDir,
      durationMs: Date.now() - startTime,
      command,
      error: error instanceof Error ? error.message : String(error),
      settings: {
        diffusersSource: args.qwenDiffusersSource,
      },
    };
  }
}

async function loadAiContentConfig(): Promise<AiContentConfig> {
  const configPath = join(packageRoot, '.ai-content.json');
  const content = await readFile(configPath, 'utf-8');
  return JSON.parse(content) as AiContentConfig;
}

function buildSdxlPrompt(
  plan: SubjectPlan,
  args: BenchmarkArgs
): { prompt: string; negativePrompt: string } {
  if (args.sdxlPromptMode === 'same-as-qwen') {
    return {
      prompt: plan.prompt,
      negativePrompt: plan.negativePrompt,
    };
  }

  const built = promptBuilder.buildPrompt(
    'animal-cartoon-simple',
    { animal: plan.subject },
    {
      includeNegative: true,
      negativeType: 'default',
    }
  );

  if (!built.success || !built.prompt) {
    throw new Error(
      `Failed to build SDXL prompt for subject=${plan.subject}: ${built.error || 'unknown error'}`
    );
  }

  return {
    prompt: built.prompt.prompt,
    negativePrompt: built.prompt.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
  };
}

async function runSdxlVariant(args: BenchmarkArgs, summary: BenchmarkSummary): Promise<void> {
  const variant = 'sdxl-comfyui';
  const variantOutputDir = join(args.outputDir, variant);
  const logFilePath = join(variantOutputDir, 'run.log');
  const manifestPath = join(variantOutputDir, 'manifest.json');
  const startTime = Date.now();

  await ensureDir(variantOutputDir);

  let provider: ComfyUIProvider | null = null;

  try {
    const config = await loadAiContentConfig();
    const baseUrl = config.providers?.image?.config?.baseUrl || 'http://localhost:8188';

    provider = new ComfyUIProvider({
      name: 'benchmark-comfyui',
      baseUrl,
      timeout: 300000,
      retries: 0,
      healthCheckInterval: 30000,
    });

    await appendLog(logFilePath, `[benchmark] init provider baseUrl=${baseUrl}`);
    await provider.init();

    const manifest: Array<Record<string, unknown>> = [];

    for (const plan of summary.subjects) {
      const promptData = buildSdxlPrompt(plan, args);
      await appendLog(logFilePath, `[benchmark] generating subject=${plan.subject}`);

      const result = await provider.generate({
        prompt: promptData.prompt,
        negativePrompt: promptData.negativePrompt,
        width: args.width,
        height: args.height,
        steps: 20,
        cfgScale: 7,
        style: 'cartoon',
        seed: plan.seed,
      });

      const filePath = join(variantOutputDir, `${plan.subject}.png`);
      await writeFile(filePath, result.data.buffer);

      manifest.push({
        subject: plan.subject,
        seed: result.data.seed,
        prompt: promptData.prompt,
        negativePrompt: promptData.negativePrompt,
        filePath,
        model: 'sd_xl_base_1.0.safetensors',
        provider: 'ComfyUIProvider',
        steps: 20,
        cfgScale: 7,
        style: 'cartoon',
      });
    }

    await writeJson(manifestPath, manifest);

    summary.variants[variant] = {
      status: 'completed',
      variant,
      outputDir: variantOutputDir,
      manifestPath,
      durationMs: Date.now() - startTime,
      settings: {
        width: args.width,
        height: args.height,
        steps: 20,
        cfgScale: 7,
        promptMode: args.sdxlPromptMode,
      },
    };
  } catch (error) {
    summary.variants[variant] = {
      status: 'failed',
      variant,
      outputDir: variantOutputDir,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      settings: {
        width: args.width,
        height: args.height,
        promptMode: args.sdxlPromptMode,
      },
    };
  } finally {
    if (provider) {
      await provider.shutdown();
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const subjectPlan = buildSubjectPlan(args);

  await ensureDir(args.outputDir);

  const summary: BenchmarkSummary = {
    startedAt: new Date().toISOString(),
    outputDir: args.outputDir,
    subjects: subjectPlan,
    promptPreset: args.promptPreset,
    variants: {},
  };

  await writeJson(join(args.outputDir, 'subjects.json'), subjectPlan);
  await writeJson(join(args.outputDir, 'benchmark.json'), summary);

  if (args.skipQwenBase) {
    summary.variants['qwen-base'] = {
      status: 'skipped',
      variant: 'qwen-base',
      outputDir: join(args.outputDir, 'qwen-base'),
      settings: {},
    };
  } else {
    await runQwenVariant(args, summary, 'qwen-base');
  }
  await writeJson(join(args.outputDir, 'benchmark.json'), summary);

  if (args.skipQwenLightning) {
    summary.variants['qwen-lightning'] = {
      status: 'skipped',
      variant: 'qwen-lightning',
      outputDir: join(args.outputDir, 'qwen-lightning'),
      settings: {},
    };
  } else {
    await runQwenVariant(args, summary, 'qwen-lightning');
  }
  await writeJson(join(args.outputDir, 'benchmark.json'), summary);

  if (args.skipSdxl) {
    summary.variants['sdxl-comfyui'] = {
      status: 'skipped',
      variant: 'sdxl-comfyui',
      outputDir: join(args.outputDir, 'sdxl-comfyui'),
      settings: {},
    };
  } else {
    await runSdxlVariant(args, summary);
  }

  summary.completedAt = new Date().toISOString();
  await writeJson(join(args.outputDir, 'benchmark.json'), summary);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
