/**
 * Health check endpoint for service monitoring.
 *
 * Features:
 * - Multi-service status aggregation
 * - Degraded vs unhealthy detection
 * - Memory/uptime reporting
 * - Liveness and readiness probes
 */

import { Logger } from './Logger';

/**
 * Health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Service check result
 */
export interface ServiceCheck {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  services: ServiceCheck[];
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    percentUsed: number;
  };
  process: {
    pid: number;
    platform: string;
    nodeVersion: string;
  };
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  timeout?: number;
  services?: ServiceConfig[];
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  name: string;
  url: string;
  critical?: boolean;
  timeout?: number;
  healthEndpoint?: string;
}

/**
 * Default service configurations
 */
const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    name: 'ComfyUI',
    url: 'http://localhost:8188',
    critical: true,
    timeout: 5000
  },
  {
    name: 'Piper',
    url: 'http://localhost:5000',
    critical: false,
    timeout: 5000,
    healthEndpoint: '/health'
  },
  {
    name: 'Redis',
    url: 'redis://localhost:6379',
    critical: false,
    timeout: 5000
  }
];

/**
 * Health check for service monitoring.
 *
 * @example
 * ```typescript
 * const healthCheck = new HealthCheck();
 *
 * // Check all services
 * const result = await healthCheck.check();
 *
 * if (result.status === HealthStatus.UNHEALTHY) {
 *   console.error('System unhealthy:', result.services);
 * }
 *
 * // Liveness probe (is process alive?)
 * const alive = await healthCheck.liveness();
 *
 * // Readiness probe (can handle requests?)
 * const ready = await healthCheck.readiness();
 * ```
 */
export class HealthCheck {
  private logger: Logger;
  private config: Required<HealthCheckConfig>;
  private startTime: Date;

  constructor(config: HealthCheckConfig = {}) {
    this.logger = new Logger('HealthCheck');
    this.config = {
      timeout: config.timeout || 5000,
      services: config.services || DEFAULT_SERVICES
    };
    this.startTime = new Date();
  }

  /**
   * Perform full health check
   */
  async check(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    // Check all services, preserving configuration order so criticality matches results.
    const services = await Promise.all(
      this.config.services.map((serviceConfig) => this.checkService(serviceConfig))
    );

    // Determine overall status
    const criticalServices = services.filter((s, i) =>
      this.config.services[i].critical !== false
    );

    let status: HealthStatus;
    const hasUnhealthyCritical = criticalServices.some(
      s => s.status === HealthStatus.UNHEALTHY
    );
    const hasUnhealthyAny = services.some(
      s => s.status === HealthStatus.UNHEALTHY
    );
    const allHealthy = services.every(
      s => s.status === HealthStatus.HEALTHY
    );

    if (hasUnhealthyCritical) {
      status = HealthStatus.UNHEALTHY;
    } else if (hasUnhealthyAny || !allHealthy) {
      status = HealthStatus.DEGRADED;
    } else {
      status = HealthStatus.HEALTHY;
    }

    // Get memory info
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const percentUsed = (memUsage.heapUsed / totalMemory) * 100;

    const result: HealthCheckResult = {
      status,
      timestamp,
      uptime: Date.now() - this.startTime.getTime(),
      services,
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        percentUsed
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    this.logger.info('Health check completed', {
      status,
      healthyServices: services.filter(s => s.status === HealthStatus.HEALTHY).length,
      totalServices: services.length
    });

    return result;
  }

  /**
   * Liveness probe (is the process alive?)
   *
   * Returns true if process is running and responsive.
   * Used by Kubernetes liveness probe.
   */
  async liveness(): Promise<boolean> {
    try {
      // Simple check - can we allocate memory and respond?
      const test = Buffer.alloc(1024);
      return test.length === 1024;
    } catch (error) {
      this.logger.error('Liveness check failed', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Readiness probe (can the service handle requests?)
   *
   * Returns true if all critical services are available.
   * Used by Kubernetes readiness probe.
   */
  async readiness(): Promise<boolean> {
    try {
      const result = await this.check();
      return result.status !== HealthStatus.UNHEALTHY;
    } catch (error) {
      this.logger.error('Readiness check failed', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Get service names
   */
  getServiceNames(): string[] {
    return this.config.services.map(s => s.name);
  }

  // Private methods

  /**
   * Check individual service
   */
  private async checkService(config: ServiceConfig): Promise<ServiceCheck> {
    const startTime = Date.now();

    try {
      const url = config.url + (config.healthEndpoint || '');

      // Redis special handling
      if (config.name === 'Redis') {
        return await this.checkRedis(config);
      }

      // HTTP(S) service check
      const controller = new AbortController();
      const timeoutMs = config.timeout || this.config.timeout;
      let timeout: NodeJS.Timeout | undefined;

      let response: Response;
      try {
        response = await Promise.race([
          fetch(url, {
            signal: controller.signal,
            method: 'GET'
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new Error(`Health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          })
        ]);
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }

      const responseTime = Date.now() - startTime;
      const status = response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

      return {
        name: config.name,
        status,
        responseTime,
        metadata: {
          statusCode: response.status,
          url
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.warn('Service check failed', {
        service: config.name,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        name: config.name,
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          url: config.url
        }
      };
    }
  }

  /**
   * Check Redis service
   */
  private async checkRedis(config: ServiceConfig): Promise<ServiceCheck> {
    const startTime = Date.now();

    try {
      // Try to import redis (optional dependency)
      const redis = await import('redis');

      const client = redis.createClient({
        url: config.url,
        socket: {
          connectTimeout: config.timeout || this.config.timeout
        }
      });

      await client.connect();

      const pong = await client.ping();
      await client.quit();

      const responseTime = Date.now() - startTime;

      return {
        name: config.name,
        status: pong === 'PONG' ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTime,
        metadata: {
          url: config.url
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: config.name,
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          url: config.url
        }
      };
    }
  }
}

/**
 * Create Express middleware for health checks
 */
export function createHealthCheckMiddleware(healthCheck: HealthCheck) {
  return {
    /**
     * GET /health - Full health check
     */
    async health(req: any, res: any) {
      try {
        const result = await healthCheck.check();
        const statusCode = result.status === HealthStatus.UNHEALTHY ? 503 : 200;

        res.status(statusCode).json(result);
      } catch (error) {
        res.status(500).json({
          status: HealthStatus.UNHEALTHY,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    /**
     * GET /health/liveness - Liveness probe
     */
    async liveness(req: any, res: any) {
      try {
        const alive = await healthCheck.liveness();
        res.status(alive ? 200 : 503).json({ alive });
      } catch (error) {
        res.status(503).json({
          alive: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    /**
     * GET /health/readiness - Readiness probe
     */
    async readiness(req: any, res: any) {
      try {
        const ready = await healthCheck.readiness();
        res.status(ready ? 200 : 503).json({ ready });
      } catch (error) {
        res.status(503).json({
          ready: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
}
