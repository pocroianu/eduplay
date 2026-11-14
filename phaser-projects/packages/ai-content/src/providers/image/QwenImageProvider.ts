import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { isAbsolute, resolve } from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  ImageProviderBase,
  ImageRequest,
  ImageData,
  ImageRequestSchema,
  ImageProviderSupport
} from './ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { BaseProviderConfigSchema, HealthCheckResult } from '../base/BaseProvider';
import {
  ProviderError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderValidationError
} from '../base/errors';

const MEMORY_MODES = ['auto', 'full-gpu', 'model-offload', 'sequential-offload'] as const;
const DEVICES = ['auto', 'cuda', 'cpu', 'mps'] as const;

const packageRoot = resolve(__dirname, '../../..');

export const QwenImageConfigSchema = BaseProviderConfigSchema.extend({
  pythonPath: z.string().optional(),
  bridgeScriptPath: z.string().optional(),
  setupScriptPath: z.string().optional(),
  model: z.string().default('Qwen/Qwen-Image'),
  device: z.enum(DEVICES).default('cuda'),
  diffusersSource: z.string().default('installed'),
  memoryMode: z.enum(MEMORY_MODES).default('sequential-offload'),
  defaultSize: z.object({
    width: z.number().int().min(256).max(2048),
    height: z.number().int().min(256).max(2048)
  }).default({
    width: 512,
    height: 512
  }),
  defaultSteps: z.number().int().min(2).max(150).default(12),
  trueCfgScale: z.number().min(1).max(30).default(3.5),
  localFilesOnly: z.boolean().default(true),
  hfHome: z.string().optional()
});

export type QwenImageConfig = z.infer<typeof QwenImageConfigSchema>;

interface QwenBridgeHealthResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  python: string;
  bridgeScript: string;
  cudaAvailable?: boolean;
  diffusersVersion?: string;
  diffusersModuleFile?: string;
  hfHome?: string;
  hfHomeExists?: boolean;
  model?: string;
  device?: string;
}

interface QwenBridgeGenerateResult {
  status: 'completed';
  filePath: string;
  width: number;
  height: number;
  seed: number;
  device: string;
  diffusersVersion: string;
  diffusersModuleFile: string;
  model: string;
  memoryMode: string;
}

interface QwenBridgeWarmResult {
  status: 'warmed';
  model: string;
  localFilesOnly: boolean;
  diffusersVersion: string;
  diffusersModuleFile: string;
}

export class QwenImageProvider extends ImageProviderBase {
  protected config: QwenImageConfig;
  private readonly pythonPath: string;
  private readonly bridgeScriptPath: string;

  constructor(config: QwenImageConfig) {
    super(config);
    this.config = QwenImageConfigSchema.parse(config);
    this.pythonPath = this.resolvePackagePath(
      this.config.pythonPath || '.runtime/qwen-image/.venv/Scripts/python.exe'
    );
    this.bridgeScriptPath = this.resolvePackagePath(
      this.config.bridgeScriptPath || 'scripts/qwen-image-provider.py'
    );
  }

  async generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    const validatedRequest = ImageRequestSchema.parse(request);

    const support = this.supportsRequest(validatedRequest);
    if (!support.supported) {
      throw new ProviderValidationError(this.config.name, [
        support.reason || 'Qwen base production mode does not support this request.'
      ]);
    }

    const requestId = metadata?.requestId || randomUUID();
    const startTime = Date.now();
    const tempDir = await mkdtemp(resolve(tmpdir(), 'qwen-provider-'));

    try {
      const outputPath = resolve(tempDir, 'output.png');
      const requestPath = resolve(tempDir, 'request.json');
      const logFilePath = resolve(tempDir, 'run.log');

      const payload = {
        prompt: validatedRequest.prompt,
        negativePrompt: validatedRequest.negativePrompt || '',
        width: validatedRequest.width ?? this.config.defaultSize.width,
        height: validatedRequest.height ?? this.config.defaultSize.height,
        steps: validatedRequest.steps ?? this.config.defaultSteps,
        trueCfgScale: validatedRequest.cfgScale ?? this.config.trueCfgScale,
        seed: validatedRequest.seed ?? Math.floor(Math.random() * 1_000_000_000),
        outputPath,
        logFilePath
      };

      await writeFile(requestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

      const bridgeResult = await this.runBridge<QwenBridgeGenerateResult>([
        '--generate',
        '--request-file',
        requestPath,
        '--log-file',
        logFilePath,
        ...this.buildCommonArgs()
      ]);

      const buffer = await readFile(bridgeResult.filePath);
      const latency = Date.now() - startTime;
      this.recordRequest(true, latency);

      return {
        data: {
          buffer,
          mimeType: 'image/png',
          width: bridgeResult.width,
          height: bridgeResult.height,
          seed: bridgeResult.seed
        },
        metadata: {
          requestId,
          gameId: metadata?.gameId,
          questionId: metadata?.questionId,
          timestamp: new Date()
        },
        cached: false,
        latency,
        provider: this.config.name
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordRequest(false, latency);
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]> {
    const results: GenerationResult<ImageData>[] = [];

    for (let index = 0; index < requests.length; index += 1) {
      const result = await this.generate(requests[index], metadata);
      results.push(result);
      options?.progressCallback?.(index + 1, requests.length);
    }

    return results;
  }

  getSupportedStyles(): string[] {
    return ['cartoon', 'flat'];
  }

  async getAvailableLoras(): Promise<string[]> {
    return [];
  }

  supportsRequest(request: ImageRequest): ImageProviderSupport {
    if (request.lora) {
      return {
        supported: false,
        reason: 'Qwen base production mode does not support LoRA selection.'
      };
    }

    return { supported: true };
  }

  async warmModel(localFilesOnly = false): Promise<QwenBridgeWarmResult> {
    return this.runBridge<QwenBridgeWarmResult>([
      '--warm-model',
      ...this.buildCommonArgs({ localFilesOnly })
    ]);
  }

  protected async _doInit(): Promise<void> {
    const health = await this.checkRuntimeHealth();
    if (!health.healthy) {
      throw new ProviderUnavailableError(
        this.config.name,
        new Error(health.message || 'Qwen runtime unavailable')
      );
    }
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    const health = await this.checkRuntimeHealth();
    return {
      healthy: health.healthy,
      message: health.message,
      details: health.details
    };
  }

  protected async _doShutdown(): Promise<void> {
    // Each request is executed in a subprocess, so no long-lived resources are held here.
  }

  private async checkRuntimeHealth(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    if (!existsSync(this.pythonPath)) {
      return {
        healthy: false,
        message: `Qwen Python runtime not found at ${this.pythonPath}`,
        details: {
          pythonPath: this.pythonPath
        }
      };
    }

    if (!existsSync(this.bridgeScriptPath)) {
      return {
        healthy: false,
        message: `Qwen bridge script not found at ${this.bridgeScriptPath}`,
        details: {
          bridgeScriptPath: this.bridgeScriptPath
        }
      };
    }

    try {
      const result = await this.runBridge<QwenBridgeHealthResult>([
        '--health-check',
        ...this.buildCommonArgs()
      ]);

      return {
        healthy: result.status === 'healthy',
        message: result.message,
        details: result as unknown as Record<string, unknown>
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private buildCommonArgs(overrides?: { localFilesOnly?: boolean }): string[] {
    const args = [
      '--model',
      this.config.model,
      '--device',
      this.config.device,
      '--memory-mode',
      this.config.memoryMode,
      '--diffusers-source',
      this.config.diffusersSource,
      '--true-cfg-scale',
      String(this.config.trueCfgScale)
    ];

    const localFilesOnly = overrides?.localFilesOnly ?? this.config.localFilesOnly;
    if (localFilesOnly) {
      args.push('--local-files-only');
    }

    if (this.config.hfHome) {
      args.push('--hf-home', this.resolvePackagePath(this.config.hfHome));
    }

    return args;
  }

  private async runBridge<T>(args: string[]): Promise<T> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(this.pythonPath, [this.bridgeScriptPath, ...args], {
        cwd: packageRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.config.timeout);

      child.stdout.on('data', (chunk) => {
        stdoutChunks.push(Buffer.from(chunk));
      });

      child.stderr.on('data', (chunk) => {
        stderrChunks.push(Buffer.from(chunk));
      });

      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        rejectPromise(new ProviderUnavailableError(this.config.name, error));
      });

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);

        if (timedOut) {
          rejectPromise(new ProviderTimeoutError(this.config.name, this.config.timeout));
          return;
        }

        const stdout = Buffer.concat(stdoutChunks).toString('utf-8').trim();
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();

        if (code !== 0) {
          rejectPromise(
            new ProviderError(
              stderr || stdout || `Qwen bridge exited with code ${code}`,
              this.config.name,
              'QWEN_BRIDGE_FAILED',
              true
            )
          );
          return;
        }

        try {
          resolvePromise(JSON.parse(stdout) as T);
        } catch (error) {
          rejectPromise(
            new ProviderError(
              `Qwen bridge returned invalid JSON. stdout=${stdout} stderr=${stderr}`,
              this.config.name,
              'QWEN_BRIDGE_INVALID_RESPONSE',
              false,
              error instanceof Error ? error : undefined
            )
          );
        }
      });
    });
  }

  private resolvePackagePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    return resolve(packageRoot, filePath);
  }
}
