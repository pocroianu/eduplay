/**
 * ComfyUI Image Provider
 *
 * Implements image generation using ComfyUI's WebSocket API.
 * Supports workflow submission, real-time progress tracking, and result retrieval.
 *
 * @see https://docs.comfy.org/development/comfyui-server/comms_routes
 * @see https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/
 */

import { z } from 'zod';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { ImageProviderBase, ImageRequest, ImageData, ImageRequestSchema } from './ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { BaseProviderConfigSchema, HealthCheckResult, ProviderEvents } from '../base/BaseProvider';
import {
  ProviderError,
  ProviderUnavailableError,
  ProviderTimeoutError,
  ProviderValidationError
} from '../base/errors';

/**
 * ComfyUI-specific configuration schema
 */
export const ComfyUIConfigSchema = BaseProviderConfigSchema.extend({
  workflowPath: z.string().optional(),
  checkpointName: z.string().default('sd_xl_base_1.0.safetensors'),
  defaultSampler: z.string().default('euler'),
  defaultScheduler: z.string().default('normal'),
  defaultLoraStrengthModel: z.number().default(1),
  defaultLoraStrengthClip: z.number().default(1),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).default('png'),
  clientId: z.string().optional()
});

export type ComfyUIConfig = z.infer<typeof ComfyUIConfigSchema>;

/**
 * ComfyUI workflow structure (API format)
 */
export interface ComfyUIWorkflow {
  [nodeId: string]: {
    inputs: Record<string, any>;
    class_type: string;
    _meta?: {
      title?: string;
    };
  };
}

/**
 * ComfyUI WebSocket message types
 */
export interface ComfyUIMessage {
  type: string;
  data: any;
}

/**
 * Prompt submission response
 */
export interface PromptResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, any>;
}

/**
 * Execution status from WebSocket
 */
export interface ExecutionStatus {
  status: {
    exec_info: {
      queue_remaining: number;
    };
  };
}

/**
 * History entry for completed generation
 */
export interface HistoryEntry {
  prompt: [number, string, ComfyUIWorkflow];
  outputs: {
    [nodeId: string]: {
      images?: Array<{
        filename: string;
        subfolder: string;
        type: string;
      }>;
    };
  };
}

/**
 * Pending generation request tracking
 */
interface PendingRequest {
  promptId: string;
  resolve: (result: ImageData) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  pollInterval?: NodeJS.Timeout;
  startTime: number;
}

const DEFAULT_NEGATIVE_PROMPT =
  'text, watermark, low quality, blurry, distorted, ugly, deformed';
const CHECKPOINT_NODE_ID = '4';
const SDXL_LORA_NODE_ID = '10';
const SAMPLER_NODE_ID = '3';
const LATENT_NODE_ID = '5';
const POSITIVE_PROMPT_NODE_ID = '6';
const NEGATIVE_PROMPT_NODE_ID = '7';
const QWEN_UNET_NODE_ID = '10';
const QWEN_LORA_NODE_ID = '15';
const QWEN_LATENT_NODE_ID = '13';
const QWEN_CLIP_NODE_ID = '20';
const QWEN_POSITIVE_PROMPT_NODE_ID = '27';
const QWEN_NEGATIVE_PROMPT_NODE_ID = '34';
const HISTORY_POLL_INTERVAL_MS = 2000;

/**
 * ComfyUI Provider Implementation
 *
 * Features:
 * - WebSocket-based real-time progress tracking
 * - Automatic workflow customization
 * - Queue management and timeout handling
 * - LoRA model support
 * - Style presets
 * - Comprehensive error handling
 */
export class ComfyUIProvider extends ImageProviderBase {
  protected config: ComfyUIConfig;
  private ws: WebSocket | null = null;
  private clientId: string;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private baseWorkflow: ComfyUIWorkflow | null = null;
  private isShuttingDown: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly reconnectDelay: number = 2000;

  constructor(config: ComfyUIConfig) {
    super(config);
    this.config = ComfyUIConfigSchema.parse(config);
    this.clientId = this.config.clientId || uuidv4();
  }

  /**
   * Initialize the provider.
   * Loads the base workflow and establishes WebSocket connection.
   */
  protected async _doInit(): Promise<void> {
    try {
      this.isShuttingDown = false;

      // Load base workflow
      await this.loadWorkflow();

      // Verify ComfyUI is running via HTTP
      await this.checkHttpEndpoint();

      // Establish WebSocket connection
      await this.connectWebSocket();

      this.emit(ProviderEvents.STATE_CHANGED, {
        provider: this.config.name,
        state: 'initialized'
      });
    } catch (error) {
      throw new ProviderUnavailableError(
        this.config.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Health check for ComfyUI service.
   * Tests both HTTP and WebSocket connectivity.
   */
  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    try {
      // Check HTTP endpoint
      const response = await fetch(`${this.config.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return {
          healthy: false,
          message: `HTTP status ${response.status}`
        };
      }

      const stats = await response.json();

      // Check WebSocket connection
      const wsHealthy = this.ws?.readyState === WebSocket.OPEN;

      return {
        healthy: wsHealthy,
        message: wsHealthy ? 'Connected' : 'WebSocket disconnected',
        details: {
          system: stats,
          websocket: wsHealthy,
          pendingRequests: this.pendingRequests.size
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Graceful shutdown.
   * Closes WebSocket connection and cleans up pending requests.
   */
  protected async _doShutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Reject all pending requests
    const requests = Array.from(this.pendingRequests.entries());
    for (const [, request] of requests) {
      clearTimeout(request.timeout);
      if (request.pollInterval) {
        clearInterval(request.pollInterval);
      }
      request.reject(new Error('Provider shutting down'));
    }
    this.pendingRequests.clear();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Generate a single image.
   * Submits workflow to ComfyUI and waits for completion via WebSocket.
   */
  async generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    // Validate request
    const validatedRequest = ImageRequestSchema.parse(request);

    const requestId = metadata?.requestId || uuidv4();
    const startTime = Date.now();

    this.emit(ProviderEvents.REQUEST_START, {
      requestId,
      provider: this.config.name
    });

    try {
      // Ensure WebSocket is connected
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.reconnectWebSocket();
      }

      // Create customized workflow
      const workflow = this.createWorkflow(validatedRequest);

      // Submit to ComfyUI
      const promptId = await this.submitWorkflow(workflow);

      // Wait for completion
      const imageData = await this.waitForCompletion(promptId, this.config.timeout);

      const latency = Date.now() - startTime;
      this.recordRequest(true, latency);

      this.emit(ProviderEvents.REQUEST_SUCCESS, {
        requestId,
        provider: this.config.name,
        latency
      });

      return {
        data: imageData,
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

      this.emit(ProviderEvents.REQUEST_ERROR, {
        requestId,
        provider: this.config.name,
        error: error instanceof Error ? error.message : String(error),
        latency
      });

      throw error;
    }
  }

  /**
   * Generate multiple images in batch.
   * Respects concurrency limits and provides progress callbacks.
   */
  async generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]> {
    const concurrency = options?.concurrency || 1;
    const stopOnError = options?.stopOnError ?? false;
    const results: GenerationResult<ImageData>[] = [];
    const errors: Error[] = [];

    // Process in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(async (request) => {
        try {
          return await this.generate(request, metadata);
        } catch (error) {
          if (stopOnError) {
            throw error;
          }
          errors.push(error instanceof Error ? error : new Error(String(error)));
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is GenerationResult<ImageData> => r !== null));

      // Progress callback
      if (options?.progressCallback) {
        options.progressCallback(Math.min(i + concurrency, requests.length), requests.length);
      }

      if (stopOnError && errors.length > 0) {
        throw errors[0];
      }
    }

    if (errors.length > 0 && !stopOnError) {
      console.warn(`Batch generation completed with ${errors.length} errors`);
    }

    return results;
  }

  /**
   * Get supported image styles.
   */
  getSupportedStyles(): string[] {
    return ['cartoon', 'realistic', 'flat', 'watercolor'];
  }

  /**
   * Get available LoRA models from ComfyUI.
   */
  async getAvailableLoras(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/loras`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const loras = await response.json();
        if (Array.isArray(loras)) {
          return loras;
        }
      }
    } catch {
      // Fall back to LoraLoader metadata below.
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/object_info/LoraLoader`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as {
        LoraLoader?: {
          input?: {
            required?: {
              lora_name?: [string[], Record<string, unknown>?];
            };
          };
        };
      };

      return data.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
    } catch {
      return [];
    }
  }

  // Private methods

  /**
   * Load base workflow from file or use default.
   */
  private async loadWorkflow(): Promise<void> {
    const candidatePaths = this.config.workflowPath
      ? [this.config.workflowPath]
      : [
          join(__dirname, 'workflows', 'sdxl-basic.json'),
          resolve(__dirname, '../../../src/providers/image/workflows/sdxl-basic.json'),
          join(process.cwd(), 'src', 'providers', 'image', 'workflows', 'sdxl-basic.json')
        ];

    let lastError: Error | undefined;

    try {
      for (const workflowPath of candidatePaths) {
        try {
          const content = await readFile(workflowPath, 'utf-8');
          this.baseWorkflow = JSON.parse(content);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    throw new Error(
      `Failed to load workflow: ${lastError?.message ?? 'workflow file not found'}`
    );
  }

  /**
   * Check if ComfyUI HTTP endpoint is reachable.
   */
  private async checkHttpEndpoint(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/system_stats`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
    } catch (error) {
      throw new Error(`ComfyUI HTTP endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Establish WebSocket connection to ComfyUI.
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.baseUrl.replace('http', 'ws') + `/ws?clientId=${this.clientId}`;

      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new ProviderTimeoutError(this.config.name, 5000));
      }, 5000);

      this.ws!.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.setupWebSocketHandlers();
        resolve();
      });

      this.ws!.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ProviderUnavailableError(this.config.name, error));
      });
    });
  }

  /**
   * Reconnect WebSocket after connection loss.
   */
  private async reconnectWebSocket(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.isShuttingDown) {
        return;
      }

      throw new ProviderUnavailableError(
        this.config.name,
        new Error('Max reconnection attempts exceeded')
      );
    }

    this.reconnectAttempts++;
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    if (this.isShuttingDown) {
      return;
    }

    await this.connectWebSocket();
  }

  /**
   * Setup WebSocket event handlers.
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: ComfyUIMessage = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      console.warn('WebSocket connection closed');
      if (this.isShuttingDown) {
        return;
      }
      // Attempt to reconnect in the background
      this.reconnectWebSocket().catch(console.error);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleWebSocketMessage(message: ComfyUIMessage): void {
    switch (message.type) {
      case 'executing':
        // Node execution update
        if (message.data.node === null && message.data.prompt_id) {
          // Execution complete for this prompt
          this.handleExecutionComplete(message.data.prompt_id);
        }
        break;

      case 'execution_error':
        this.handleExecutionError(message.data);
        break;

      case 'execution_success':
        if (message.data?.prompt_id) {
          void this.handleExecutionComplete(message.data.prompt_id);
        }
        break;

      case 'status':
        // Queue status update (can be used for monitoring)
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  /**
   * Handle execution completion.
   */
  private async handleExecutionComplete(promptId: string): Promise<void> {
    const pending = this.pendingRequests.get(promptId);
    if (!pending) return;

    try {
      // Fetch result from history
      const imageData = await this.fetchImageResult(promptId);
      clearTimeout(pending.timeout);
      if (pending.pollInterval) {
        clearInterval(pending.pollInterval);
      }
      pending.resolve(imageData);
      this.pendingRequests.delete(promptId);
    } catch (error) {
      clearTimeout(pending.timeout);
      if (pending.pollInterval) {
        clearInterval(pending.pollInterval);
      }
      pending.reject(error instanceof Error ? error : new Error(String(error)));
      this.pendingRequests.delete(promptId);
    }
  }

  /**
   * Handle execution error.
   */
  private handleExecutionError(data: any): void {
    const promptId = data.prompt_id;
    const pending = this.pendingRequests.get(promptId);

    if (pending) {
      clearTimeout(pending.timeout);
      if (pending.pollInterval) {
        clearInterval(pending.pollInterval);
      }
      pending.reject(new ProviderError(
        `ComfyUI execution error: ${JSON.stringify(data.exception_message || data)}`,
        this.config.name,
        'EXECUTION_ERROR',
        false
      ));
      this.pendingRequests.delete(promptId);
    }
  }

  /**
   * Create customized workflow from request.
   */
  private createWorkflow(request: ImageRequest): ComfyUIWorkflow {
    if (!this.baseWorkflow) {
      throw new Error('Base workflow not loaded');
    }

    // Deep clone workflow
    const workflow: ComfyUIWorkflow = JSON.parse(JSON.stringify(this.baseWorkflow));

    this.configureSampler(workflow, request);

    if (this.isQwenWorkflow(workflow)) {
      this.configureQwenWorkflow(workflow, request);
    } else {
      this.configureCheckpointWorkflow(workflow, request);
    }

    return workflow;
  }

  private configureSampler(workflow: ComfyUIWorkflow, request: ImageRequest): void {
    if (workflow[SAMPLER_NODE_ID]) {
      workflow[SAMPLER_NODE_ID].inputs.seed =
        request.seed || Math.floor(Math.random() * 1000000000);
      workflow[SAMPLER_NODE_ID].inputs.steps = request.steps ?? 20;
      workflow[SAMPLER_NODE_ID].inputs.cfg = request.cfgScale ?? 7;
    }
  }

  private isQwenWorkflow(workflow: ComfyUIWorkflow): boolean {
    return workflow[QWEN_UNET_NODE_ID]?.class_type === 'UNETLoader';
  }

  private configureQwenWorkflow(workflow: ComfyUIWorkflow, request: ImageRequest): void {
    if (workflow[QWEN_LATENT_NODE_ID]) {
      workflow[QWEN_LATENT_NODE_ID].inputs.width = request.width;
      workflow[QWEN_LATENT_NODE_ID].inputs.height = request.height;
    }

    if (workflow[QWEN_POSITIVE_PROMPT_NODE_ID]) {
      workflow[QWEN_POSITIVE_PROMPT_NODE_ID].inputs.text = this.enhancePrompt(
        request.prompt,
        request.style
      );
    }

    if (workflow[QWEN_NEGATIVE_PROMPT_NODE_ID]) {
      workflow[QWEN_NEGATIVE_PROMPT_NODE_ID].inputs.text =
        request.negativePrompt || DEFAULT_NEGATIVE_PROMPT;
    }

    if (!request.lora) {
      delete workflow[QWEN_LORA_NODE_ID];
      if (workflow[SAMPLER_NODE_ID]) {
        workflow[SAMPLER_NODE_ID].inputs.model = [QWEN_UNET_NODE_ID, 0];
      }
      return;
    }

    workflow[QWEN_LORA_NODE_ID] = {
      class_type: 'LoraLoaderModelOnly',
      inputs: {
        model: [QWEN_UNET_NODE_ID, 0],
        lora_name: request.lora,
        strength_model: this.config.defaultLoraStrengthModel
      }
    };

    if (workflow[SAMPLER_NODE_ID]) {
      workflow[SAMPLER_NODE_ID].inputs.model = [QWEN_LORA_NODE_ID, 0];
    }

    if (workflow[QWEN_POSITIVE_PROMPT_NODE_ID]) {
      workflow[QWEN_POSITIVE_PROMPT_NODE_ID].inputs.clip = [QWEN_CLIP_NODE_ID, 0];
    }

    if (workflow[QWEN_NEGATIVE_PROMPT_NODE_ID]) {
      workflow[QWEN_NEGATIVE_PROMPT_NODE_ID].inputs.clip = [QWEN_CLIP_NODE_ID, 0];
    }
  }

  private configureCheckpointWorkflow(workflow: ComfyUIWorkflow, request: ImageRequest): void {
    if (workflow[LATENT_NODE_ID]) {
      workflow[LATENT_NODE_ID].inputs.width = request.width;
      workflow[LATENT_NODE_ID].inputs.height = request.height;
    }

    if (workflow[POSITIVE_PROMPT_NODE_ID]) {
      workflow[POSITIVE_PROMPT_NODE_ID].inputs.text = this.enhancePrompt(
        request.prompt,
        request.style
      );
    }

    if (workflow[NEGATIVE_PROMPT_NODE_ID]) {
      workflow[NEGATIVE_PROMPT_NODE_ID].inputs.text =
        request.negativePrompt || DEFAULT_NEGATIVE_PROMPT;
    }

    if (workflow[CHECKPOINT_NODE_ID]) {
      workflow[CHECKPOINT_NODE_ID].inputs.ckpt_name = this.config.checkpointName;
    }

    this.configureLoraWorkflow(workflow, request.lora);
  }

  private configureLoraWorkflow(workflow: ComfyUIWorkflow, loraName?: string): void {
    if (!loraName) {
      delete workflow[SDXL_LORA_NODE_ID];
      this.pointWorkflowToCheckpoint(workflow);
      return;
    }

    if (!workflow[SDXL_LORA_NODE_ID]) {
      throw new ProviderValidationError(this.config.name, [
        `Workflow is missing LoRA loader node ${SDXL_LORA_NODE_ID}`
      ]);
    }

    workflow[SDXL_LORA_NODE_ID].inputs.model = [CHECKPOINT_NODE_ID, 0];
    workflow[SDXL_LORA_NODE_ID].inputs.clip = [CHECKPOINT_NODE_ID, 1];
    workflow[SDXL_LORA_NODE_ID].inputs.lora_name = loraName;
    workflow[SDXL_LORA_NODE_ID].inputs.strength_model = this.config.defaultLoraStrengthModel;
    workflow[SDXL_LORA_NODE_ID].inputs.strength_clip = this.config.defaultLoraStrengthClip;

    if (workflow[SAMPLER_NODE_ID]) {
      workflow[SAMPLER_NODE_ID].inputs.model = [SDXL_LORA_NODE_ID, 0];
    }

    if (workflow[POSITIVE_PROMPT_NODE_ID]) {
      workflow[POSITIVE_PROMPT_NODE_ID].inputs.clip = [SDXL_LORA_NODE_ID, 1];
    }

    if (workflow[NEGATIVE_PROMPT_NODE_ID]) {
      workflow[NEGATIVE_PROMPT_NODE_ID].inputs.clip = [SDXL_LORA_NODE_ID, 1];
    }
  }

  private pointWorkflowToCheckpoint(workflow: ComfyUIWorkflow): void {
    if (workflow[SAMPLER_NODE_ID]) {
      workflow[SAMPLER_NODE_ID].inputs.model = [CHECKPOINT_NODE_ID, 0];
    }

    if (workflow[POSITIVE_PROMPT_NODE_ID]) {
      workflow[POSITIVE_PROMPT_NODE_ID].inputs.clip = [CHECKPOINT_NODE_ID, 1];
    }

    if (workflow[NEGATIVE_PROMPT_NODE_ID]) {
      workflow[NEGATIVE_PROMPT_NODE_ID].inputs.clip = [CHECKPOINT_NODE_ID, 1];
    }
  }

  /**
   * Enhance prompt with style-specific keywords.
   */
  private enhancePrompt(prompt: string, style?: string): string {
    if (!style) return prompt;

    const styleEnhancements: Record<string, string> = {
      cartoon: 'cartoon style, vibrant colors, clean lines, simple shapes, children\'s book illustration',
      realistic: 'photorealistic, detailed, high quality, professional photography',
      flat: 'flat design, minimalist, vector art, simple shapes, solid colors',
      watercolor: 'watercolor painting, soft edges, artistic, hand-painted, gentle colors'
    };

    const enhancement = styleEnhancements[style];
    return enhancement ? `${prompt}, ${enhancement}` : prompt;
  }

  /**
   * Submit workflow to ComfyUI.
   */
  private async submitWorkflow(workflow: ComfyUIWorkflow): Promise<string> {
    const payload = {
      prompt: workflow,
      client_id: this.clientId
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as PromptResponse;

      if (result.node_errors && Object.keys(result.node_errors).length > 0) {
        throw new ProviderValidationError(
          this.config.name,
          Object.values(result.node_errors).map(e => JSON.stringify(e))
        );
      }

      return result.prompt_id;
    } catch (error) {
      throw new ProviderError(
        `Failed to submit workflow: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        'SUBMIT_FAILED',
        true,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Wait for generation completion via WebSocket.
   */
  private async waitForCompletion(promptId: string, timeoutMs: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(promptId);
        if (pending?.pollInterval) {
          clearInterval(pending.pollInterval);
        }
        this.pendingRequests.delete(promptId);
        reject(new ProviderTimeoutError(this.config.name, timeoutMs));
      }, timeoutMs);

      const pollInterval = setInterval(() => {
        void this.checkPromptCompletion(promptId);
      }, HISTORY_POLL_INTERVAL_MS);

      this.pendingRequests.set(promptId, {
        promptId,
        resolve,
        reject,
        timeout,
        pollInterval,
        startTime: Date.now()
      });
    });
  }

  private async checkPromptCompletion(promptId: string): Promise<void> {
    const pending = this.pendingRequests.get(promptId);
    if (!pending) {
      return;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/history/${promptId}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return;
      }

      const history = await response.json() as Record<string, { status?: { completed?: boolean } }>;
      if (history[promptId]?.status?.completed) {
        await this.handleExecutionComplete(promptId);
      }
    } catch {
      // Ignore transient polling failures and continue waiting for completion.
    }
  }

  /**
   * Fetch generated image from ComfyUI history.
   */
  private async fetchImageResult(promptId: string): Promise<ImageData> {
    try {
      // Get history entry
      const historyResponse = await fetch(`${this.config.baseUrl}/history/${promptId}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch history: ${historyResponse.status}`);
      }

      const history = await historyResponse.json() as Record<string, HistoryEntry>;
      const entry = history[promptId];

      if (!entry) {
        throw new Error('History entry not found');
      }

      // Find output image (usually from SaveImage node)
      let imageInfo: { filename: string; subfolder: string; type: string } | null = null;

      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          imageInfo = nodeOutput.images[0];
          break;
        }
      }

      if (!imageInfo) {
        throw new Error('No image output found');
      }

      // Fetch the actual image
      const imageUrl = `${this.config.baseUrl}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder)}&type=${encodeURIComponent(imageInfo.type)}`;

      const imageResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000)
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const buffer = Buffer.from(await imageResponse.arrayBuffer());

      // Determine mime type from filename
      const ext = imageInfo.filename.split('.').pop()?.toLowerCase();
      const mimeType: ImageData['mimeType'] =
        ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' :
        ext === 'webp' ? 'image/webp' :
        'image/png';

      // Extract seed from workflow (stored in history)
      const workflow = entry.prompt[2];
      const seed = workflow[SAMPLER_NODE_ID]?.inputs?.seed || 0;

      return {
        buffer,
        mimeType,
        width: workflow[LATENT_NODE_ID]?.inputs?.width || 512,
        height: workflow[LATENT_NODE_ID]?.inputs?.height || 512,
        seed
      };
    } catch (error) {
      throw new ProviderError(
        `Failed to fetch result: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        'FETCH_FAILED',
        true,
        error instanceof Error ? error : undefined
      );
    }
  }
}
