import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitBreakerManager } from '../CircuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('TestService', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      windowDuration: 5000
    });
  });

  describe('State Management', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after threshold failures', async () => {
      const failingOp = async () => {
        throw new Error('Service unavailable');
      };

      // Fail threshold times
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failingOp)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should block requests when OPEN', async () => {
      breaker.forceOpen();

      await expect(
        breaker.execute(async () => 'success')
      ).rejects.toThrow('Circuit breaker TestService is OPEN');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      breaker = new CircuitBreaker('Test', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 100,
        windowDuration: 5000
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('Fail');
          })
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN
      await breaker.execute(async () => 'success');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should close after successful operations in HALF_OPEN', async () => {
      breaker = new CircuitBreaker('Test', {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 100,
        windowDuration: 5000
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('Fail');
          })
        ).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Succeed threshold times
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen if failure occurs in HALF_OPEN', async () => {
      breaker = new CircuitBreaker('Test', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 100,
        windowDuration: 5000
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('Fail');
          })
        ).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fail again
      await expect(
        breaker.execute(async () => {
          throw new Error('Fail');
        })
      ).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Metrics', () => {
    it('should track total calls', async () => {
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      const metrics = breaker.getMetrics();
      expect(metrics.totalCalls).toBe(2);
    });

    it('should track successful calls', async () => {
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      const metrics = breaker.getMetrics();
      expect(metrics.successfulCalls).toBe(2);
    });

    it('should track failed calls', async () => {
      await expect(
        breaker.execute(async () => {
          throw new Error('Fail');
        })
      ).rejects.toThrow();

      const metrics = breaker.getMetrics();
      expect(metrics.failedCalls).toBe(1);
    });

    it('should track rejected calls when OPEN', async () => {
      breaker.forceOpen();

      await expect(breaker.execute(async () => 'success')).rejects.toThrow();

      const metrics = breaker.getMetrics();
      expect(metrics.rejectedCalls).toBe(1);
    });

    it('should track consecutive failures', async () => {
      await expect(breaker.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(breaker.execute(async () => { throw new Error('2'); })).rejects.toThrow();

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(2);
    });

    it('should reset consecutive failures on success', async () => {
      await expect(breaker.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await breaker.execute(async () => 'success');

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(1);
    });
  });

  describe('Window Duration', () => {
    it('should count only failures within window', async () => {
      breaker = new CircuitBreaker('Test', {
        failureThreshold: 3,
        successThreshold: 1,
        timeout: 1000,
        windowDuration: 200 // 200ms window
      });

      // Fail twice
      await expect(breaker.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(breaker.execute(async () => { throw new Error('2'); })).rejects.toThrow();

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 250));

      // These failures should not trip the breaker (old ones expired)
      await expect(breaker.execute(async () => { throw new Error('3'); })).rejects.toThrow();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Reset', () => {
    it('should reset to CLOSED state', () => {
      breaker.forceOpen();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reset metrics', async () => {
      await breaker.execute(async () => 'success');
      breaker.reset();

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveSuccesses).toBe(0);
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('Events', () => {
    it('should emit stateChange event', async () => {
      const stateChangeEvent = vi.fn();
      breaker.on('stateChange', stateChangeEvent);

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('Fail');
          })
        ).rejects.toThrow();
      }

      expect(stateChangeEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          from: CircuitState.CLOSED,
          to: CircuitState.OPEN
        })
      );
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  it('should create and retrieve circuit breakers', () => {
    const breaker1 = manager.getBreaker('Service1');
    const breaker2 = manager.getBreaker('Service1');

    expect(breaker1).toBe(breaker2);
  });

  it('should manage multiple circuit breakers', () => {
    manager.getBreaker('Service1');
    manager.getBreaker('Service2');
    manager.getBreaker('Service3');

    const metrics = manager.getAllMetrics();

    expect(Object.keys(metrics)).toHaveLength(3);
  });

  it('should reset all circuit breakers', () => {
    const breaker1 = manager.getBreaker('Service1');
    const breaker2 = manager.getBreaker('Service2');

    breaker1.forceOpen();
    breaker2.forceOpen();

    manager.resetAll();

    expect(breaker1.getState()).toBe(CircuitState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitState.CLOSED);
  });

  it('should report health status', () => {
    manager.getBreaker('Service1');
    manager.getBreaker('Service2');
    manager.getBreaker('Service3').forceOpen();

    const health = manager.getHealthStatus();

    expect(health.healthy).toBe(false);
    expect(health.openCircuits).toContain('Service3');
    expect(health.totalCircuits).toBe(3);
  });
});
