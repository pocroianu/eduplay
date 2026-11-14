import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';
import { QwenImageProvider, type QwenImageConfig } from '../../providers/image/QwenImageProvider';

interface HealthOptions {
  verbose?: boolean;
}

export async function checkHealthCommand(options: HealthOptions = {}) {
  console.log(chalk.bold('\n🏥 Checking Service Health\n'));
  const config = loadFactoryConfig();
  const imageProviderName = config?.providers.image.provider || 'comfyui';
  const imageFallbackName = config?.providers.image.fallback?.provider;
  const audioProviderName = config?.providers.audio.provider || 'piper';
  const textProviderName = config?.providers.text.provider || 'template';
  if (textProviderName !== 'template' && textProviderName !== 'ollama') {
    console.error(chalk.red(`Unsupported text provider for check-health: ${textProviderName}`));
    process.exit(1);
  }
  if (audioProviderName !== 'piper' && audioProviderName !== 'f5-romanian') {
    console.error(chalk.red(`Unsupported audio provider for check-health: ${audioProviderName}`));
    process.exit(1);
  }

  const services = [
    imageProviderName === 'qwen'
      ? {
          name: 'Qwen Runtime',
          check: () => checkQwenRuntime(options.verbose),
          icon: '🖼️',
          required: true
        }
      : {
          name: 'ComfyUI',
          check: () => checkComfyUI(options.verbose),
          icon: '🎨',
          required: true
        },
    textProviderName === 'ollama'
      ? {
          name: 'Ollama',
          check: () => checkOllama(options.verbose),
          icon: '🤖',
          required: true
        }
      : {
          name: 'Template Text',
          check: () => checkTemplateText(),
          icon: '📝',
          required: true
        },
    audioProviderName === 'f5-romanian'
      ? {
          name: 'F5 Romanian TTS',
          check: () => checkF5Romanian(options.verbose),
          icon: '🔊',
          required: true
        }
      : {
          name: 'Piper TTS',
          check: () => checkPiper(options.verbose),
          icon: '🔊',
          required: true
        },
    {
      name: 'Redis',
      check: () => checkRedis(options.verbose),
      icon: '💾',
      required: true
    }
  ];

  if (imageProviderName === 'qwen' && imageFallbackName === 'comfyui') {
    services.push({
      name: 'ComfyUI Fallback',
      check: () => checkComfyUI(options.verbose, 'ComfyUI fallback'),
      icon: '🎨',
      required: false
    });
  }

  let allHealthy = true;

  for (const service of services) {
    const result = await service.check();
    if (!result.healthy && service.required) {
      allHealthy = false;
    }
  }

  console.log();

  if (allHealthy) {
    console.log(chalk.green.bold('✅ All services are healthy!\n'));
    console.log('Service URLs:');
    console.log(chalk.cyan(`  Image:    ${imageProviderName === 'qwen' ? 'Qwen local runtime' : 'ComfyUI http://localhost:8188'}`));
    if (imageFallbackName === 'comfyui') {
      console.log(chalk.cyan('  ComfyUI:  http://localhost:8188 (fallback / training)'));
    }
    if (textProviderName === 'ollama') {
      console.log(chalk.cyan('  Ollama:   http://localhost:11434'));
    } else {
      console.log(chalk.cyan('  Text:     local deterministic templates'));
    }
    console.log(chalk.cyan(audioProviderName === 'f5-romanian'
      ? `  F5 TTS:  ${buildF5RomanianHealthConfig().baseUrl}`
      : '  Piper:    http://localhost:5000'));
    console.log(chalk.cyan('  Redis:    localhost:6379\n'));
  } else {
    console.log(chalk.red.bold('❌ Some services are unhealthy\n'));
    console.log('Try running: edu-generate setup-services\n');
    process.exit(1);
  }
}

function loadFactoryConfig() {
  try {
    return ProviderFactory.loadConfig();
  } catch {
    return null;
  }
}

function buildOllamaHealthConfig(): { baseUrl: string; model: string } {
  const config = loadFactoryConfig();
  const textConfig = config?.providers.text;
  const providerConfig = (textConfig?.config ?? {}) as Record<string, unknown>;

  return {
    baseUrl: typeof providerConfig.baseUrl === 'string'
      ? providerConfig.baseUrl
      : 'http://localhost:11434',
    model: typeof providerConfig.model === 'string'
      ? providerConfig.model
      : 'mistral:small'
  };
}

function buildComfyUIHealthConfig(label: string): {
  baseUrl: string;
  checkpointName: string;
  requiresCheckpoint: boolean;
} {
  const config = loadFactoryConfig();
  const imageConfig = config?.providers.image;
  const selection = label === 'ComfyUI fallback'
    ? imageConfig?.fallback
    : imageConfig?.provider === 'comfyui'
      ? imageConfig
      : undefined;
  const providerConfig = (selection?.config ?? {}) as Record<string, unknown>;

  return {
    baseUrl: typeof providerConfig.baseUrl === 'string'
      ? providerConfig.baseUrl
      : 'http://localhost:8188',
    checkpointName: typeof providerConfig.checkpointName === 'string'
      ? providerConfig.checkpointName
      : 'sd_xl_base_1.0.safetensors',
    requiresCheckpoint: typeof providerConfig.workflowPath !== 'string'
  };
}

function buildF5RomanianHealthConfig(): { baseUrl: string } {
  const config = loadFactoryConfig();
  const audioConfig = config?.providers.audio;
  const providerConfig = (audioConfig?.config ?? {}) as Record<string, unknown>;

  return {
    baseUrl: audioConfig?.provider === 'f5-romanian' && typeof providerConfig.baseUrl === 'string'
      ? providerConfig.baseUrl
      : 'http://localhost:5001'
  };
}

function buildQwenConfig(): QwenImageConfig {
  const config = loadFactoryConfig();
  const imageConfig = config?.providers.image;

  if (imageConfig?.provider === 'qwen') {
    return {
      name: 'qwen',
      baseUrl: 'http://localhost/qwen-runtime',
      timeout: 60000,
      retries: 0,
      healthCheckInterval: 30000,
      ...(imageConfig.config as Record<string, unknown>)
    } as QwenImageConfig;
  }

  return {
    name: 'qwen',
    baseUrl: 'http://localhost/qwen-runtime',
    timeout: 60000,
    retries: 0,
    healthCheckInterval: 30000
  } as QwenImageConfig;
}

async function checkQwenRuntime(verbose?: boolean): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking Qwen Runtime...').start();

  try {
    const provider = new QwenImageProvider(buildQwenConfig());
    const health = await provider.isHealthy();

    if (health.healthy) {
      spinner.succeed(chalk.green('Qwen Runtime: Healthy 🖼️'));
      if (verbose && health.details) {
        console.log(chalk.gray(`  Device: ${(health.details as any).device || 'unknown'}`));
        console.log(chalk.gray(`  Diffusers: ${(health.details as any).diffusersVersion || 'unknown'}`));
      }
      return { healthy: true };
    }

    spinner.fail(chalk.red(`Qwen Runtime: ${health.message || 'Unhealthy'}`));
    return { healthy: false };
  } catch (error: any) {
    spinner.fail(chalk.red(`Qwen Runtime: ${error.message || 'Not responding'}`));
    return { healthy: false };
  }
}

async function checkComfyUI(verbose?: boolean, label = 'ComfyUI'): Promise<{ healthy: boolean }> {
  const spinner = ora(`Checking ${label}...`).start();
  const comfyConfig = buildComfyUIHealthConfig(label);

  try {
    const response = await fetch(`${comfyConfig.baseUrl}/system_stats`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      spinner.fail(chalk.red(`${label}: Unhealthy`));
      return { healthy: false };
    }

    if (comfyConfig.requiresCheckpoint) {
      const objectInfoResponse = await fetch(`${comfyConfig.baseUrl}/object_info/CheckpointLoaderSimple`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!objectInfoResponse.ok) {
        spinner.fail(chalk.red(`${label}: Cannot inspect checkpoint models`));
        return { healthy: false };
      }

      const objectInfo = await objectInfoResponse.json() as {
        CheckpointLoaderSimple?: {
          input?: { required?: { ckpt_name?: [string[]] } };
        };
      };
      const checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];

      if (!checkpoints.includes(comfyConfig.checkpointName)) {
        spinner.fail(chalk.red(`${label}: Checkpoint not found: ${comfyConfig.checkpointName}`));
        if (verbose && checkpoints.length > 0) {
          console.log(chalk.gray(`  Available checkpoints: ${checkpoints.join(', ')}`));
        }
        return { healthy: false };
      }
    }

    spinner.succeed(chalk.green(`${label}: Healthy 🎨`));

    if (verbose) {
      // Check GPU usage
      try {
        const gpuInfo = execSync('docker exec edu-comfyui nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader', {
          encoding: 'utf-8'
        }).trim();
        console.log(chalk.gray(`  GPU: ${gpuInfo}`));
      } catch {
        // GPU info not available
      }
    }

    return { healthy: true };
  } catch {
    spinner.fail(chalk.red(`${label}: Not responding`));
    return { healthy: false };
  }
}

async function checkTemplateText(): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking Template Text...').start();
  spinner.succeed(chalk.green('Template Text: Healthy 📝'));
  return { healthy: true };
}

async function checkOllama(verbose?: boolean): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking Ollama...').start();
  const ollamaConfig = buildOllamaHealthConfig();

  try {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models || [];
      const modelNames = models.map((m: any) => m.name);

      if (!modelNames.includes(ollamaConfig.model)) {
        spinner.fail(chalk.red(`Ollama: Model not found: ${ollamaConfig.model}`));
        if (verbose) {
          console.log(chalk.gray(
            modelNames.length > 0
              ? `  Available models: ${modelNames.join(', ')}`
              : '  No models loaded - run: edu-generate download-models --mistral'
          ));
        }
        return { healthy: false };
      }

      spinner.succeed(chalk.green('Ollama: Healthy 🤖'));

      if (verbose) {
        console.log(chalk.gray(`  Loaded models: ${modelNames.join(', ')}`));
      }

      return { healthy: true };
    } else {
      spinner.fail(chalk.red('Ollama: Unhealthy'));
      return { healthy: false };
    }
  } catch {
    spinner.fail(chalk.red('Ollama: Not responding'));
    return { healthy: false };
  }
}

async function checkPiper(verbose?: boolean): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking Piper TTS...').start();

  try {
    const response = await fetch('http://localhost:5000/health', {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      spinner.succeed(chalk.green('Piper TTS: Healthy 🔊'));

      if (verbose) {
        const voices = await fetch('http://localhost:5000/voices').then(r => r.json()) as { voices: Array<{ name: string }> };
        console.log(chalk.gray(`  Available voices: ${voices.voices.length}`));
      }

      return { healthy: true };
    } else {
      spinner.fail(chalk.red('Piper TTS: Unhealthy'));
      return { healthy: false };
    }
  } catch {
    spinner.fail(chalk.red('Piper TTS: Not responding'));
    return { healthy: false };
  }
}

async function checkF5Romanian(verbose?: boolean): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking F5 Romanian TTS...').start();
  const f5Config = buildF5RomanianHealthConfig();

  try {
    const response = await fetch(`${f5Config.baseUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({})) as { service?: string };
      if (data.service !== 'f5-romanian-tts') {
        spinner.fail(chalk.red(`F5 Romanian TTS: Unexpected service at ${f5Config.baseUrl}`));
        return { healthy: false };
      }

      const voicesResponse = await fetch(`${f5Config.baseUrl}/voices`, {
        signal: AbortSignal.timeout(5000)
      });
      const voices = await voicesResponse.json().catch(() => ({})) as {
        service?: string;
        voices?: Array<{ language?: string }>;
        error?: string;
        message?: string;
      };
      const romanianVoices = voices.voices?.filter(voice => voice.language === 'ro') ?? [];

      if (!voicesResponse.ok || voices.service !== 'f5-romanian-tts' || romanianVoices.length === 0) {
        const message = voices.error || voices.message || 'No Romanian F5 voice available';
        spinner.fail(chalk.red(`F5 Romanian TTS: ${message}`));
        return { healthy: false };
      }

      spinner.succeed(chalk.green('F5 Romanian TTS: Healthy 🔊'));

      if (verbose) {
        console.log(chalk.gray(`  Available voices: ${romanianVoices.length}`));
      }

      return { healthy: true };
    } else {
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      spinner.fail(chalk.red(`F5 Romanian TTS: ${data.error || data.message || 'Unhealthy'}`));
      return { healthy: false };
    }
  } catch {
    spinner.fail(chalk.red('F5 Romanian TTS: Not responding'));
    return { healthy: false };
  }
}

async function checkRedis(verbose?: boolean): Promise<{ healthy: boolean }> {
  const spinner = ora('Checking Redis...').start();

  try {
    execSync('docker exec edu-redis redis-cli ping', { stdio: 'ignore' });
    spinner.succeed(chalk.green('Redis: Healthy 💾'));

    if (verbose) {
      const info = execSync('docker exec edu-redis redis-cli info stats', {
        encoding: 'utf-8'
      });
      const keyspaceHits = info.match(/keyspace_hits:(\d+)/)?.[1] || '0';
      const keyspaceMisses = info.match(/keyspace_misses:(\d+)/)?.[1] || '0';
      const hitRate = parseInt(keyspaceHits) / (parseInt(keyspaceHits) + parseInt(keyspaceMisses) || 1) * 100;
      console.log(chalk.gray(`  Cache hit rate: ${hitRate.toFixed(1)}%`));
    }

    return { healthy: true };
  } catch {
    spinner.fail(chalk.red('Redis: Not responding'));
    return { healthy: false };
  }
}
