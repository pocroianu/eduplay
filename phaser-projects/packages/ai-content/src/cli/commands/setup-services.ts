import { execFileSync, execSync } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';

interface SetupOptions {
  skipModels?: boolean;
  gpuCheck?: boolean;
}

export async function setupServicesCommand(options: SetupOptions = {}) {
  console.log(chalk.bold('\n🚀 Setting up AI Content Generation Services\n'));
  const config = loadFactoryConfig();
  const primaryImageProvider = config?.providers.image.provider || 'comfyui';
  const textProvider = config?.providers.text.provider || 'template';
  const audioProvider = config?.providers.audio.provider || 'piper';
  const f5BaseUrl = getConfiguredF5BaseUrl();
  if (textProvider !== 'template' && textProvider !== 'ollama') {
    console.error(chalk.red(`Unsupported text provider for setup-services: ${textProvider}`));
    process.exit(1);
  }
  if (audioProvider !== 'piper' && audioProvider !== 'f5-romanian') {
    console.error(chalk.red(`Unsupported audio provider for setup-services: ${audioProvider}`));
    process.exit(1);
  }
  if (audioProvider === 'f5-romanian' && f5BaseUrl !== 'http://localhost:5001') {
    console.error(chalk.red(`setup-services manages the local F5 Docker service at http://localhost:5001, but providers.audio.config.baseUrl is ${f5BaseUrl}`));
    console.error(chalk.yellow('Use http://localhost:5001 for the local Docker service, or start/check the external F5 service outside setup-services.'));
    process.exit(1);
  }

  // Step 1: GPU Check (if requested)
  if (options.gpuCheck !== false) {
    await checkGPU();
  }

  // Step 2: Check Docker
  await checkDocker();

  // Step 3: Start services
  await startDockerServices(audioProvider, textProvider);

  // Step 4: Wait for services to be healthy
  await waitForServicesHealthy(primaryImageProvider, textProvider, audioProvider, f5BaseUrl);

  // Step 5: Prepare local Qwen runtime when it is the primary image provider
  if (primaryImageProvider === 'qwen') {
    await prepareQwenRuntime();
  }

  // Step 6: Download models (unless skipped)
  if (!options.skipModels) {
    await downloadInitialModels(primaryImageProvider, textProvider);
  }

  // Success summary
  console.log(chalk.green('\n✅ Setup Complete!\n'));
  console.log('Services running:');
  console.log(chalk.cyan(`  Image:    ${primaryImageProvider === 'qwen' ? 'Qwen local runtime' : 'ComfyUI http://localhost:8188'}`));
  console.log(chalk.cyan('  ComfyUI:  http://localhost:8188 (fallback / training)'));
  if (textProvider === 'ollama') {
    console.log(chalk.cyan('  Ollama:   http://localhost:11434'));
  } else {
    console.log(chalk.cyan('  Text:     local deterministic templates'));
  }
  console.log(chalk.cyan(audioProvider === 'f5-romanian'
    ? `  F5 TTS:  ${f5BaseUrl} (experimental Romanian)`
    : '  Piper:    http://localhost:5000'));
  console.log(chalk.cyan('  Redis:    localhost:6379\n'));
  console.log('Next steps:');
  console.log(chalk.yellow('  1. Run: edu-generate check-health'));
  console.log(chalk.yellow(audioProvider === 'f5-romanian'
    ? '  2. Run Romanian generation with --languages ro'
    : '  2. Run: edu-generate download-models --piper'));
  console.log(chalk.yellow('  3. Start generating games!\n'));
}

function loadFactoryConfig() {
  try {
    return ProviderFactory.loadConfig();
  } catch {
    return null;
  }
}

function getConfiguredOllamaModel(): string {
  const config = loadFactoryConfig();
  const providerConfig = (config?.providers.text.config ?? {}) as Record<string, unknown>;
  return typeof providerConfig.model === 'string' ? providerConfig.model : 'mistral:small';
}

function getConfiguredF5BaseUrl(): string {
  const config = loadFactoryConfig();
  const providerConfig = (config?.providers.audio.config ?? {}) as Record<string, unknown>;
  return typeof providerConfig.baseUrl === 'string' ? providerConfig.baseUrl : 'http://localhost:5001';
}

async function checkGPU() {
  const spinner = ora('Checking GPU availability...').start();

  try {
    const result = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', {
      encoding: 'utf-8'
    });

    const gpus = result.trim().split('\n');
    spinner.succeed(`Found ${gpus.length} GPU(s):`);

    gpus.forEach((gpu, index) => {
      const [name, memory] = gpu.split(',').map(s => s.trim());
      console.log(chalk.green(`  GPU ${index}: ${name} (${memory})`));
    });

    // Check for RTX 4080 Super or similar
    if (result.includes('4080')) {
      console.log(chalk.bold.green('  ✓ RTX 4080 detected - optimal performance expected!\n'));
    }

  } catch {
    spinner.fail('GPU check failed');
    console.error(chalk.red('Error: nvidia-smi not found or no NVIDIA GPU detected'));
    console.error(chalk.yellow('This system requires an NVIDIA GPU with CUDA support\n'));
    process.exit(1);
  }
}

async function checkDocker() {
  const spinner = ora('Checking Docker...').start();

  try {
    // Check Docker
    execSync('docker --version', { stdio: 'ignore' });

    // Check Docker Compose
    execSync('docker compose version', { stdio: 'ignore' });

    // Check Docker daemon is running
    execSync('docker ps', { stdio: 'ignore' });

    spinner.succeed('Docker is ready');
  } catch {
    spinner.fail('Docker check failed');
    console.error(chalk.red('\nDocker is not installed or not running'));
    console.error(chalk.yellow('Please install Docker Desktop: https://www.docker.com/products/docker-desktop\n'));
    process.exit(1);
  }
}

async function startDockerServices(audioProvider: string, textProvider: string) {
  const spinner = ora('Starting Docker services...').start();

  try {
    const dockerDir = path.join(__dirname, '../../../docker');

    // Check if docker-compose.yml exists
    if (!fs.existsSync(path.join(dockerDir, 'docker-compose.yml'))) {
      spinner.fail('docker-compose.yml not found');
      console.error(chalk.red(`Expected at: ${dockerDir}/docker-compose.yml\n`));
      process.exit(1);
    }

    // Pull images and start services
    const profiles: string[] = [];
    if (audioProvider === 'f5-romanian') profiles.push('--profile f5');
    if (textProvider === 'ollama') profiles.push('--profile ollama');
    const composeProfileArgs = profiles.length > 0 ? `${profiles.join(' ')} ` : '';
    const serviceTargets = audioProvider === 'f5-romanian'
      ? ['comfyui', ...(textProvider === 'ollama' ? ['ollama'] : []), 'f5-romanian', 'redis'].join(' ')
      : '';
    const serviceTargetArgs = serviceTargets.length > 0 ? ` ${serviceTargets}` : '';

    execSync(`docker compose ${composeProfileArgs}pull${serviceTargetArgs}`, {
      cwd: dockerDir,
      stdio: 'pipe'
    });

    execSync(`docker compose ${composeProfileArgs}up -d --build${serviceTargetArgs}`, {
      cwd: dockerDir,
      stdio: 'pipe'
    });

    spinner.succeed('Docker services started');
  } catch (error: any) {
    spinner.fail('Failed to start Docker services');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function waitForServicesHealthy(primaryImageProvider: string, textProvider: string, audioProvider: string, f5BaseUrl: string) {
  const spinner = ora('Waiting for services to be healthy...').start();

  const services = [
    audioProvider === 'f5-romanian'
      ? {
        name: 'F5 Romanian TTS',
        url: `${f5BaseUrl}/health`,
        maxWait: 600,
        failFastUnhealthy: true,
        expectedService: 'f5-romanian-tts'
      }
      : { name: 'Piper', url: 'http://localhost:5000/health', maxWait: 30 },
    { name: 'Redis', check: () => checkRedis(), maxWait: 30 }
  ];

  if (textProvider === 'ollama') {
    services.unshift({ name: 'Ollama', url: 'http://localhost:11434', maxWait: 60 });
  }

  if (primaryImageProvider !== 'qwen') {
    services.unshift({ name: 'ComfyUI', url: 'http://localhost:8188', maxWait: 120 });
  }

  for (const service of services) {
    try {
      await waitForService(service, spinner);
    } catch (error: any) {
      spinner.fail(`${service.name} failed to start`);
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  spinner.succeed('All services are healthy');
}

async function prepareQwenRuntime() {
  const spinner = ora('Preparing Qwen base runtime...').start();

  if (process.platform !== 'win32') {
    spinner.fail('Qwen bootstrap is only automated for Windows in this pass');
    console.error(chalk.red('Qwen default setup currently targets the validated Windows workstation path.\n'));
    process.exit(1);
  }

  try {
    execSync('powershell -ExecutionPolicy Bypass -File scripts/setup-qwen-image-env.ps1', {
      stdio: 'pipe'
    });
    spinner.succeed('Qwen runtime prepared');
  } catch (error: any) {
    spinner.fail('Failed to prepare Qwen runtime');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function waitForService(service: any, spinner: ReturnType<typeof ora>) {
  const startTime = Date.now();
  const maxWaitMs = service.maxWait * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    let receivedHttpResponse = false;
    try {
      if (service.url) {
        const response = await fetch(service.url, { signal: AbortSignal.timeout(5000) });
        receivedHttpResponse = true;
        if (response.ok) {
          if (service.expectedService) {
            const data = await response.json() as { service?: string };
            if (data.service !== service.expectedService) {
              throw new Error(
                `${service.name} health endpoint reported service "${data.service ?? 'unknown'}", expected "${service.expectedService}"`
              );
            }
          }
          return;
        }
        if (service.failFastUnhealthy) {
          const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
          const message = data.error || data.message || `${service.name} is unhealthy`;
          const retryableUnhealthy = message.toLowerCase();
          if (!retryableUnhealthy.includes('still loading') && !retryableUnhealthy.includes('retrying')) {
            throw new Error(message);
          }
        }
      } else if (service.check) {
        const result = await service.check();
        if (result) {
          return;
        }
      }
    } catch (error) {
      if (service.failFastUnhealthy && receivedHttpResponse) {
        throw error;
      }
      // Service not ready yet, continue waiting
    }

    spinner.text = `Waiting for ${service.name} to be healthy (${Math.floor((Date.now() - startTime) / 1000)}s)...`;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`${service.name} did not become healthy within ${service.maxWait}s`);
}

async function checkRedis() {
  try {
    execSync('docker exec edu-redis redis-cli ping', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function downloadInitialModels(primaryImageProvider: string, textProvider: string) {
  const spinner = ora('Downloading base models (this may take a while)...').start();

  try {
    if (primaryImageProvider === 'qwen' && process.platform === 'win32') {
      spinner.text = 'Preparing Qwen runtime...';
      execSync('powershell -ExecutionPolicy Bypass -File scripts/setup-qwen-image-env.ps1', {
        stdio: 'pipe'
      });
    }

    if (textProvider === 'ollama') {
      const ollamaModel = getConfiguredOllamaModel();
      spinner.text = `Downloading Ollama model ${ollamaModel}...`;
      execFileSync('docker', ['exec', 'edu-ollama', 'ollama', 'pull', ollamaModel], {
        stdio: 'pipe'
      });
      spinner.succeed('Base models downloaded');
    } else {
      spinner.succeed('No text model download needed for template provider');
    }
    console.log(chalk.yellow('  Note: Qwen/Z-Image ComfyUI weights are mounted from the local ComfyUI model cache'));
  } catch {
    spinner.warn('Model download partially failed - will retry on first use');
  }
}
