import { ImageProviderBase, ImageRequest, ImageData } from './ImageProvider';
import { GenerationResult, BatchOptions, RequestMetadata } from '../base/types';
import { BaseProviderConfigSchema, HealthCheckResult } from '../base/BaseProvider';
import {
  ProviderError,
  ProviderUnavailableError,
  ProviderValidationError
} from '../base/errors';

interface FallbackImageProviderConfig {
  name: string;
  timeout: number;
  primaryName?: string;
  fallbackName?: string;
}

export class FallbackImageProvider extends ImageProviderBase {
  private readonly primaryLabel: string;
  private readonly fallbackLabel: string;
  private readonly primaryInitError?: Error;
  private readonly fallbackInitError?: Error;

  constructor(
    config: FallbackImageProviderConfig,
    private readonly primaryProvider: ImageProviderBase | null,
    private readonly fallbackProvider: ImageProviderBase | null,
    primaryInitError?: Error,
    fallbackInitError?: Error
  ) {
    super(
      BaseProviderConfigSchema.parse({
        name: config.name,
        baseUrl: 'http://localhost/image-provider-fallback',
        timeout: config.timeout,
        retries: 0,
        healthCheckInterval: 30000
      })
    );
    this.primaryLabel = config.primaryName || this.primaryProvider?.getName() || 'primary';
    this.fallbackLabel = config.fallbackName || this.fallbackProvider?.getName() || 'fallback';
    this.primaryInitError = primaryInitError;
    this.fallbackInitError = fallbackInitError;
  }

  async generate(
    request: ImageRequest,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>> {
    const startTime = Date.now();

    if (this.primaryProvider) {
      const support = this.primaryProvider.supportsRequest(request);
      if (!support.supported) {
        if (!this.fallbackProvider) {
          throw new ProviderValidationError(this.primaryLabel, [
            support.reason || 'Primary provider does not support this request.'
          ]);
        }

        const fallbackResult = await this.fallbackProvider.generate(request, metadata);
        this.recordRequest(true, Date.now() - startTime);
        return {
          ...fallbackResult,
          provider: `${fallbackResult.provider || this.fallbackLabel} (fallback)`,
          providerDetails: this.buildProviderDetails('fallback-single-unsupported', {
            primaryProvider: this.primaryLabel,
            fallbackProvider: this.fallbackLabel,
            reason: support.reason
          })
        };
      }

      try {
        const result = await this.primaryProvider.generate(request, metadata);
        return {
          ...result,
          provider: result.provider || this.primaryLabel,
          providerDetails: this.buildProviderDetails('primary-single', {
            primaryProvider: this.primaryLabel,
            fallbackProvider: this.fallbackProvider ? this.fallbackLabel : undefined
          })
        };
      } catch (error) {
        if (!this.fallbackProvider) {
          throw error;
        }

        const fallbackResult = await this.fallbackProvider.generate(request, metadata);
        this.recordRequest(true, Date.now() - startTime);
        return {
          ...fallbackResult,
          provider: `${fallbackResult.provider || this.fallbackLabel} (fallback)`,
          providerDetails: this.buildProviderDetails('fallback-single-error', {
            primaryProvider: this.primaryLabel,
            fallbackProvider: this.fallbackLabel,
            primaryError: this.errorMessage(error)
          })
        };
      }
    }

    if (!this.fallbackProvider) {
      throw new ProviderUnavailableError(
        this.config.name,
        this.fallbackInitError || this.primaryInitError || new Error('No fallback image provider is available')
      );
    }

    const fallbackResult = await this.fallbackProvider.generate(request, metadata);
    this.recordRequest(true, Date.now() - startTime);
    return {
      ...fallbackResult,
      provider: `${fallbackResult.provider || this.fallbackLabel} (fallback)`,
      providerDetails: this.buildProviderDetails('fallback-single-init', {
        primaryProvider: this.primaryLabel,
        fallbackProvider: this.fallbackLabel,
        primaryError: this.primaryInitError?.message
      })
    };
  }

  async generateBatch(
    requests: ImageRequest[],
    options?: BatchOptions,
    metadata?: Partial<RequestMetadata>
  ): Promise<GenerationResult<ImageData>[]> {
    const startTime = Date.now();

    if (this.primaryProvider) {
      const unsupportedRequest = requests.find((request) => {
        const support = this.primaryProvider!.supportsRequest(request);
        return !support.supported;
      });

      if (!unsupportedRequest) {
        const bufferedProgressEvents: Array<{ completed: number; total: number }> = [];

        try {
          const primaryResults = await this.primaryProvider.generateBatch(
            requests,
            {
              ...options,
              progressCallback: options?.progressCallback
                ? (completed, total) => {
                    bufferedProgressEvents.push({ completed, total });
                  }
                : undefined
            },
            metadata
          );

          for (const event of bufferedProgressEvents) {
            options?.progressCallback?.(event.completed, event.total);
          }

          return primaryResults.map((result) => ({
            ...result,
            provider: result.provider || this.primaryLabel,
            providerDetails: this.buildProviderDetails('primary-batch', {
              primaryProvider: this.primaryLabel,
              fallbackProvider: this.fallbackProvider ? this.fallbackLabel : undefined
            })
          }));
        } catch (error) {
          if (!this.fallbackProvider || !this.isRetryableError(error)) {
            throw error;
          }

          const fallbackResults = await this.fallbackProvider.generateBatch(
            requests,
            options,
            metadata
          );

          this.recordRequest(true, Date.now() - startTime);
          return fallbackResults.map((result) => ({
            ...result,
            provider: `${result.provider || this.fallbackLabel} (fallback)`,
            providerDetails: this.buildProviderDetails('fallback-batch-error', {
              primaryProvider: this.primaryLabel,
              fallbackProvider: this.fallbackLabel,
              primaryError: this.errorMessage(error)
            })
          }));
        }
      }

      const support = this.primaryProvider.supportsRequest(unsupportedRequest);
      if (!this.fallbackProvider) {
        throw new ProviderValidationError(this.primaryLabel, [
          support.reason || 'Primary provider does not support this batch.'
        ]);
      }

      const fallbackResults = await this.fallbackProvider.generateBatch(
        requests,
        options,
        metadata
      );

      this.recordRequest(true, Date.now() - startTime);
      return fallbackResults.map((result) => ({
        ...result,
        provider: `${result.provider || this.fallbackLabel} (fallback)`,
        providerDetails: this.buildProviderDetails('fallback-batch-unsupported', {
          primaryProvider: this.primaryLabel,
          fallbackProvider: this.fallbackLabel,
          reason: support.reason
        })
      }));
    }

    if (!this.fallbackProvider) {
      throw new ProviderUnavailableError(
        this.config.name,
        this.fallbackInitError || this.primaryInitError || new Error('No fallback image provider is available')
      );
    }

    const fallbackResults = await this.fallbackProvider.generateBatch(
      requests,
      options,
      metadata
    );

    this.recordRequest(true, Date.now() - startTime);
    return fallbackResults.map((result) => ({
      ...result,
      provider: `${result.provider || this.fallbackLabel} (fallback)`,
      providerDetails: this.buildProviderDetails('fallback-batch-init', {
        primaryProvider: this.primaryLabel,
        fallbackProvider: this.fallbackLabel,
        primaryError: this.primaryInitError?.message
      })
    }));
  }

  getSupportedStyles(): string[] {
    return Array.from(
      new Set([
        ...(this.primaryProvider?.getSupportedStyles() || []),
        ...(this.fallbackProvider?.getSupportedStyles() || [])
      ])
    );
  }

  async getAvailableLoras(): Promise<string[]> {
    const primaryLoras = this.primaryProvider
      ? await this.primaryProvider.getAvailableLoras()
      : [];
    const fallbackLoras = this.fallbackProvider
      ? await this.fallbackProvider.getAvailableLoras()
      : [];

    return Array.from(new Set([...primaryLoras, ...fallbackLoras]));
  }

  protected async _doInit(): Promise<void> {
    if (!this.primaryProvider && !this.fallbackProvider) {
      throw new ProviderUnavailableError(
        this.config.name,
        new Error('No image providers are available')
      );
    }
  }

  protected async _doHealthCheck(): Promise<Omit<HealthCheckResult, 'latency' | 'timestamp'>> {
    if (this.primaryProvider) {
      const primaryHealth = await this.primaryProvider.isHealthy();
      if (primaryHealth.healthy) {
        return {
          healthy: true,
          message: `${this.primaryLabel} healthy`,
          details: {
            primary: primaryHealth,
            fallbackConfigured: true
          }
        };
      }
    }

    if (!this.fallbackProvider) {
      return {
        healthy: false,
        message: `${this.primaryLabel} unavailable and fallback missing`,
        details: {
          primaryError: this.primaryInitError?.message,
          fallbackError: this.fallbackInitError?.message
        }
      };
    }

    const fallbackHealth = await this.fallbackProvider.isHealthy();
    return {
      healthy: fallbackHealth.healthy,
      message: fallbackHealth.healthy
        ? `${this.fallbackLabel} fallback healthy`
        : `${this.primaryLabel} unavailable and fallback unhealthy`,
      details: {
        primaryError: this.primaryInitError?.message,
        fallback: fallbackHealth
      }
    };
  }

  protected async _doShutdown(): Promise<void> {
    // Wrapped providers are owned and shut down by ProviderFactory.
  }

  private buildProviderDetails(
    route: string,
    details: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      route,
      ...details
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private isRetryableError(error: unknown): boolean {
    return error instanceof ProviderError && error.retryable;
  }
}
