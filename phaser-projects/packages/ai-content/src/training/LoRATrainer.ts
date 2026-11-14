/**
 * LoRA Trainer
 *
 * Experimental proof-of-life trainer that submits a single SDXL LoRA training
 * workflow to ComfyUI using the comfyUI-Realtime-Lora custom node pack.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import type {
  ComfyUIMessage,
  ComfyUIWorkflow,
  LoRATrainingConfig,
  TrainingError,
  TrainingJob,
  TrainingPreflightResult,
  TrainingProgress,
  TrainingResult,
} from './types';
import { ModelManager } from './ModelManager';
import { TrainingProgressTracker } from './TrainingProgressTracker';

interface DatasetEntry {
  id: string;
  imagePath: string;
  prompt: string;
}

interface PreparedDatasetInfo {
  imageCount: number;
  hostTrainingDir: string;
  containerTrainingDir: string;
  defaultCaption: string;
}

interface OutputScanState {
  existingFiles: Set<string>;
  outputDir: string;
  checkpointDir: string;
}

/**
 * Trainer events
 */
export const TRAINER_EVENTS = {
  JOB_QUEUED: 'job:queued',
  JOB_PREPARING: 'job:preparing',
  JOB_STARTED: 'job:started',
  PROGRESS_UPDATE: 'progress:update',
  CHECKPOINT_SAVED: 'checkpoint:saved',
  VALIDATION_STARTED: 'validation:started',
  VALIDATION_COMPLETED: 'validation:completed',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_CANCELLED: 'job:cancelled',
} as const;

/**
 * Trainer configuration
 */
export interface LoRATrainerConfig {
  comfyuiUrl: string;
  comfyuiWsUrl: string;
  progressTracker?: TrainingProgressTracker;
  modelManager?: ModelManager;
  timeout?: number;
  hostTrainingRoot?: string;
  containerTrainingRoot?: string;
  containerOutputDir?: string;
  containerCheckpointRoot?: string;
  containerSdScriptsRoot?: string;
}

/**
 * LoRA Trainer
 *
 * Manages a single experimental training job using ComfyUI backend integration.
 */
export class LoRATrainer extends EventEmitter {
  private readonly requiredNodes = ['SDXLLoraTrainer'];
  private config: Required<LoRATrainerConfig>;
  private progressTracker: TrainingProgressTracker;
  private modelManager: ModelManager;
  private currentJob: TrainingJob | null = null;
  private ws: WebSocket | null = null;
  private clientId: string;
  private promptId: string | null = null;
  private isCancelled = false;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private latestNodeOutput: Record<string, unknown> | null = null;
  private outputScanState: OutputScanState | null = null;

  constructor(config: LoRATrainerConfig) {
    super();

    this.clientId = uuidv4();

    this.config = {
      comfyuiUrl: config.comfyuiUrl,
      comfyuiWsUrl: config.comfyuiWsUrl,
      progressTracker: config.progressTracker || new TrainingProgressTracker(),
      modelManager: config.modelManager || new ModelManager(),
      timeout: config.timeout || 4 * 60 * 60 * 1000,
      hostTrainingRoot: config.hostTrainingRoot || join(process.cwd(), '.runtime', 'comfyui', 'input', 'training'),
      containerTrainingRoot: config.containerTrainingRoot || '/app/input/training',
      containerOutputDir: config.containerOutputDir || '/app/models/loras',
      containerCheckpointRoot: config.containerCheckpointRoot || '/app/models/loras/checkpoints',
      containerSdScriptsRoot: config.containerSdScriptsRoot || '/app/training/sd-scripts',
    };

    this.progressTracker = this.config.progressTracker;
    this.modelManager = this.config.modelManager;
  }

  /**
   * Initialize trainer
   */
  async init(): Promise<void> {
    await this.progressTracker.init();
    await this.modelManager.init();
  }

  /**
   * Perform preflight validation before starting a training job.
   */
  async preflight(config: LoRATrainingConfig): Promise<TrainingPreflightResult> {
    const entries = await this.readDatasetEntries(config.datasetPath);

    if (entries.length === 0) {
      throw new Error(`Dataset is empty: ${config.datasetPath}`);
    }

    let imageCount = 0;
    for (const entry of entries) {
      if (!entry.prompt.trim()) {
        throw new Error(`Dataset entry is missing a prompt: ${entry.id}`);
      }

      const resolvedImagePath = this.resolveDatasetAssetPath(entry.imagePath, config.datasetPath);
      if (!existsSync(resolvedImagePath)) {
        throw new Error(`Image file not found: ${resolvedImagePath}`);
      }

      imageCount++;
    }

    if (imageCount === 0) {
      throw new Error('No valid images found in dataset');
    }

    await this.ensureWritableDirectory(this.config.hostTrainingRoot);
    await this.ensureComfyUIAvailable();
    const objectInfo = await this.fetchObjectInfo();
    this.ensureRequiredNodes(objectInfo);
    this.ensureBaseModelAvailable(config.baseModel, objectInfo);

    return {
      datasetEntries: entries.length,
      imageCount,
      hostTrainingRoot: this.config.hostTrainingRoot,
      containerTrainingRoot: this.config.containerTrainingRoot,
      requiredNodes: [...this.requiredNodes],
    };
  }

  /**
   * Start training a LoRA model.
   */
  async train(config: LoRATrainingConfig): Promise<TrainingJob> {
    const preflight = await this.preflight(config);

    const job: TrainingJob = {
      id: `job-${Date.now()}-${uuidv4().substring(0, 8)}`,
      name: config.name,
      status: 'pending',
      config,
      progress: {
        currentEpoch: 0,
        totalEpochs: config.epochs,
        currentStep: 0,
        totalSteps: 0,
        stepsPerEpoch: 0,
        currentLoss: 0,
        avgLoss: 0,
        learningRate: config.learningRate,
        stepsPerSecond: 0,
        epochsPerHour: 0,
        percentage: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.currentJob = job;
    this.isCancelled = false;
    this.latestNodeOutput = null;
    this.outputScanState = await this.captureOutputBaseline(config, job.id);

    this.emit(TRAINER_EVENTS.JOB_QUEUED, job);
    await this.progressTracker.startTracking(job);

    try {
      await this.updateJobStatus('preparing');
      this.emit(TRAINER_EVENTS.JOB_PREPARING, job);

      const entries = await this.readDatasetEntries(config.datasetPath);
      const datasetInfo = await this.prepareDataset(job, entries);

      job.progress.stepsPerEpoch = Math.ceil(datasetInfo.imageCount / config.batchSize);
      job.progress.totalSteps = job.progress.stepsPerEpoch * config.epochs;

      const workflow = await this.buildTrainingWorkflow(job, datasetInfo);

      await this.connectWebSocket();
      await this.submitWorkflow(workflow);

      await this.updateJobStatus('training');
      await this.updateProgress({
        currentStep: 0,
        currentEpoch: 0,
        percentage: 0,
      });
      this.emit(TRAINER_EVENTS.JOB_STARTED, job);

      this.startTimeout();

      // Use the preflight information so it is observable in the active job.
      job.progress.stepsPerEpoch = Math.ceil(preflight.imageCount / config.batchSize);
      job.progress.totalSteps = job.progress.stepsPerEpoch * config.epochs;

      return job;
    } catch (error) {
      const trainingError: TrainingError = {
        code: 'TRAINING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date(),
        canResume: false,
        suggestedAction: 'Check Docker mounts, ComfyUI node installation, and dataset paths before retrying.',
      };

      await this.progressTracker.failJob(job.id, trainingError);
      this.emit(TRAINER_EVENTS.JOB_FAILED, job, trainingError);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Cancel current training job
   */
  async cancel(): Promise<void> {
    if (!this.currentJob) {
      throw new Error('No active training job');
    }

    this.isCancelled = true;

    if (this.promptId) {
      try {
        await fetch(`${this.config.comfyuiUrl}/interrupt`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to cancel ComfyUI job:', error);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.clearTimeout();

    await this.progressTracker.cancelJob(this.currentJob.id);
    this.emit(TRAINER_EVENTS.JOB_CANCELLED, this.currentJob);

    this.currentJob = null;
    this.promptId = null;
    this.latestNodeOutput = null;
  }

  getProgress(): TrainingProgress | null {
    return this.currentJob?.progress || null;
  }

  getCurrentJob(): TrainingJob | null {
    return this.currentJob;
  }

  private async buildTrainingWorkflow(
    job: TrainingJob,
    datasetInfo: PreparedDatasetInfo,
  ): Promise<ComfyUIWorkflow> {
    const templatePath = join(__dirname, 'workflows', 'lora-training-base.json');
    const templateContent = await readFile(templatePath, 'utf-8');
    const workflow = JSON.parse(templateContent) as ComfyUIWorkflow;
    const node = workflow.nodes['1'];

    if (!node) {
      throw new Error('Training workflow template is missing node 1');
    }

    node.class_type = 'SDXLLoraTrainer';
    node.inputs = {
      inputcount: Math.min(datasetInfo.imageCount, 100),
      images_path: datasetInfo.containerTrainingDir,
      sd_scripts_path: this.config.containerSdScriptsRoot,
      ckpt_name: this.getBaseModelPath(job.config.baseModel),
      caption: datasetInfo.defaultCaption,
      training_steps: job.progress.totalSteps,
      learning_rate: job.config.learningRate,
      lora_rank: job.config.loraRank,
      vram_mode: this.getVramMode(job.config.resolution),
      keep_lora: true,
      output_name: job.config.name,
      custom_python_exe: '',
      no_half_vae: false,
    };

    return workflow;
  }

  private getBaseModelPath(baseModel: string): string {
    const modelMap: Record<string, string> = {
      'sdxl-1.0': 'sd_xl_base_1.0.safetensors',
      'sd-1.5': 'v1-5-pruned-emaonly.safetensors',
      'sdxl-turbo': 'sd_xl_turbo_1.0.safetensors',
    };

    return modelMap[baseModel] || modelMap['sdxl-1.0'];
  }

  private getVramMode(resolution: number): string {
    if (resolution >= 1024) {
      return 'Max (1024px)';
    }

    if (resolution <= 512) {
      return 'Min (512px)';
    }

    return 'Low (768px)';
  }

  private async prepareDataset(
    job: TrainingJob,
    entries: DatasetEntry[],
  ): Promise<PreparedDatasetInfo> {
    const hostTrainingDir = join(this.config.hostTrainingRoot, job.id);
    await rm(hostTrainingDir, { recursive: true, force: true });
    await mkdir(hostTrainingDir, { recursive: true });

    let imageCount = 0;
    for (const entry of entries) {
      const resolvedImagePath = this.resolveDatasetAssetPath(entry.imagePath, job.config.datasetPath);

      if (!existsSync(resolvedImagePath)) {
        throw new Error(`Image file not found: ${resolvedImagePath}`);
      }

      const imageExt = extname(resolvedImagePath) || '.png';
      const baseName = `${String(imageCount).padStart(3, '0')}`;
      const outputImagePath = join(hostTrainingDir, `${baseName}${imageExt}`);
      const outputCaptionPath = join(hostTrainingDir, `${baseName}.txt`);

      await copyFile(resolvedImagePath, outputImagePath);
      await writeFile(outputCaptionPath, entry.prompt.trim(), 'utf-8');

      imageCount++;
    }

    if (imageCount === 0) {
      throw new Error('No valid images found in dataset');
    }

    return {
      imageCount,
      hostTrainingDir,
      containerTrainingDir: this.joinContainerPath(this.config.containerTrainingRoot, job.id),
      defaultCaption: entries[0]?.prompt.trim() || 'children book illustration',
    };
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.comfyuiWsUrl}?clientId=${this.clientId}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as ComfyUIMessage;
          void this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        reject(error);
      });

      this.ws.on('close', () => {
        this.ws = null;
      });
    });
  }

  private async submitWorkflow(workflow: ComfyUIWorkflow): Promise<void> {
    const response = await fetch(`${this.config.comfyuiUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflow.nodes,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const detail = responseBody.trim() ? ` - ${responseBody.trim()}` : '';
      throw new Error(`Failed to submit workflow: ${response.statusText}${detail}`);
    }

    const result = await response.json() as { prompt_id?: string };
    if (!result.prompt_id) {
      throw new Error('ComfyUI did not return a prompt id for the training request');
    }

    this.promptId = result.prompt_id;
  }

  private async handleWebSocketMessage(message: ComfyUIMessage): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    switch (message.type) {
      case 'execution_start':
        this.onExecutionStart(message.data);
        break;
      case 'progress':
        await this.onProgress(message.data);
        break;
      case 'executing':
        if (message.data?.node === null && message.data?.prompt_id) {
          await this.onExecutionComplete(message.data.prompt_id);
        } else {
          this.onExecuting(message.data);
        }
        break;
      case 'executed':
        this.onExecuted(message.data);
        break;
      case 'execution_error':
        await this.onExecutionError(message.data);
        break;
      case 'execution_cached':
      case 'status':
        break;
    }
  }

  private onExecutionStart(data: any): void {
    console.log('Training execution started:', data);
  }

  private async onProgress(data: any): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    const currentStep = typeof data?.value === 'number' ? data.value : this.currentJob.progress.currentStep;
    const totalSteps = this.currentJob.progress.totalSteps || 1;
    const stepsPerEpoch = this.currentJob.progress.stepsPerEpoch || 1;
    const currentEpoch = Math.min(
      this.currentJob.progress.totalEpochs,
      Math.floor(currentStep / stepsPerEpoch),
    );
    const percentage = Math.min(100, (currentStep / totalSteps) * 100);

    await this.updateProgress({
      currentStep,
      currentEpoch,
      percentage,
    });
  }

  private onExecuting(data: any): void {
    if (data?.node) {
      console.log(`Executing node: ${data.node}`);
    }
  }

  private onExecuted(data: any): void {
    this.latestNodeOutput = data?.output ?? null;
  }

  private async onExecutionComplete(promptId: string): Promise<void> {
    if (!this.currentJob || promptId !== this.promptId) {
      return;
    }

    await this.onTrainingCompleted(this.latestNodeOutput);
  }

  private async onExecutionError(data: any): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    const error: TrainingError = {
      code: 'EXECUTION_ERROR',
      message: data?.exception_message || 'Unknown execution error',
      stack: data?.traceback,
      timestamp: new Date(),
      epoch: this.currentJob.progress.currentEpoch,
      step: this.currentJob.progress.currentStep,
      canResume: false,
      suggestedAction: 'Check the ComfyUI container logs and verify the training nodes are installed.',
    };

    await this.progressTracker.failJob(this.currentJob.id, error);
    this.emit(TRAINER_EVENTS.JOB_FAILED, this.currentJob, error);
    this.cleanup();
  }

  private async onTrainingCompleted(output: Record<string, unknown> | null): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    this.clearTimeout();

    const job = this.currentJob;
    const completedAt = new Date();
    const trainingDuration = job.startedAt
      ? (completedAt.getTime() - job.startedAt.getTime()) / 1000
      : 0;

    const loraPath = await this.resolveHostLoraPath(job, output);
    const loraStats = await stat(loraPath);
    const checkpoints = await this.collectCheckpointPaths(job.id);

    const result: TrainingResult = {
      loraPath,
      modelSize: loraStats.size,
      finalLoss: this.currentJob.progress.currentLoss,
      avgLoss: this.currentJob.progress.avgLoss,
      totalSteps: this.currentJob.progress.totalSteps,
      totalEpochs: this.currentJob.progress.totalEpochs,
      trainingDuration,
      avgStepsPerSecond: this.currentJob.progress.stepsPerSecond,
      checkpoints,
      completedAt,
    };

    await this.modelManager.saveModel(
      job.config,
      result,
      job.config.description ? [job.config.description] : [],
    );
    await this.progressTracker.completeJob(job.id, result);

    this.emit(TRAINER_EVENTS.JOB_COMPLETED, job);
    this.cleanup();
  }

  private async updateProgress(progress: Partial<TrainingProgress>): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    await this.progressTracker.updateProgress(this.currentJob.id, progress);
    this.emit(TRAINER_EVENTS.PROGRESS_UPDATE, this.currentJob, progress);
  }

  private async updateJobStatus(status: TrainingJob['status']): Promise<void> {
    if (!this.currentJob) {
      return;
    }

    await this.progressTracker.updateStatus(this.currentJob.id, status);
  }

  private startTimeout(): void {
    this.timeoutTimer = setTimeout(async () => {
      if (!this.currentJob || this.isCancelled) {
        return;
      }

      const error: TrainingError = {
        code: 'TIMEOUT',
        message: `Training exceeded timeout of ${this.config.timeout / 1000 / 60} minutes`,
        timestamp: new Date(),
        epoch: this.currentJob.progress.currentEpoch,
        step: this.currentJob.progress.currentStep,
        canResume: true,
        suggestedAction: 'Retry after checking Docker resources and the ComfyUI logs.',
      };

      await this.progressTracker.failJob(this.currentJob.id, error);
      this.emit(TRAINER_EVENTS.JOB_FAILED, this.currentJob, error);
      await this.cancel();
    }, this.config.timeout);
  }

  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private cleanup(): void {
    this.clearTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentJob = null;
    this.promptId = null;
    this.latestNodeOutput = null;
    this.outputScanState = null;
  }

  private async ensureComfyUIAvailable(): Promise<void> {
    const response = await fetch(`${this.config.comfyuiUrl}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI is not reachable at ${this.config.comfyuiUrl} (status ${response.status})`);
    }
  }

  private async fetchObjectInfo(): Promise<Record<string, unknown>> {
    const objectInfoResponse = await fetch(`${this.config.comfyuiUrl}/object_info`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!objectInfoResponse.ok) {
      throw new Error(`ComfyUI object_info endpoint is unavailable at ${this.config.comfyuiUrl}`);
    }

    return await objectInfoResponse.json() as Record<string, unknown>;
  }

  private ensureRequiredNodes(objectInfo: Record<string, unknown>): void {
    const missingNodes = this.requiredNodes.filter((nodeName) => !(nodeName in objectInfo));

    if (missingNodes.length > 0) {
      throw new Error(`Missing required ComfyUI training nodes: ${missingNodes.join(', ')}`);
    }
  }

  private ensureBaseModelAvailable(baseModel: string, objectInfo: Record<string, unknown>): void {
    const trainerInfo = objectInfo.SDXLLoraTrainer as {
      input?: {
        required?: {
          ckpt_name?: [string[]];
        };
      };
    } | undefined;

    const availableCheckpoints = trainerInfo?.input?.required?.ckpt_name?.[0] || [];
    if (!Array.isArray(availableCheckpoints) || availableCheckpoints.length === 0) {
      throw new Error(
        'No base checkpoints are available in ComfyUI. Place the required .safetensors file under packages/ai-content/models/checkpoints and restart the comfyui service.',
      );
    }

    const requiredCheckpoint = this.getBaseModelPath(baseModel);
    if (!availableCheckpoints.includes(requiredCheckpoint)) {
      throw new Error(
        `Base model checkpoint "${requiredCheckpoint}" is not available in ComfyUI. Found: ${availableCheckpoints.join(', ')}`,
      );
    }
  }

  private async ensureWritableDirectory(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true });
    const probePath = join(directory, `.write-probe-${uuidv4()}.tmp`);
    await writeFile(probePath, 'ok', 'utf-8');
    await rm(probePath, { force: true });
  }

  private async readDatasetEntries(datasetPath: string): Promise<DatasetEntry[]> {
    const rawDataset = await readFile(datasetPath, 'utf-8');
    return rawDataset
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DatasetEntry);
  }

  private resolveDatasetAssetPath(assetPath: string, datasetPath: string): string {
    if (!assetPath) {
      throw new Error(`Dataset entry in ${datasetPath} is missing imagePath`);
    }

    if (/^[a-zA-Z]:\\/.test(assetPath) || assetPath.startsWith('/')) {
      return assetPath;
    }

    const fromCwd = resolve(process.cwd(), assetPath);
    if (existsSync(fromCwd)) {
      return fromCwd;
    }

    return resolve(dirname(datasetPath), assetPath);
  }

  private async captureOutputBaseline(config: LoRATrainingConfig, jobId: string): Promise<OutputScanState> {
    const outputDir = config.outputDir || join(process.cwd(), 'loras');
    const checkpointDir = join(outputDir, 'checkpoints', jobId);

    await mkdir(outputDir, { recursive: true });
    await mkdir(checkpointDir, { recursive: true });

    return {
      existingFiles: new Set(await this.listSafetensors(outputDir)),
      outputDir,
      checkpointDir,
    };
  }

  private async listSafetensors(directory: string): Promise<string[]> {
    if (!existsSync(directory)) {
      return [];
    }

    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.safetensors'))
      .map((entry) => entry.name);
  }

  private async resolveHostLoraPath(
    job: TrainingJob,
    output: Record<string, unknown> | null,
  ): Promise<string> {
    const outputDir = this.outputScanState?.outputDir || job.config.outputDir || join(process.cwd(), 'loras');

    const rawLoraPath = typeof output?.lora_path === 'string' ? output.lora_path : null;
    if (rawLoraPath) {
      if (existsSync(rawLoraPath)) {
        return rawLoraPath;
      }

      const hostCandidate = join(outputDir, basename(rawLoraPath));
      if (existsSync(hostCandidate)) {
        return hostCandidate;
      }
    }

    const newArtifact = await this.waitForNewArtifact(outputDir, job.config.name);
    if (!newArtifact) {
      throw new Error(`Training finished but no LoRA artifact was found in ${outputDir}`);
    }

    return newArtifact;
  }

  private async waitForNewArtifact(outputDir: string, prefix: string): Promise<string | null> {
    const baseline = this.outputScanState?.existingFiles || new Set<string>();

    for (let attempt = 0; attempt < 30; attempt++) {
      const currentFiles = await this.listSafetensors(outputDir);
      const newFiles = currentFiles.filter((file) => !baseline.has(file));
      const matchingFiles = newFiles.filter((file) => file.startsWith(prefix));
      const candidateFiles = matchingFiles.length > 0 ? matchingFiles : newFiles;

      if (candidateFiles.length > 0) {
        const filesWithStats = await Promise.all(
          candidateFiles.map(async (file) => {
            const fullPath = join(outputDir, file);
            const fileStat = await stat(fullPath);
            return { file, fullPath, mtimeMs: fileStat.mtimeMs };
          }),
        );

        filesWithStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
        return filesWithStats[0].fullPath;
      }

      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
    }

    return null;
  }

  private async collectCheckpointPaths(jobId: string): Promise<string[]> {
    const checkpointDir = this.outputScanState?.checkpointDir || join(process.cwd(), 'loras', 'checkpoints', jobId);
    if (!existsSync(checkpointDir)) {
      return [];
    }

    return (await this.listSafetensors(checkpointDir)).map((file) => join(checkpointDir, file));
  }

  private joinContainerPath(basePath: string, segment: string): string {
    return `${basePath.replace(/\/+$/, '')}/${segment}`;
  }
}
