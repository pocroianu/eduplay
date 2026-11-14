import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthCheck, HealthStatus } from '../HealthCheck';

// Mock fetch
global.fetch = vi.fn();

describe('HealthCheck', () => {
  let healthCheck: HealthCheck;

  beforeEach(() => {
    vi.clearAllMocks();
    healthCheck = new HealthCheck({
      timeout: 1000,
      services: [
        { name: 'Service1', url: 'http://localhost:8000', critical: true },
        { name: 'Service2', url: 'http://localhost:8001', critical: false }
      ]
    });
  });

  describe('Health Check', () => {
    it('should return healthy when all services are up', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await healthCheck.check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.services.length).toBe(2);
      expect(result.services.every(s => s.status === HealthStatus.HEALTHY)).toBe(true);
    });

    it('should return unhealthy when critical service is down', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First service (critical) fails
          return Promise.reject(new Error('Connection refused'));
        }
        // Second service succeeds
        return Promise.resolve({ ok: true, status: 200 });
      });

      const result = await healthCheck.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should return degraded when non-critical service is down', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First service (critical) succeeds
          return Promise.resolve({ ok: true, status: 200 });
        }
        // Second service (non-critical) fails
        return Promise.reject(new Error('Connection refused'));
      });

      const result = await healthCheck.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
    });

    it('preserves service criticality when async health checks finish out of order', async () => {
      healthCheck = new HealthCheck({
        timeout: 1000,
        services: [
          { name: 'CriticalSlow', url: 'http://localhost:8000', critical: true },
          { name: 'OptionalFast', url: 'http://localhost:8001', critical: false }
        ]
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('8000')) {
          return new Promise((_, reject) => setTimeout(() => reject(new Error('Connection refused')), 20));
        }

        return Promise.resolve({ ok: true, status: 200 });
      });

      const result = await healthCheck.check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.services.map(service => service.name)).toEqual(['CriticalSlow', 'OptionalFast']);
    });

    it('should include memory information', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

      const result = await healthCheck.check();

      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.memory.percentUsed).toBeGreaterThanOrEqual(0);
      expect(result.memory.percentUsed).toBeLessThanOrEqual(100);
    });

    it('should include process information', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

      const result = await healthCheck.check();

      expect(result.process).toBeDefined();
      expect(result.process.pid).toBe(process.pid);
      expect(result.process.platform).toBe(process.platform);
      expect(result.process.nodeVersion).toBe(process.version);
    });

    it('should track uptime', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await healthCheck.check();

      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should include response times', async () => {
      (global.fetch as any).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ok: true, status: 200 };
      });

      const result = await healthCheck.check();

      for (const service of result.services) {
        expect(service.responseTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Liveness Probe', () => {
    it('should return true when process is responsive', async () => {
      const alive = await healthCheck.liveness();
      expect(alive).toBe(true);
    });
  });

  describe('Readiness Probe', () => {
    it('should return true when services are ready', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

      const ready = await healthCheck.readiness();
      expect(ready).toBe(true);
    });

    it('should return false when critical services are down', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Connection refused'));

      const ready = await healthCheck.readiness();
      expect(ready).toBe(false);
    });
  });

  describe('Service Names', () => {
    it('should return configured service names', () => {
      const names = healthCheck.getServiceNames();

      expect(names).toEqual(['Service1', 'Service2']);
    });

    it('defaults to the supported ComfyUI/template/Piper runtime without requiring Ollama', () => {
      const defaultHealthCheck = new HealthCheck();

      expect(defaultHealthCheck.getServiceNames()).toEqual(['ComfyUI', 'Piper', 'Redis']);
    });
  });

  describe('Error Handling', () => {
    it('should handle service timeout', async () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 2000))
      );

      healthCheck = new HealthCheck({
        timeout: 100,
        services: [{ name: 'SlowService', url: 'http://localhost:9000' }]
      });

      const result = await healthCheck.check();

      expect(result.services[0].status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should include error messages for failed services', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Connection refused'));

      const result = await healthCheck.check();

      expect(result.services[0].error).toContain('Connection refused');
    });
  });
});
