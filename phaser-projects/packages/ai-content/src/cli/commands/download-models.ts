import { execSync } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';
import { QwenImageProvider, type QwenImageConfig } from '../../providers/image/QwenImageProvider';

interface DownloadOptions {
  qwen?: boolean;
  sdxl?: boolean;
  mistral?: boolean;
  piper?: boolean;
  f5Romanian?: boolean;
  all?: boolean;
  preset?: string;
}

export async function downloadModelsCommand(options: DownloadOptions = {}) {
  const explicitF5Romanian = options.f5Romanian === true;
  console.log(chalk.bold('\n📦 Downloading AI Models\n'));

  // Handle presets
  if (options.preset) {
    const config = loadFactoryConfig();
    const audioProvider = config?.providers.audio.provider ?? 'piper';

    if (options.preset === 'children-books') {
      options.qwen = true;
      options.sdxl = true;
      options.piper = audioProvider === 'piper';
      options.f5Romanian = audioProvider === 'f5-romanian';
      console.log(chalk.cyan(
        `Using preset: children-books (Qwen + SDXL fallback + ${audioProvider === 'f5-romanian' ? 'F5 Romanian' : 'Piper'}; add --mistral for Ollama)\n`
      ));
    } else if (options.preset === 'minimal') {
      options.qwen = true;
      options.piper = audioProvider === 'piper';
      options.f5Romanian = audioProvider === 'f5-romanian';
      console.log(chalk.cyan(
        `Using preset: minimal (Qwen + ${audioProvider === 'f5-romanian' ? 'F5 Romanian' : 'Piper'}, SDXL/Ollama on-demand)\n`
      ));
    } else {
      console.error(chalk.red(`Unknown preset: ${options.preset}`));
      console.log('Available presets: children-books, minimal\n');
      process.exit(1);
    }
  }

  // Handle --all flag
  if (options.all) {
    options.qwen = true;
    options.sdxl = true;

    const config = loadFactoryConfig();
    const audioProvider = config?.providers.audio.provider ?? 'piper';
    options.mistral = Boolean(options.mistral) || (config ? config.providers.text.provider === 'ollama' : false);
    options.f5Romanian = Boolean(options.f5Romanian) || (config ? audioProvider === 'f5-romanian' : false);
    options.piper = Boolean(options.piper) || (config ? audioProvider === 'piper' : true);
  }

  // Check if at least one option is selected
  if (!options.qwen && !options.sdxl && !options.mistral && !options.piper && !options.f5Romanian) {
    console.error(chalk.red('Please specify at least one model to download:'));
    console.log('  --qwen      Prepare the local Qwen base runtime and warm its cache');
    console.log('  --sdxl      Download Stable Diffusion XL (~7GB)');
    console.log('  --mistral   Download optional Mistral 3 Small for Ollama (~14GB)');
    console.log('  --piper     Download Piper TTS voices (~200MB)');
    console.log('  --f5-romanian  Show preparation status for F5 Romanian TTS (model downloads on service startup)');
    console.log('  --all       Download models for the configured local stack');
    console.log('  --preset <name>  Use preset (children-books, minimal)\n');
    process.exit(1);
  }

  try {
    if (options.qwen) {
      await downloadQwen();
    }

    // Download optional Mistral for the Ollama text provider
    if (options.mistral) {
      await downloadMistral();
    }

    // Download SDXL (via ComfyUI)
    if (options.sdxl) {
      await downloadSDXL();
    }

    // Download Piper voices (already included in Docker image)
    if (options.piper) {
      await checkPiperVoices();
    }

    // F5 Romanian models are prepared by the Docker service on startup.
    if (options.f5Romanian) {
      const config = loadFactoryConfig();
      await checkF5RomanianPreparation(
        explicitF5Romanian || config?.providers.audio.provider === 'f5-romanian'
      );
    }

    console.log(chalk.green.bold('\n✅ All requested models downloaded!\n'));
    console.log('Ready to generate content. Try:');
    console.log(chalk.cyan('  edu-generate generate --category animals --theme nature\n'));

  } catch (error: any) {
    console.error(chalk.red('\n❌ Model download failed'));
    console.error(error.message);
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

function getConfiguredF5BaseUrl(): string {
  try {
    const config = ProviderFactory.loadConfig();
    const audioConfig = config.providers.audio;
    const providerConfig = (audioConfig.config ?? {}) as Record<string, unknown>;
    return audioConfig.provider === 'f5-romanian' && typeof providerConfig.baseUrl === 'string'
      ? providerConfig.baseUrl
      : 'http://localhost:5001';
  } catch {
    return 'http://localhost:5001';
  }
}
function getConfiguredOllamaModel(): string {
  const config = loadFactoryConfig();
  const providerConfig = (config?.providers.text.config ?? {}) as Record<string, unknown>;
  return typeof providerConfig.model === 'string' ? providerConfig.model : 'mistral:small';
}


function buildQwenConfig(): QwenImageConfig {
  try {
    const config = ProviderFactory.loadConfig();
    const imageConfig = config.providers.image;
    if (imageConfig.provider === 'qwen') {
      return {
        name: 'qwen',
        baseUrl: 'http://localhost/qwen-runtime',
        timeout: 60 * 60 * 1000,
        retries: 0,
        healthCheckInterval: 30000,
        ...(imageConfig.config as Record<string, unknown>)
      } as QwenImageConfig;
    }
  } catch {
    // Fall back to the package defaults below.
  }

  return {
    name: 'qwen',
    baseUrl: 'http://localhost/qwen-runtime',
    timeout: 60 * 60 * 1000,
    retries: 0,
    healthCheckInterval: 30000,
    localFilesOnly: false
  } as QwenImageConfig;
}

async function downloadQwen() {
  const spinner = ora('Preparing Qwen base runtime and warming the local cache...').start();

  if (process.platform !== 'win32') {
    spinner.fail('Qwen bootstrap is only automated for Windows in this pass');
    throw new Error('Qwen default setup currently targets the validated Windows workstation path.');
  }

  try {
    execSync('powershell -ExecutionPolicy Bypass -File scripts/setup-qwen-image-env.ps1', {
      stdio: 'pipe'
    });

    const provider = new QwenImageProvider(buildQwenConfig());
    await provider.warmModel(false);
    spinner.succeed('Qwen base runtime prepared and warmed');
  } catch (error: any) {
    spinner.fail('Qwen runtime preparation failed');
    throw new Error(`Failed to prepare Qwen runtime: ${error.message}`);
  }
}

async function downloadMistral() {
  const ollamaModel = getConfiguredOllamaModel();
  const spinner = ora(`Downloading Ollama model ${ollamaModel}...`).start();
  spinner.text += chalk.gray('\n  This may take 10-30 minutes depending on your internet speed');

  try {
    execSync(`docker exec edu-ollama ollama pull ${ollamaModel}`, {
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer for large output
    });

    spinner.succeed(`Ollama model ${ollamaModel} downloaded`);
  } catch (error: any) {
    spinner.fail(`Ollama model ${ollamaModel} download failed`);
    throw new Error(`Failed to download Ollama model ${ollamaModel}: ${error.message}`);
  }
}

async function downloadSDXL() {
  const spinner = ora('Downloading Stable Diffusion XL (~7GB)...').start();
  spinner.text += chalk.gray('\n  This may take 5-20 minutes depending on your internet speed');

  try {
    // Download SDXL base model from HuggingFace
    execSync(`docker exec edu-comfyui wget -O /app/models/checkpoints/sd_xl_base_1.0.safetensors \\
      https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors`, {
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 100
    });

    spinner.succeed('Stable Diffusion XL downloaded');
  } catch (error: any) {
    spinner.fail('SDXL download failed');
    throw new Error(`Failed to download SDXL: ${error.message}`);
  }
}

async function checkPiperVoices() {
  const spinner = ora('Checking Piper TTS voices...').start();

  try {
    const response = await fetch('http://localhost:5000/voices');

    if (!response.ok) {
      throw new Error('Piper service not responding');
    }

    const data = await response.json() as { voices?: Array<{ description: string }> };
    const voiceCount = data.voices?.length || 0;

    spinner.succeed(`Piper TTS voices: ${voiceCount} available`);

    if (voiceCount > 0) {
      data.voices!.forEach((voice: any) => {
        console.log(chalk.gray(`  ✓ ${voice.description}`));
      });
    }

  } catch (error: any) {
    spinner.fail('Piper voices check failed');
    throw new Error(`Failed to verify Piper voices: ${error.message}`);
  }
}

async function checkF5RomanianPreparation(required: boolean) {
  const spinner = ora('Checking F5 Romanian TTS preparation status...').start();
  const baseUrl = getConfiguredF5BaseUrl();

  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });

    if (response.ok) {
      const data = await response.json().catch(() => ({})) as { service?: string };
      if (data.service !== 'f5-romanian-tts') {
        const message = `Unexpected service at ${baseUrl}`;
        if (required) {
          spinner.fail(message);
          throw new Error(message);
        }
        spinner.warn(`F5 Romanian TTS: ${message}`);
        return;
      }

      const voicesResponse = await fetch(`${baseUrl}/voices`, { signal: AbortSignal.timeout(5000) });
      const voices = await voicesResponse.json().catch(() => ({})) as {
        service?: string;
        voices?: Array<{ language?: string }>;
        error?: string;
        message?: string;
      };
      const romanianVoices = voices.voices?.filter(voice => voice.language === 'ro') ?? [];

      if (!voicesResponse.ok || voices.service !== 'f5-romanian-tts' || romanianVoices.length === 0) {
        const message = voices.error || voices.message || 'No Romanian F5 voice available';
        if (required) {
          spinner.fail(message);
          throw new Error(message);
        }
        spinner.warn(`F5 Romanian TTS: ${message}`);
        return;
      }

      spinner.succeed(`F5 Romanian TTS service at ${baseUrl} is healthy; model preparation is complete`);
      return;
    }

    const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
    const message = data.error || data.message || `F5 Romanian TTS service returned HTTP ${response.status}`;
    if (required) {
      spinner.fail(`F5 Romanian TTS at ${baseUrl} is not healthy: ${message}`);
      throw new Error(message);
    }
    spinner.warn(`F5 Romanian TTS at ${baseUrl} is not healthy yet: ${message}`);
  } catch (error: any) {
    if (required) {
      spinner.fail(`F5 Romanian TTS at ${baseUrl} is not responding`);
      throw new Error(error?.message || `F5 Romanian TTS at ${baseUrl} is not responding`);
    }
    spinner.warn(`F5 Romanian TTS at ${baseUrl} is not responding. Start setup-services with configured Romanian reference audio/text; the Docker service prepares models on startup.`);
  }
}
