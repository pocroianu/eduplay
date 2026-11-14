import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, LogLevel } from '../Logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: any;

  beforeEach(() => {
    logger = new Logger('TestComponent', { pretty: false });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.component).toBe('TestComponent');
      expect(logEntry.key).toBe('value');
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { context: 'test' });

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.message).toBe('Error occurred');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.context).toBe('test');
    });

    it('should include correlation ID in all logs', () => {
      logger.info('Message 1');
      logger.info('Message 2');

      const log1 = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const log2 = JSON.parse(consoleLogSpy.mock.calls[1][0]);

      expect(log1.correlationId).toBeDefined();
      expect(log1.correlationId).toBe(log2.correlationId);
    });
  });

  describe('Log Levels', () => {
    it('should respect minimum log level', () => {
      const logger = new Logger('Test', { minLevel: LogLevel.WARN, pretty: false });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      expect(spy).toHaveBeenCalledTimes(2); // Only WARN and ERROR
      spy.mockRestore();
    });

    it('should log all levels when minLevel is DEBUG', () => {
      const logger = new Logger('Test', { minLevel: LogLevel.DEBUG, pretty: false });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');

      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with same correlation ID', () => {
      logger.info('Parent');
      const child = logger.child('ChildComponent');
      child.info('Child');

      const parentLog = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const childLog = JSON.parse(consoleLogSpy.mock.calls[1][0]);

      expect(childLog.correlationId).toBe(parentLog.correlationId);
      expect(childLog.component).toBe('ChildComponent');
    });

    it('should maintain correlation ID across multiple children', () => {
      const child1 = logger.child('Child1');
      const child2 = logger.child('Child2');

      child1.info('Message 1');
      child2.info('Message 2');

      const log1 = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const log2 = JSON.parse(consoleLogSpy.mock.calls[1][0]);

      expect(log1.correlationId).toBe(log2.correlationId);
    });
  });

  describe('Correlation ID', () => {
    it('should allow setting correlation ID', () => {
      const customId = 'custom-correlation-id';
      logger.setCorrelationId(customId);
      logger.info('Test');

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.correlationId).toBe(customId);
    });

    it('should return current correlation ID', () => {
      const id = logger.getCorrelationId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = Logger.getInstance('App');
      const instance2 = Logger.getInstance('App');

      expect(instance1).toBe(instance2);
    });
  });

  describe('Context', () => {
    it('should include arbitrary context', () => {
      logger.info('Test', {
        userId: 123,
        action: 'generate',
        nested: { key: 'value' }
      });

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.userId).toBe(123);
      expect(logEntry.action).toBe('generate');
      expect(logEntry.nested).toEqual({ key: 'value' });
    });
  });
});
